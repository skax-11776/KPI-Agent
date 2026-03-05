"""
FastAPI Pydantic 모델 정의
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime


# ========== 요청 모델 ==========

class AlarmAnalyzeRequest(BaseModel):
    """알람 분석 요청"""
    
    alarm_date: Optional[str] = Field(
        None,
        description="알람 날짜 (YYYY-MM-DD). None이면 최신 알람 분석",
        example="2026-01-20"
    )
    alarm_eqp_id: Optional[str] = Field(
        None,
        description="장비 ID",
        example="EQP01"
    )
    alarm_kpi: Optional[str] = Field(
        None,
        description="KPI 이름",
        example="OEE"
    )


class QuestionRequest(BaseModel):
    """질문 요청"""
    
    question: str = Field(
        ...,
        description="사용자 질문",
        example="EQP01에서 발생한 OEE 문제의 원인을 설명해주세요",
        min_length=5,
        max_length=500
    )


# ========== 응답 모델 ==========

class RootCause(BaseModel):
    """근본 원인"""
    
    cause: str = Field(..., description="원인 설명")
    probability: int = Field(..., description="확률 (%)", ge=0, le=100)
    evidence: str = Field(..., description="근거")


class AlarmAnalyzeResponse(BaseModel):
    """알람 분석 응답"""
    
    success: bool = Field(..., description="성공 여부")
    message: str = Field(..., description="메시지")
    
    # 알람 정보
    alarm_date: str = Field(..., description="알람 날짜")
    alarm_eqp_id: str = Field(..., description="장비 ID")
    alarm_kpi: str = Field(..., description="KPI")
    
    # 분석 결과
    root_causes: List[RootCause] = Field(..., description="근본 원인 후보")
    selected_cause: RootCause = Field(..., description="선택된 근본 원인")
    
    # 리포트
    final_report: str = Field(..., description="최종 분석 리포트 (마크다운)")
    report_id: str = Field(..., description="리포트 ID")
    rag_saved: bool = Field(..., description="RAG 저장 여부")
    
    # 메타데이터
    llm_calls: int = Field(..., description="LLM 호출 횟수")
    processing_time: Optional[float] = Field(None, description="처리 시간 (초)")


class SimilarReport(BaseModel):
    """유사 리포트"""
    
    id: str = Field(..., description="리포트 ID")
    distance: float = Field(..., description="유사도 거리")
    metadata: Dict[str, Any] = Field(..., description="메타데이터")
    preview: str = Field(..., description="내용 미리보기")


class QuestionResponse(BaseModel):
    """질문 답변 응답"""
    
    success: bool = Field(..., description="성공 여부")
    message: str = Field(..., description="메시지")
    
    # 질문
    question: str = Field(..., description="사용자 질문")
    
    # 답변
    answer: str = Field(..., description="AI 답변")
    
    # 참고 리포트
    report_exists: bool = Field(..., description="관련 리포트 존재 여부")
    similar_reports: List[SimilarReport] = Field(..., description="유사 리포트 목록")
    
    # 메타데이터
    llm_calls: int = Field(..., description="LLM 호출 횟수")
    processing_time: Optional[float] = Field(None, description="처리 시간 (초)")


class LatestAlarmResponse(BaseModel):
    """최신 알람 응답"""

    success: bool = Field(..., description="성공 여부")
    date: str = Field(..., description="알람 날짜")
    eqp_id: str = Field(..., description="장비 ID")
    kpi: Optional[str] = Field(None, description="KPI (Node 2에서 결정)")


class AlarmPhase1Response(BaseModel):
    """알람 분석 Phase 1 응답 (근본 원인 후보 목록)"""

    success: bool = Field(..., description="성공 여부")
    message: str = Field(..., description="메시지")

    # 세션 ID (Phase 2에서 사용)
    session_id: str = Field(..., description="Phase 2 선택 요청 시 사용할 세션 ID")

    # 알람 정보
    alarm_date: str = Field(..., description="알람 날짜")
    alarm_eqp_id: str = Field(..., description="장비 ID")
    alarm_kpi: str = Field(..., description="KPI")

    # 근본 원인 후보
    root_causes: List[RootCause] = Field(..., description="근본 원인 후보 목록")

    # 메타데이터
    llm_calls: int = Field(..., description="LLM 호출 횟수")
    processing_time: Optional[float] = Field(None, description="처리 시간 (초)")


class AlarmSelectRequest(BaseModel):
    """근본 원인 선택 요청 (Phase 2)"""

    session_id: str = Field(..., description="Phase 1에서 받은 세션 ID")
    selected_index: int = Field(
        ..., description="선택한 원인 인덱스 (0부터 시작)", ge=0
    )


class AlarmPhase2Response(BaseModel):
    """알람 분석 Phase 2 응답 (최종 리포트)"""

    success: bool = Field(..., description="성공 여부")
    message: str = Field(..., description="메시지")

    # 알람 정보
    alarm_date: str = Field(..., description="알람 날짜")
    alarm_eqp_id: str = Field(..., description="장비 ID")
    alarm_kpi: str = Field(..., description="KPI")

    # 선택된 원인 & 리포트
    selected_cause: RootCause = Field(..., description="선택된 근본 원인")
    final_report: str = Field(..., description="최종 분석 리포트 (마크다운)")
    report_id: str = Field(..., description="리포트 ID")
    rag_saved: bool = Field(..., description="RAG 저장 여부")

    # 메타데이터
    llm_calls: int = Field(..., description="LLM 호출 횟수")
    processing_time: Optional[float] = Field(None, description="처리 시간 (초)")


class ErrorResponse(BaseModel):
    """에러 응답"""
    
    success: bool = Field(False, description="성공 여부")
    error: str = Field(..., description="에러 메시지")
    detail: Optional[str] = Field(None, description="상세 정보")


class HealthResponse(BaseModel):
    """헬스체크 응답"""
    
    status: str = Field(..., description="상태")
    timestamp: str = Field(..., description="현재 시간")
    version: str = Field(..., description="API 버전")