"""
backend/api/routes/reports.py
PDF 보고서 파일 관리 API
- GET    /api/reports           → data/reports 폴더의 PDF 목록 반환
- POST   /api/reports/save      → PDF 파일 저장 (로컬 + S3)
- DELETE /api/reports/{filename} → PDF 파일 삭제 (로컬 + S3)
- POST   /api/reports/sync-s3   → data/reports 폴더의 전체 PDF를 S3에 동기화
- GET    /api/reports/s3        → S3에 저장된 PDF 목록 반환
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime

router = APIRouter(tags=["Reports"])

# PDF 저장 폴더 경로
REPORTS_DIR = Path(__file__).parent.parent.parent / "data" / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


# ─── GET /api/reports ────────────────────────────────────────────
@router.get("/reports")
async def list_reports():
    """로컬 data/reports 폴더의 PDF 파일 목록 반환"""
    files = []
    for f in sorted(REPORTS_DIR.glob("*.pdf")):
        stat = f.stat()
        files.append({
            "filename": f.name,
            "size": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_ctime).strftime("%Y-%m-%d %H:%M"),
        })
    return {"reports": files, "count": len(files)}


# ─── POST /api/reports/save ─────────────────────────────────────
class SaveReportRequest(BaseModel):
    filename: str       # 예: report_20260131_EQP12_THP.pdf
    content: str        # PDF에 넣을 텍스트 내용
    metadata: dict = {}


@router.post("/reports/save")
async def save_report(req: SaveReportRequest):
    """
    텍스트 내용을 PDF로 저장하고 S3에도 업로드합니다.
    - reportlab 설치 시: 실제 PDF 생성 (한글 지원)
    - reportlab 미설치 시: 텍스트로 fallback
    """
    filepath = REPORTS_DIR / req.filename

    if filepath.exists():
        raise HTTPException(status_code=409, detail=f"{req.filename} 이미 존재합니다.")

    # 1. 로컬 저장
    try:
        _save_as_pdf(filepath, req.filename, req.content, req.metadata)
    except ImportError:
        filepath.write_text(req.content, encoding="utf-8")

    # 2. S3 업로드 (실패해도 로컬 저장은 유지)
    s3_uri = None
    s3_error = None
    try:
        from backend.config.aws_config import aws_config
        s3_uri = aws_config.upload_file_to_s3(str(filepath), req.filename)
    except Exception as e:
        s3_error = str(e)
        print(f"[WARN] S3 업로드 실패 (로컬 저장은 완료): {e}")

    return {
        "success": True,
        "filename": req.filename,
        "path": str(filepath),
        "s3_uri": s3_uri,
        "s3_error": s3_error,
        "message": "보고서가 저장되었습니다." + (" (S3 업로드 실패)" if s3_error else ""),
    }


# ─── DELETE /api/reports/{filename} ─────────────────────────────
@router.delete("/reports/{filename}")
async def delete_report(filename: str):
    """
    PDF 파일 삭제 (로컬 + S3)
    초기화 시 사용
    """
    # 경로 탈출 방지
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="잘못된 파일명입니다.")

    filepath = REPORTS_DIR / filename

    # 1. 로컬 삭제
    local_deleted = False
    if filepath.exists():
        filepath.unlink()
        local_deleted = True
    else:
        raise HTTPException(status_code=404, detail=f"{filename} 파일이 없습니다.")

    # 2. S3 삭제 (실패해도 로컬 삭제는 완료)
    s3_deleted = False
    s3_error = None
    try:
        from backend.config.aws_config import aws_config
        aws_config.delete_file_from_s3(filename)
        s3_deleted = True
    except Exception as e:
        s3_error = str(e)
        print(f"[WARN] S3 삭제 실패 (로컬 삭제는 완료): {e}")

    return {
        "success": True,
        "filename": filename,
        "local_deleted": local_deleted,
        "s3_deleted": s3_deleted,
        "s3_error": s3_error,
        "message": "삭제되었습니다." + (" (S3 삭제 실패)" if s3_error else ""),
    }


# ─── POST /api/reports/sync-s3 ───────────────────────────────────
@router.post("/reports/sync-s3")
async def sync_reports_to_s3():
    """
    data/reports 폴더의 모든 PDF를 S3에 업로드합니다.
    이미 S3에 존재하는 파일은 건너뜁니다.
    """
    try:
        from backend.config.aws_config import aws_config
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AWS 설정 로드 실패: {e}")

    pdf_files = list(REPORTS_DIR.glob("*.pdf"))
    if not pdf_files:
        return {"success": True, "message": "업로드할 PDF 파일이 없습니다.", "uploaded": [], "skipped": []}

    uploaded = []
    skipped = []
    errors = []

    for pdf_path in sorted(pdf_files):
        filename = pdf_path.name
        try:
            # S3에 이미 존재하면 스킵
            if aws_config.file_exists_in_s3(filename):
                skipped.append(filename)
                print(f"[S3 sync] 이미 존재, 스킵: {filename}")
                continue

            s3_uri = aws_config.upload_file_to_s3(str(pdf_path), filename)
            uploaded.append({"filename": filename, "s3_uri": s3_uri})
        except Exception as e:
            errors.append({"filename": filename, "error": str(e)})
            print(f"[S3 sync] 업로드 실패: {filename} - {e}")

    return {
        "success": True,
        "message": f"동기화 완료: {len(uploaded)}개 업로드, {len(skipped)}개 스킵",
        "uploaded": uploaded,
        "skipped": skipped,
        "errors": errors,
    }


# ─── GET /api/reports/s3 ─────────────────────────────────────────
@router.get("/reports/s3")
async def list_s3_reports():
    """S3에 저장된 PDF 파일 목록 반환"""
    try:
        from backend.config.aws_config import aws_config
        files = aws_config.list_files_in_s3()
        return {"success": True, "reports": files, "count": len(files)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"S3 조회 실패: {str(e)}")


# ─── PDF 생성 헬퍼 (reportlab) ───────────────────────────────────
def _save_as_pdf(filepath: Path, filename: str, content: str, metadata: dict):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    # 한글 폰트 등록 (Windows)
    font_path = Path("C:/Windows/Fonts/malgun.ttf")
    if not font_path.exists():
        font_path = Path("C:/Windows/Fonts/gulim.ttc")

    if font_path.exists():
        pdfmetrics.registerFont(TTFont("Korean", str(font_path)))
        font_name = "Korean"
    else:
        font_name = "Helvetica"

    doc = SimpleDocTemplate(
        str(filepath), pagesize=A4,
        rightMargin=20 * mm, leftMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
    )

    title_style = ParagraphStyle("Title", fontName=font_name, fontSize=16, leading=24, spaceAfter=12)
    head_style  = ParagraphStyle("Head",  fontName=font_name, fontSize=12, leading=18, spaceAfter=6, textColor="#1d4ed8")
    body_style  = ParagraphStyle("Body",  fontName=font_name, fontSize=10, leading=16)

    story = []
    story.append(Paragraph("KPI 이상 분석 보고서", title_style))
    story.append(Spacer(1, 6))

    if metadata:
        for k, v in metadata.items():
            story.append(Paragraph(f"<b>{k}:</b> {v}", body_style))
        story.append(Spacer(1, 10))

    for line in content.split("\n"):
        clean = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if not clean.strip():
            story.append(Spacer(1, 4))
        elif clean.strip().startswith("■"):
            story.append(Spacer(1, 8))
            story.append(Paragraph(f"<b>{clean}</b>", head_style))
        else:
            story.append(Paragraph(clean, body_style))

    doc.build(story)
