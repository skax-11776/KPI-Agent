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

load_dotenv()

# 프로젝트 루트 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.api.routes import alarm, question, system
from backend.api.models import HealthResponse, ErrorResponse

# FastAPI 앱 생성 (한 번만!)
app = FastAPI(
    title="AI Agent KPI Monitor API",
    description="제조 라인 KPI 모니터링 및 AI 기반 근본 원인 분석 시스템",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 설정 (한 번만!)
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


# ── Bedrock 채팅 엔드포인트 ──────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    system: str = ""

@app.post("/api/chat")
async def chat(req: ChatRequest):
    client = boto3.client(
        "bedrock-runtime",
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "system": req.system,
        "messages": [{"role": m.role, "content": m.content} for m in req.messages],
    }
    response = client.invoke_model(
        modelId=os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0"),
        body=json.dumps(body),
    )
    result = json.loads(response["body"].read())
    return {"content": result["content"][0]["text"]}


# ── 전역 예외 핸들러 ─────────────────────────────────────────────
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