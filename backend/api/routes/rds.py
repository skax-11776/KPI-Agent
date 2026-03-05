"""
Amazon RDS 데이터 확인 API
- GET /api/rds/test              → RDS 연결 테스트
- GET /api/rds/scenario-map     → scenario_map 테이블 조회
- GET /api/rds/kpi-daily        → kpi_daily 테이블 조회
- GET /api/rds/kpi-trend        → kpi_daily 날짜 범위 조회
- GET /api/rds/lot-state        → lot_state 테이블 조회
- GET /api/rds/eqp-state        → eqp_state 테이블 조회
- GET /api/rds/rcp-state        → rcp_state 테이블 조회
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

router = APIRouter(prefix="/rds", tags=["RDS"])


def _get_rds():
    """RDS 클라이언트를 lazy 로드합니다 (설정 오류 시 명확한 에러 반환)."""
    try:
        from backend.config.rds_config import rds_config
        return rds_config
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"RDS 설정 오류: {str(e)}")


# ─── GET /api/rds/tables ─────────────────────────────────────────────────────
@router.get("/tables", summary="RDS 테이블 목록 조회")
async def list_tables(
    schema: str = Query("kpi_monitor", description="스키마 이름 (기본: kpi_monitor)"),
):
    """RDS 데이터베이스에 존재하는 모든 테이블 목록을 반환합니다."""
    rds = _get_rds()
    try:
        rows = rds._execute_query(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """,
            (schema,),
        )
        table_names = [r["table_name"] for r in rows]
        return {"success": True, "schema": schema, "count": len(table_names), "tables": table_names}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"조회 실패: {str(e)}")


# ─── GET /api/rds/test ────────────────────────────────────────────────────────
@router.get("/test", summary="RDS 연결 테스트")
async def test_rds_connection():
    """RDS 데이터베이스 연결이 정상인지 확인합니다."""
    rds = _get_rds()
    ok = rds.test_connection()
    if not ok:
        raise HTTPException(
            status_code=503,
            detail="RDS 연결 실패. .env의 RDS_* 값을 확인하세요."
        )
    return {
        "success": True,
        "message": "RDS 연결 성공",
        "host": rds.host,
        "database": rds.database,
    }


# ─── GET /api/rds/scenario-map ───────────────────────────────────────────────
@router.get("/scenario-map", summary="알람 시나리오 맵 조회")
async def get_scenario_map(
    date: Optional[str] = Query(None, description="날짜 필터 (YYYY-MM-DD)"),
):
    """
    scenario_map 테이블을 조회합니다.

    - **date**: 특정 날짜만 조회 (미입력 시 전체)
    """
    rds = _get_rds()
    try:
        rows = rds.get_scenario_map(date=date)
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"조회 실패: {str(e)}")


# ─── GET /api/rds/kpi-daily ──────────────────────────────────────────────────
@router.get("/kpi-daily", summary="일별 KPI 조회")
async def get_kpi_daily(
    date: Optional[str] = Query(None, description="날짜 (YYYY-MM-DD)"),
    eqp_id: Optional[str] = Query(None, description="장비 ID (예: EQP01)"),
):
    """
    kpi_daily 테이블을 조회합니다.

    - **date**: 특정 날짜 필터
    - **eqp_id**: 장비 ID 필터
    """
    rds = _get_rds()
    try:
        rows = rds.get_kpi_daily(date=date, eqp_id=eqp_id)
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"조회 실패: {str(e)}")


# ─── GET /api/rds/kpi-trend ──────────────────────────────────────────────────
@router.get("/kpi-trend", summary="KPI 추세 (날짜 범위) 조회")
async def get_kpi_trend(
    start_date: str = Query(..., description="시작 날짜 (YYYY-MM-DD)"),
    end_date: str = Query(..., description="종료 날짜 (YYYY-MM-DD)"),
    eqp_id: Optional[str] = Query(None, description="장비 ID (예: EQP01)"),
):
    """
    kpi_daily 테이블에서 날짜 범위의 KPI 추세를 조회합니다.

    - **start_date** / **end_date**: 조회 기간 (필수)
    - **eqp_id**: 장비 ID 필터 (선택)
    """
    rds = _get_rds()
    try:
        rows = rds.get_kpi_trend(start_date=start_date, end_date=end_date, eqp_id=eqp_id)
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"조회 실패: {str(e)}")


# ─── GET /api/rds/lot-state ──────────────────────────────────────────────────
@router.get("/lot-state", summary="로트 상태 이력 조회")
async def get_lot_state(
    start_time: Optional[str] = Query(None, description="시작 시간 (YYYY-MM-DD HH:MM)"),
    end_time: Optional[str] = Query(None, description="종료 시간 (YYYY-MM-DD HH:MM)"),
    eqp_id: Optional[str] = Query(None, description="장비 ID"),
):
    """
    lot_state 테이블을 조회합니다.

    - **start_time** / **end_time**: 시간 범위 필터
    - **eqp_id**: 장비 ID 필터
    """
    rds = _get_rds()
    try:
        rows = rds.get_lot_state(start_time=start_time, end_time=end_time, eqp_id=eqp_id)
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"조회 실패: {str(e)}")


# ─── GET /api/rds/eqp-state ──────────────────────────────────────────────────
@router.get("/eqp-state", summary="장비 상태 이력 조회")
async def get_eqp_state(
    start_time: Optional[str] = Query(None, description="시작 시간 (YYYY-MM-DD HH:MM)"),
    end_time: Optional[str] = Query(None, description="종료 시간 (YYYY-MM-DD HH:MM)"),
    eqp_id: Optional[str] = Query(None, description="장비 ID"),
):
    """
    eqp_state 테이블을 조회합니다.

    - **start_time** / **end_time**: 시간 범위 필터
    - **eqp_id**: 장비 ID 필터
    """
    rds = _get_rds()
    try:
        rows = rds.get_eqp_state(start_time=start_time, end_time=end_time, eqp_id=eqp_id)
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"조회 실패: {str(e)}")


# ─── GET /api/rds/rcp-state ──────────────────────────────────────────────────
@router.get("/rcp-state", summary="레시피 상태 조회")
async def get_rcp_state(
    eqp_id: Optional[str] = Query(None, description="장비 ID"),
):
    """
    rcp_state 테이블을 조회합니다.

    - **eqp_id**: 장비 ID 필터
    """
    rds = _get_rds()
    try:
        rows = rds.get_rcp_state(eqp_id=eqp_id)
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"조회 실패: {str(e)}")
