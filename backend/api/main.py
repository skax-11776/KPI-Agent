"""
FastAPI 메인 애플리케이션
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv
from backend.graph.workflow import run_alarm_analysis, run_question_answer
from backend.api.routes import alarm, question, system, reports, supabase, rds

import sys

load_dotenv()

# 프로젝트 루트 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.api.routes import alarm, question, system, reports
from backend.api.models import HealthResponse, ErrorResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    서버 시작 시 ChromaDB 초기화:
    1단계: S3에서 복원 시도 (K8s/Linux 환경)
    2단계: 여전히 비어있으면 로컬 PDF에서 로드 (로컬 개발 환경)
    """
    try:
        from backend.config.chroma_config import chroma_config
        count = chroma_config.count_reports()

        if count == 0:
            # 1단계: S3 복원 시도
            try:
                from backend.utils.chromadb_s3_sync import sync_from_s3
                synced = sync_from_s3()
                if synced > 0:
                    chroma_config.collection = chroma_config._get_or_create_collection()
            except Exception as e:
                print(f"[ChromaDB] S3 복원 실패: {e}")

            # 2단계: 여전히 비어있으면 로컬 PDF 로드
            if chroma_config.count_reports() == 0:
                print(f"[ChromaDB] 로컬 PDF에서 로드 시도 (backend/data/reports)")
                from backend.utils.load_reports_to_rag import load_reports_to_rag
                load_reports_to_rag("backend/data/reports")

            print(f"[ChromaDB] 최종 리포트 수: {chroma_config.count_reports()}개")
        else:
            print(f"[ChromaDB] 기존 데이터 {count}개 → 초기화 생략")
    except Exception as e:
        print(f"[WARN] ChromaDB 초기화 실패 (무시하고 시작): {e}")
    yield


# FastAPI 앱 생성
app = FastAPI(
    title="AI Agent KPI Monitor API",
    description="제조 라인 KPI 모니터링 및 AI 기반 근본 원인 분석 시스템",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(alarm.router, prefix="/api")
app.include_router(question.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(reports.router, prefix="/api")  
app.include_router(supabase.router, prefix="/api")
app.include_router(rds.router, prefix="/api")

# Bedrock 채팅 엔드포인트
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    system: str = ""
    mode: str = "question"
    alarm_date: str = ""
    alarm_eqp_id: str = ""
    alarm_kpi: str = ""
    live_context: str = ""        # 프론트엔드 탭 현황 데이터

# 기존 /api/chat 엔드포인트 전체 교체
@app.post("/api/chat")
async def chat(req: ChatRequest):
    try:
        # ── 알람 분석 모드 ──────────────────────────
        if req.mode == "alarm":
            print(f"알람 분석 모드: {req.alarm_eqp_id} / {req.alarm_kpi}")
            final_state = run_alarm_analysis(
                alarm_date=req.alarm_date or None,
                alarm_eqp_id=req.alarm_eqp_id or None,
                alarm_kpi=req.alarm_kpi or None,
            )
            # 결과 반환
            if final_state.get("error"):
                return {"content": f"분석 오류: {final_state['error']}"}
            
            root_causes = final_state.get("root_causes", [])
            report = final_state.get("final_report", "")
            causes_text = "\n".join([
                f"{i+1}. {c['cause']} (확률: {c['probability']}%)"
                for i, c in enumerate(root_causes)
            ])
            return {
                "content": report or causes_text or "분석 완료",
                "root_causes": root_causes,
                "report_id": final_state.get("report_id"),
                "rag_saved": final_state.get("rag_saved", False),
            }

        # ── 질문 응답 모드 ──────────────────────────
        else:
            # 마지막 사용자 메시지 추출
            user_message = next(
                (m.content for m in reversed(req.messages) if m.role == "user"),
                ""
            )
            print(f"질문 모드: {user_message[:50]}")

            # 최근 3턴 대화 이력 추출 (멀티턴 컨텍스트)
            prior = req.messages[:-1]  # 현재 질문 제외
            turns = []
            i = len(prior) - 1
            while i > 0 and len(turns) < 3:
                if prior[i].role == "assistant" and prior[i-1].role == "user":
                    turns.insert(0, (prior[i-1].content[:200], prior[i].content[:300]))
                    i -= 2
                else:
                    i -= 1

            live_context = req.live_context or ""
            if turns:
                history_lines = "\n".join([f"Q: {q}\nA: {a}" for q, a in turns])
                live_context += f"\n\n## 이전 대화 (최근 {len(turns)}턴)\n{history_lines}"

            final_state = run_question_answer(user_message, live_context=live_context)

            if final_state.get("error"):
                return {"content": f"응답 오류: {final_state['error']}"}

            return {
                "content": final_state.get("final_answer", "답변을 생성하지 못했습니다."),
                "similar_reports": final_state.get("similar_reports", []),
            }

    except Exception as e:
        print(f"[ERROR] /api/chat 오류: {e}")
        return {"content": f"서버 오류: {str(e)}"}

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            success=False,
            error="Internal Server Error",
            detail=str(exc)
        ).dict()
    )

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0"
    )

@app.get("/", tags=["System"])
async def root():
    return {
        "message": "AI Agent KPI Monitor API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )