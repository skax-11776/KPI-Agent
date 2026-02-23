"""
backend/api/routes/reports.py
PDF 보고서 파일 관리 API
- GET  /api/reports        → /backend/data/reports 폴더의 PDF 목록 반환
- POST /api/reports/save   → PDF 파일 저장 (텍스트 → PDF 변환)
- DELETE /api/reports/{filename} → PDF 파일 삭제
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pathlib import Path
import json, os
from datetime import datetime

router = APIRouter(tags=["Reports"])

# PDF 저장 폴더 경로 (main.py 실행 위치 기준)
REPORTS_DIR = Path(__file__).parent.parent.parent.parent / "data" / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)  # 폴더 없으면 자동 생성


# ─── GET /api/reports ───────────────────────────────────────────
# 폴더 안의 PDF 파일 목록을 반환
@router.get("/reports")
async def list_reports():
    """reports 폴더의 PDF 파일 목록 반환"""
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
    filename: str       # 저장할 파일명 (예: report_20260131_EQP12_THP.pdf)
    content: str        # PDF에 넣을 텍스트 내용
    metadata: dict = {} # 추가 메타데이터 (선택)


@router.post("/reports/save")
async def save_report(req: SaveReportRequest):
    """
    텍스트 내용을 PDF 파일로 저장
    실제 PDF 생성은 reportlab 사용 (없으면 .txt로 fallback)
    """
    filepath = REPORTS_DIR / req.filename

    # 이미 존재하면 덮어쓰기 방지
    if filepath.exists():
        raise HTTPException(status_code=409, detail=f"{req.filename} 이미 존재합니다.")

    try:
        # reportlab으로 PDF 생성 시도
        _save_as_pdf(filepath, req.filename, req.content, req.metadata)
    except ImportError:
        # reportlab 없으면 텍스트 파일로 저장 (확장자는 .pdf 유지)
        filepath.write_text(req.content, encoding="utf-8")

    return {
        "success": True,
        "filename": req.filename,
        "path": str(filepath),
        "message": "보고서가 저장되었습니다.",
    }


# ─── DELETE /api/reports/{filename} ─────────────────────────────
@router.delete("/reports/{filename}")
async def delete_report(filename: str):
    """특정 PDF 파일 삭제 (초기화 시 사용)"""
    filepath = REPORTS_DIR / filename

    # 경로 탈출 방지 (보안)
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="잘못된 파일명입니다.")

    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"{filename} 파일이 없습니다.")

    filepath.unlink()
    return {"success": True, "filename": filename, "message": "삭제되었습니다."}


# ─── PDF 생성 헬퍼 (reportlab) ───────────────────────────────────
from pathlib import Path

REPORTS_DIR = Path(__file__).parent.parent.parent.parent / "data" / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

def _save_as_pdf(filepath: Path, filename: str, content: str, metadata: dict):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    # ── 한글 폰트 등록 ──
    # Windows 기본 한글 폰트 경로
    font_path = Path("C:/Windows/Fonts/malgun.ttf")  # 맑은 고딕
    if not font_path.exists():
        font_path = Path("C:/Windows/Fonts/gulim.ttc")  # 굴림 (대안)
    
    if font_path.exists():
        pdfmetrics.registerFont(TTFont("Korean", str(font_path)))
        font_name = "Korean"
    else:
        font_name = "Helvetica"  # 폰트 없으면 기본값 (한글 깨짐)

    doc = SimpleDocTemplate(
        str(filepath), pagesize=A4,
        rightMargin=20*mm, leftMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
    )

    title_style = ParagraphStyle("Title", fontName=font_name, fontSize=16, leading=24, spaceAfter=12)
    head_style  = ParagraphStyle("Head",  fontName=font_name, fontSize=12, leading=18, spaceAfter=6, textColor="#1d4ed8")
    body_style  = ParagraphStyle("Body",  fontName=font_name, fontSize=10, leading=16)

    story = []
    story.append(Paragraph("KPI 이상 분석 보고서", title_style))
    story.append(Spacer(1, 6))

    # 메타데이터
    if metadata:
        for k, v in metadata.items():
            story.append(Paragraph(f"<b>{k}:</b> {v}", body_style))
        story.append(Spacer(1, 10))

    # 본문 (■ 헤더 구분)
    for line in content.split("\n"):
        clean = line.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
        if not clean.strip():
            story.append(Spacer(1, 4))
        elif clean.strip().startswith("■"):
            story.append(Spacer(1, 8))
            story.append(Paragraph(f"<b>{clean}</b>", head_style))
        else:
            story.append(Paragraph(clean, body_style))

    doc.build(story)