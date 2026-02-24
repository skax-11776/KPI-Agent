"""
backend/api/routes/supabase.py
Supabase 데이터 조회 API
"""
from fastapi import APIRouter, Query
from typing import Optional
from backend.config.supabase_config import supabase_config

router = APIRouter(tags=["Supabase"])

# KPI_DAILY 조회
@router.get("/kpi-daily")
async def get_kpi_daily(date: Optional[str] = None, eqp_id: Optional[str] = None):
    try:
        data = supabase_config.get_kpi_daily(date=date, eqp_id=eqp_id)
        return {"success": True, "data": data, "count": len(data)}
    except Exception as e:
        return {"success": False, "error": str(e), "data": []}

# SCENARIO_MAP 조회 (알람 목록)
@router.get("/scenario-map")
async def get_scenario_map(date: Optional[str] = None):
    try:
        data = supabase_config.get_scenario_map(date=date)
        return {"success": True, "data": data, "count": len(data)}
    except Exception as e:
        return {"success": False, "error": str(e), "data": []}

# LOT_STATE 조회
@router.get("/lot-state")
async def get_lot_state(
    eqp_id: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None
):
    try:
        data = supabase_config.get_lot_state(
            start_time=start_time, end_time=end_time, eqp_id=eqp_id
        )
        return {"success": True, "data": data, "count": len(data)}
    except Exception as e:
        return {"success": False, "error": str(e), "data": []}

# EQP_STATE 조회
@router.get("/eqp-state")
async def get_eqp_state(
    eqp_id: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None
):
    try:
        data = supabase_config.get_eqp_state(
            start_time=start_time, end_time=end_time, eqp_id=eqp_id
        )
        return {"success": True, "data": data, "count": len(data)}
    except Exception as e:
        return {"success": False, "error": str(e), "data": []}

# RCP_STATE 조회
@router.get("/rcp-state")
async def get_rcp_state(eqp_id: Optional[str] = None):
    try:
        data = supabase_config.get_rcp_state(eqp_id=eqp_id)
        return {"success": True, "data": data, "count": len(data)}
    except Exception as e:
        return {"success": False, "error": str(e), "data": []}

# 대시보드용 최신 KPI 요약
@router.get("/dashboard-summary")
async def get_dashboard_summary():
    """
    대시보드 상단 KPI 카드용 최신 데이터 반환
    alarm_flag=1인 가장 최근 데이터 기준
    """
    try:
        # 전체 KPI 데이터 조회
        all_kpi = supabase_config.get_kpi_daily()
        
        if not all_kpi:
            return {"success": False, "error": "데이터 없음"}

        # 가장 최근 날짜 데이터
        latest = sorted(all_kpi, key=lambda x: x['date'], reverse=True)[0]
        
        # 알람 발생 건수
        alarm_count = sum(1 for k in all_kpi if k.get('alarm_flag') == 1)
        
        return {
            "success": True,
            "latest": {
                "date": latest['date'],
                "eqp_id": latest['eqp_id'],
                "oee_v": latest.get('oee_v'),
                "oee_t": latest.get('oee_t'),
                "thp_v": latest.get('thp_v'),
                "thp_t": latest.get('thp_t'),
                "tat_v": latest.get('tat_v'),
                "tat_t": latest.get('tat_t'),
                "wip_v": latest.get('wip_v'),
                "wip_t": latest.get('wip_t'),
                "alarm_flag": latest.get('alarm_flag'),
            },
            "alarm_count": alarm_count,
            "total_count": len(all_kpi),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}