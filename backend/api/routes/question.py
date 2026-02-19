"""
질문 관련 API 엔드포인트
"""

from fastapi import APIRouter, HTTPException
import time

from backend.api.models import (
    QuestionRequest,
    QuestionResponse,
    SimilarReport,
    ErrorResponse
)
from backend.graph.workflow import run_question_answer

router = APIRouter(prefix="/question", tags=["Question"])


@router.post(
    "/answer",
    response_model=QuestionResponse,
    summary="질문 답변",
    description="과거 리포트를 참고하여 사용자 질문에 답변합니다."
)
async def answer_question(request: QuestionRequest):
    """
    질문 답변 API
    
    - RAG 기반 과거 리포트 검색
    - AI 기반 답변 생성
    - 유사 리포트 목록 제공
    """
    
    try:
        start_time = time.time()
        
        # 워크플로우 실행
        result = run_question_answer(request.question)
        
        # 에러 체크
        if 'error' in result:
            raise HTTPException(status_code=500, detail=result['error'])
        
        processing_time = time.time() - start_time
        
        # 유사 리포트 포맷팅
        similar_reports = []
        for report in result.get('similar_reports', []):
            similar_reports.append(
                SimilarReport(
                    id=report['id'],
                    distance=report['distance'],
                    metadata=report['metadata'],
                    preview=report['document'][:200] + "..."
                )
            )
        
        # 응답 생성
        return QuestionResponse(
            success=True,
            message="답변 생성 완료",
            question=request.question,
            answer=result['final_answer'],
            report_exists=result.get('report_exists', False),
            similar_reports=similar_reports,
            llm_calls=result['metadata']['llm_calls'],
            processing_time=processing_time
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"질문 답변 실패: {str(e)}"
        )