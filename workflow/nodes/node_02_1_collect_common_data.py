"""
노드 2-1 : 공통 데이터 수집

역할:
    - 모든 KPI 분석에 필요한 기본 데이터 수집
    - KPI 종류와 무관하게 동일한 데이터 수집
    - 빠른 조회를 위해 필수 데이터
"""

from workflow.state import AnalysisState
from config.settings import sb
from typing import Dict, Any, List
from datetime import date, timedelta

def collect_common_data(state : AnalysisState) -> AnalysisState:
    """
    공통 데이터 수집 노드

    Input:
        - alarm_cases : 알람 케이스 리스트
        - check_date : 분석 대상 날짜

    Output:
        -
    """
    alarm_cases = state["alarm_cases"]
    check_date = state["check_date"]

    print(f"[노드 2-1] 공통 데이터 수집 시작")

    target_eqps = get_target_equipment(alarm_cases)

    print(f"- 설비 : {','.join(target_eqps)}")

    start_date = check_date - timedelta(days = 3)
    end_date = check_date

    common_data = {}

    # common_data["kpi_daily"] = fetch_kpi_daily(target_eqps, start_date, end_date)
    # common_data["lot_state"] = fetch_lot_state(target_eqps, start_date, end_date)
    # common_data["eqp_state"] = fetch_eqp_state(target_eqps, start_date, end_date)

    print(f"- kpi_daily_data : {len(common_data['kpi_daily'])}건")
    print(f"- lot_state_data : {len(common_data['lot_state'])}건")
    print(f"- eqp_state_data : {len(common_data['eqp_state'])}건")

    return {"common_data" : common_data}


def get_target_equipment(alarm_cases : List[Dict]) -> List[Dict]:
    """
    알람 발생 설비 ID 리스트 추출

    Args:
        - alarm_cases : [{"eqp_id": "EQP01", ...}, ...]
    
    Returns:
        - ["EQP01", "EQP03", ...]
    """
    eqp_ids = [case["eqp_id"] for case in alarm_cases]
    unique_eqps = sorted(list(set(eqp_ids)))
    unique_eqps.sort()

    return unique_eqps


def fetch_kpi_daily(eqp_ids : List[str], start_date : date, end_date : date) -> List[Dict[str, Any]]:
    """
    KPI_DAILY 테이블 조회

    컬럼:
        - date: 날짜
        - eqp_id: 설비 ID
        - line_id: 라인 ID
        - oper_id: 공정 ID
    """
    response = sb.table("kpi_daily").select(
    "date, eqp_id, line_id, oper_id").in_(
        "eqp_id", eqp_ids).gte("date", start_date.strftime("%Y-%m-%d")).lte(
            "date", end_date.strftime("%Y-%m-%d")).execute()
    
    return response.data


def fetch_lot_state(eqp_ids : List[str], start_date : date, end_date : date) -> List[Dict[str, Any]]:
    """
    lot_state 테이블 조회

    컬럼:
        - event_time : 이벤트 발생 시각
        - lot_id : LOT ID
        - line_id : 라인 ID
        - oper_id : 공정 ID
        - eqp_id : 설비 ID
        - lot_state : LOT 상태 (WAIT, RUN, HOLD, END)
    """
    response = sb.table("lot_state").select(
    "event_time, lot_id, line_id, oper_id, eqp_id, lot_state").in_(
        "eqp_id", eqp_ids).gte("event_time", start_date.strftime("%Y-%m-%d")).lte(
            "event_time", end_date.strftime("%Y-%m-%d")).execute()
    
    return response.data


def fetch_eqp_state(eqp_ids : List[str], start_date : date, end_date : date) -> List[Dict[str, Any]]:
    """
    eqp_state 테이블 조회

    컬럼:
        - event_time : 이벤트 발생 시각
        - eqp_id : 설비 ID
        - eqp_state : 설비 상태(RUN, DOWN, IDLE)
    """
    response = sb.table("eqp_state").select(
    "event_time, eqp_id, eqp_state").in_(
        "eqp_id", eqp_ids).gte("event_time", start_date.strftime("%Y-%m-%d")).lte(
            "event_time", end_date.strftime("%Y-%m-%d")).execute()
    
    return response.data