"""
FastAPI 메인 애플리케이션
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime
import sys
from pathlib import Path
from pydantic import BaseModel
from typing import List
import boto3, json, os
from dotenv import load_dotenv
from backend.graph.workflow import run_alarm_analysis, run_question_answer
from backend.api.routes import alarm, question, system, reports, supabase

load_dotenv()

# 프로젝트 루트 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.api.routes import alarm, question, system, reports  # ← 여기로 이동
from backend.api.models import HealthResponse, ErrorResponse

# FastAPI 앱 생성
app = FastAPI(
    title="AI Agent KPI Monitor API",
    description="제조 라인 KPI 모니터링 및 AI 기반 근본 원인 분석 시스템",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
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

# ── Bedrock 채팅 엔드포인트 ──────────────────────────────────────
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

# 기존 /api/chat 엔드포인트 전체 교체
@app.post("/api/chat")
async def chat(req: ChatRequest):
    try:
        # ── 알람 분석 모드 ──────────────────────────
        if req.mode == "alarm":
            print(f"🔔 알람 분석 모드: {req.alarm_eqp_id} / {req.alarm_kpi}")
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
            print(f"💬 질문 모드: {user_message[:50]}")
            final_state = run_question_answer(user_message)

            if final_state.get("error"):
                return {"content": f"응답 오류: {final_state['error']}"}

            return {
                "content": final_state.get("final_answer", "답변을 생성하지 못했습니다."),
                "similar_reports": final_state.get("similar_reports", []),
            }

    except Exception as e:
        print(f"❌ /api/chat 오류: {e}")
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