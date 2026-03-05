"""
알람 관련 API 엔드포인트
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime
import time

from backend.api.models import (
    AlarmAnalyzeRequest,
    AlarmAnalyzeResponse,
    AlarmPhase1Response,
    AlarmSelectRequest,
    AlarmPhase2Response,
    LatestAlarmResponse,
    ErrorResponse,
    RootCause
)
from backend.graph.workflow import run_alarm_analysis, run_alarm_analysis_phase1, run_alarm_analysis_phase2
from backend.utils.data_utils import get_latest_alarm

router = APIRouter(prefix="/alarm", tags=["Alarm"])


@router.post(
    "/analyze",
    response_model=AlarmAnalyzeResponse,
    summary="알람 분석",
    description="알람을 분석하여 근본 원인을 찾고 리포트를 생성합니다."
)
async def analyze_alarm(request: AlarmAnalyzeRequest):
    """
    알람 분석 API
    
    - 최신 알람 또는 특정 알람 분석
    - AI 기반 근본 원인 분석
    - 자동 리포트 생성 및 RAG 저장
    """
    
    try:
        start_time = time.time()
        
        # 워크플로우 실행
        result = run_alarm_analysis(
            alarm_date=request.alarm_date,
            alarm_eqp_id=request.alarm_eqp_id,
            alarm_kpi=request.alarm_kpi
        )
        
        # 에러 체크
        if 'error' in result:
            raise HTTPException(status_code=500, detail=result['error'])
        
        processing_time = time.time() - start_time
        
        # 응답 생성
        return AlarmAnalyzeResponse(
            success=True,
            message="알람 분석 완료",
            alarm_date=result['alarm_date'],
            alarm_eqp_id=result['alarm_eqp_id'],
            alarm_kpi=result['alarm_kpi'],
            root_causes=[
                RootCause(**cause) for cause in result['root_causes']
            ],
            selected_cause=RootCause(**result['selected_cause']),
            final_report=result['final_report'],
            report_id=result['report_id'],
            rag_saved=result.get('rag_saved', False),
            llm_calls=result['metadata']['llm_calls'],
            processing_time=processing_time
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"알람 분석 실패: {str(e)}"
        )


@router.get(
    "/latest",
    response_model=LatestAlarmResponse,
    summary="최신 알람 조회",
    description="가장 최근의 알람 정보를 조회합니다."
)
async def get_latest():
    """
    최신 알람 조회 API
    
    가장 최근에 발생한 알람의 기본 정보를 반환합니다.
    """
    
    try:
        latest = get_latest_alarm()
        
        if not latest:
            raise HTTPException(status_code=404, detail="알람을 찾을 수 없습니다")
        
        return LatestAlarmResponse(
            success=True,
            date=latest['date'],
            eqp_id=latest['eqp_id'],
            kpi=latest.get('kpi')  # alarm_kpi는 Node 2에서 결정 (여기선 None)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"최신 알람 조회 실패: {str(e)}"
        )


@router.post(
    "/phase1",
    response_model=AlarmPhase1Response,
    summary="알람 분석 Phase 1 (근본 원인 후보 조회)",
    description="알람을 분석하여 근본 원인 후보 목록을 반환합니다. 사용자가 원인을 선택한 후 /phase2를 호출하세요."
)
async def analyze_phase1(request: AlarmAnalyzeRequest):
    """
    알람 분석 Phase 1 API

    - Nodes 1→2→3→6 실행
    - 근본 원인 후보 목록 반환
    - 세션 ID 발급 (30분 유효)
    """

    try:
        start_time = time.time()

        result = run_alarm_analysis_phase1(
            alarm_date=request.alarm_date,
            alarm_eqp_id=request.alarm_eqp_id,
            alarm_kpi=request.alarm_kpi
        )

        if 'error' in result:
            raise HTTPException(status_code=500, detail=result['error'])

        processing_time = time.time() - start_time

        return AlarmPhase1Response(
            success=True,
            message="근본 원인 분석 완료. 원인을 선택 후 /phase2를 호출하세요.",
            session_id=result['session_id'],
            alarm_date=result['alarm_date'],
            alarm_eqp_id=result['alarm_eqp_id'],
            alarm_kpi=result['alarm_kpi'],
            root_causes=[RootCause(**cause) for cause in result['root_causes']],
            llm_calls=result['metadata']['llm_calls'],
            processing_time=processing_time
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Phase 1 분석 실패: {str(e)}"
        )


@router.post(
    "/phase2",
    response_model=AlarmPhase2Response,
    summary="알람 분석 Phase 2 (리포트 생성)",
    description="사용자가 선택한 근본 원인을 바탕으로 최종 리포트를 생성합니다."
)
async def analyze_phase2(request: AlarmSelectRequest):
    """
    알람 분석 Phase 2 API

    - 사용자 선택 반영 (selected_index)
    - Nodes 7→8→9 실행
    - 최종 리포트 생성 및 RAG 저장
    """

    try:
        start_time = time.time()

        result = run_alarm_analysis_phase2(
            session_id=request.session_id,
            selected_index=request.selected_index
        )

        if 'error' in result:
            raise HTTPException(status_code=500, detail=result['error'])

        processing_time = time.time() - start_time

        return AlarmPhase2Response(
            success=True,
            message="최종 리포트 생성 완료",
            alarm_date=result['alarm_date'],
            alarm_eqp_id=result['alarm_eqp_id'],
            alarm_kpi=result['alarm_kpi'],
            selected_cause=RootCause(**result['selected_cause']),
            final_report=result['final_report'],
            report_id=result['report_id'],
            rag_saved=result.get('rag_saved', False),
            llm_calls=result['metadata']['llm_calls'],
            processing_time=processing_time
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Phase 2 리포트 생성 실패: {str(e)}"
        )