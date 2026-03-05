"""
backend/api/routes/supabase.py
Supabase 데이터 조회 API
"""
from fastapi import APIRouter, Query
from typing import Optional
from datetime import date as date_type, timedelta
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

# LOT_STATE 메타데이터 (전체 날짜·EQP 목록)
@router.get("/lot-state/meta")
async def get_lot_state_meta():
    try:
        min_r = supabase_config.client.table('lot_state').select('event_time').order('event_time').limit(1).execute()
        max_r = supabase_config.client.table('lot_state').select('event_time').order('event_time', desc=True).limit(1).execute()
        eqp_r = supabase_config.client.table('lot_state').select('eqp_id').execute()
        dates = []
        if min_r.data and max_r.data:
            d0 = date_type.fromisoformat(min_r.data[0]['event_time'][:10])
            d1 = date_type.fromisoformat(max_r.data[0]['event_time'][:10])
            cur = d0
            while cur <= d1:
                dates.append(str(cur))
                cur += timedelta(days=1)
        eqps = sorted(set(r['eqp_id'] for r in eqp_r.data if r.get('eqp_id')))
        return {"success": True, "dates": dates, "eqps": eqps}
    except Exception as e:
        return {"success": False, "error": str(e), "dates": [], "eqps": []}

# LOT_STATE 조회 (페이징 + 날짜·EQP 필터 지원)
@router.get("/lot-state")
async def get_lot_state(
    eqp_id: Optional[str] = None,
    date: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=1000, ge=1, le=5000),
):
    try:
        offset = (page - 1) * page_size
        query = supabase_config.client.table('lot_state').select('*', count='exact')
        if date:
            query = query.gte('event_time', f"{date} 00:00:00").lte('event_time', f"{date} 23:59:59")
        else:
            if start_time:
                query = query.gte('event_time', start_time)
            if end_time:
                query = query.lte('event_time', end_time)
        if eqp_id:
            query = query.eq('eqp_id', eqp_id)
        result = query.order('event_time').range(offset, offset + page_size - 1).execute()
        total_count = result.count if result.count is not None else 0
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        return {
            "success": True, "data": result.data, "count": len(result.data),
            "total_count": total_count, "page": page, "page_size": page_size, "total_pages": total_pages,
        }
    except Exception as e:
        return {"success": False, "error": str(e), "data": []}

# EQP_STATE 메타데이터 (전체 날짜·EQP 목록)
@router.get("/eqp-state/meta")
async def get_eqp_state_meta():
    try:
        min_r = supabase_config.client.table('eqp_state').select('event_time').order('event_time').limit(1).execute()
        max_r = supabase_config.client.table('eqp_state').select('event_time').order('event_time', desc=True).limit(1).execute()
        eqp_r = supabase_config.client.table('eqp_state').select('eqp_id').execute()
        dates = []
        if min_r.data and max_r.data:
            d0 = date_type.fromisoformat(min_r.data[0]['event_time'][:10])
            d1 = date_type.fromisoformat(max_r.data[0]['event_time'][:10])
            cur = d0
            while cur <= d1:
                dates.append(str(cur))
                cur += timedelta(days=1)
        eqps = sorted(set(r['eqp_id'] for r in eqp_r.data if r.get('eqp_id')))
        return {"success": True, "dates": dates, "eqps": eqps}
    except Exception as e:
        return {"success": False, "error": str(e), "dates": [], "eqps": []}

# EQP_STATE 조회 (페이징 + 날짜·EQP 필터 지원)
@router.get("/eqp-state")
async def get_eqp_state(
    eqp_id: Optional[str] = None,
    date: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=1000, ge=1, le=5000),
):
    try:
        offset = (page - 1) * page_size
        query = supabase_config.client.table('eqp_state').select('*', count='exact')
        if date:
            query = query.gte('event_time', f"{date} 00:00:00").lte('event_time', f"{date} 23:59:59")
        else:
            if start_time:
                query = query.gte('event_time', start_time)
            if end_time:
                query = query.lte('event_time', end_time)
        if eqp_id:
            query = query.eq('eqp_id', eqp_id)
        result = query.order('event_time').range(offset, offset + page_size - 1).execute()
        total_count = result.count if result.count is not None else 0
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        return {
            "success": True, "data": result.data, "count": len(result.data),
            "total_count": total_count, "page": page, "page_size": page_size, "total_pages": total_pages,
        }
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
