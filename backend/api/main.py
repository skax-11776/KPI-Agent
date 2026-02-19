"""
FastAPI 메인 애플리케이션
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime
import sys
from pathlib import Path

# 프로젝트 루트 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.api.routes import alarm, question
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
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(alarm.router, prefix="/api")
app.include_router(question.router, prefix="/api")


# 전역 예외 핸들러
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """전역 예외 처리"""
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            success=False,
            error="Internal Server Error",
            detail=str(exc)
        ).dict()
    )


# 헬스체크
@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="헬스체크",
    description="API 서버 상태를 확인합니다."
)
async def health_check():
    """API 서버 헬스체크"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0"
    )


# 루트 엔드포인트
@app.get("/", tags=["System"])
async def root():
    """API 루트"""
    return {
        "message": "AI Agent KPI Monitor API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)