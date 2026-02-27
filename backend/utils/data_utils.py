"""
데이터 처리 및 분석 유틸리티 함수
"""

from typing import Dict, List, Any, Tuple

def get_latest_alarm():
    """
    가장 최근의 알람 정보를 조회합니다.

    kpi_daily 테이블에서 alarm_flag=1인 가장 최신 레코드를 찾습니다.
    alarm_kpi는 Node 2에서 실제 KPI 이탈률을 계산하여 결정합니다.

    Returns:
        dict | None: 최신 알람 정보
            - date: 날짜
            - eqp_id: 장비 ID
    """
    from backend.config.supabase_config import supabase_config

    result = supabase_config.client.table('kpi_daily') \
        .select('date, eqp_id') \
        .eq('alarm_flag', 1) \
        .order('date', desc=True) \
        .limit(1) \
        .execute()

    if not result.data:
        return None

    latest = result.data[0]

    return {
        'date': latest['date'],
        'eqp_id': latest['eqp_id'],
    }

def check_alarm_condition(
    kpi_name: str,
    target_value: float,
    actual_value: float
) -> Tuple[bool, str]:
    """
    KPI가 알람 조건을 만족하는지 확인합니다.
    
    Args:
        kpi_name: KPI 이름 (OEE, THP, TAT, WIP)
        target_value: 목표 값
        actual_value: 실제 값
    
    Returns:
        Tuple[bool, str]: (알람 여부, 알람 사유)
    
    Examples:
        >>> check_alarm_condition("OEE", 70, 53.51)
        (True, "OEE가 목표치보다 16.49% 낮습니다 (목표: 70.0%, 실제: 53.51%)")
    """
    alarm = False
    reason = ""
    
    if kpi_name == "OEE":
        # OEE: 낮을수록 나쁨 (목표보다 낮으면 알람)
        if actual_value < target_value:
            gap = target_value - actual_value
            alarm = True
            reason = f"OEE가 목표치보다 {gap:.2f}% 낮습니다 (목표: {target_value}%, 실제: {actual_value}%)"
    
    elif kpi_name == "THP":
        # Throughput: 낮을수록 나쁨 (목표보다 낮으면 알람)
        if actual_value < target_value:
            gap = target_value - actual_value
            alarm = True
            reason = f"처리량이 목표보다 {gap:.0f}개 부족합니다 (목표: {target_value}개, 실제: {actual_value}개)"
    
    elif kpi_name == "TAT":
        # Turn Around Time: 높을수록 나쁨 (목표보다 높으면 알람)
        if actual_value > target_value:
            gap = actual_value - target_value
            alarm = True
            reason = f"처리 시간이 목표보다 {gap:.2f}시간 초과했습니다 (목표: {target_value}h, 실제: {actual_value}h)"
    
    elif kpi_name == "WIP_EXCEED":
        # WIP 초과: 목표보다 많으면 알람
        if actual_value > target_value:
            gap = actual_value - target_value
            alarm = True
            reason = f"재공품이 목표보다 {gap:.0f}개 초과했습니다 (목표: {target_value}개, 실제: {actual_value}개)"
    
    elif kpi_name == "WIP_SHORTAGE":
        # WIP 부족: 목표보다 적으면 알람
        if actual_value < target_value:
            gap = target_value - actual_value
            alarm = True
            reason = f"재공품이 목표보다 {gap:.0f}개 부족합니다 (목표: {target_value}개, 실제: {actual_value}개)"
    
    return alarm, reason


def calculate_kpi_gap(
    kpi_name: str,
    target_value: float,
    actual_value: float
) -> Dict[str, Any]:
    """
    KPI의 목표 대비 차이를 계산합니다.
    
    Args:
        kpi_name: KPI 이름
        target_value: 목표 값
        actual_value: 실제 값
    
    Returns:
        Dict: KPI 갭 정보
            - gap: 절대 차이
            - gap_percent: 퍼센트 차이
            - status: 상태 (good/warning/alarm)
    
    Examples:
        >>> calculate_kpi_gap("OEE", 70, 53.51)
        {'gap': -16.49, 'gap_percent': -23.56, 'status': 'alarm'}
    """
    # 절대 차이 계산
    gap = actual_value - target_value
    
    # 퍼센트 차이 계산
    if target_value != 0:
        gap_percent = (gap / target_value) * 100
    else:
        gap_percent = 0
    
    # 상태 판단
    if kpi_name in ["OEE", "THP"]:
        # 높을수록 좋은 KPI
        if gap >= 0:
            status = "good"
        elif gap > -target_value * 0.1:  # -10% 이내
            status = "warning"
        else:
            status = "alarm"
    
    elif kpi_name == "TAT":
        # 낮을수록 좋은 KPI
        if gap <= 0:
            status = "good"
        elif gap < target_value * 0.1:  # +10% 이내
            status = "warning"
        else:
            status = "alarm"
    
    else:
        # WIP 등
        status = "good" if abs(gap) < target_value * 0.1 else "alarm"
    
    return {
        'gap': gap,
        'gap_percent': gap_percent,
        'status': status
    }


def aggregate_lot_states(lot_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    로트 상태 데이터를 집계합니다.
    
    Args:
        lot_data: LOT_STATE 테이블 데이터 리스트
    
    Returns:
        Dict: 집계 결과
            - total_lots: 총 로트 수
            - state_counts: 상태별 개수
            - hold_count: HOLD 상태 발생 횟수
            - avg_in_cnt: 평균 투입 수량
    
    Examples:
        >>> lot_data = [
        ...     {'lot_state': 'RUN', 'in_cnt': 25},
        ...     {'lot_state': 'HOLD', 'in_cnt': 25}
        ... ]
        >>> aggregate_lot_states(lot_data)
        {'total_lots': 2, 'state_counts': {'RUN': 1, 'HOLD': 1}, ...}
    """
    if not lot_data:
        return {
            'total_lots': 0,
            'state_counts': {},
            'hold_count': 0,
            'avg_in_cnt': 0
        }
    
    # 상태별 개수 집계
    state_counts = {}
    total_in_cnt = 0
    
    for lot in lot_data:
        state = lot.get('lot_state', 'UNKNOWN')
        state_counts[state] = state_counts.get(state, 0) + 1
        total_in_cnt += lot.get('in_cnt', 0)
    
    return {
        'total_lots': len(lot_data),
        'state_counts': state_counts,
        'hold_count': state_counts.get('HOLD', 0),
        'avg_in_cnt': total_in_cnt / len(lot_data) if lot_data else 0
    }


def get_downtime_info(eqp_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    장비 다운타임 정보를 추출합니다.
    
    Args:
        eqp_data: EQP_STATE 테이블 데이터 리스트
    
    Returns:
        Dict: 다운타임 정보
            - total_downtime_hours: 총 다운타임 (시간)
            - downtime_count: 다운타임 발생 횟수
            - downtime_events: 다운타임 이벤트 리스트
    
    Examples:
        >>> eqp_data = [
        ...     {'eqp_state': 'DOWN', 'event_time': '2026-01-20 01:25', 'end_time': '2026-01-20 04:25'}
        ... ]
        >>> get_downtime_info(eqp_data)
        {'total_downtime_hours': 3.0, 'downtime_count': 1, ...}
    """
    from .date_utils import calculate_duration
    
    downtime_events = []
    total_hours = 0
    
    for event in eqp_data:
        if event.get('eqp_state') == 'DOWN':
            start = event.get('event_time')
            end = event.get('end_time')
            
            if start and end:
                # 다운타임 시간 계산
                duration = calculate_duration(start, end)
                total_hours += duration
                
                downtime_events.append({
                    'start_time': start,
                    'end_time': end,
                    'duration_hours': duration
                })
    
    return {
        'total_downtime_hours': total_hours,
        'downtime_count': len(downtime_events),
        'downtime_events': downtime_events
    }


def format_context_data(
    kpi_data: Dict[str, Any],
    lot_data: List[Dict[str, Any]],
    eqp_data: List[Dict[str, Any]],
    rcp_data: List[Dict[str, Any]],
    trend_data: List[Dict[str, Any]] = None
) -> str:
    """
    LLM에 제공할 컨텍스트 데이터를 포맷팅합니다.

    Args:
        kpi_data: KPI 데이터
        lot_data: 로트 데이터
        eqp_data: 장비 데이터
        rcp_data: 레시피 데이터
        trend_data: 직전 N일 KPI 추세 데이터 (선택)

    Returns:
        str: 포맷팅된 컨텍스트 문자열
    """
    # 로트 집계
    lot_summary = aggregate_lot_states(lot_data)

    # 다운타임 정보
    downtime_info = get_downtime_info(eqp_data)

    # 텍스트로 포맷팅
    context = f"""
# 분석 컨텍스트 데이터

## 1. KPI 정보
- 날짜: {kpi_data.get('date')}
- 장비: {kpi_data.get('eqp_id')}
- 라인: {kpi_data.get('line_id')}
- 공정: {kpi_data.get('oper_id')}

## 2. KPI 수치 (알람 당일)
- OEE: {kpi_data.get('oee_v')}% (목표: {kpi_data.get('oee_t')}%)
- Throughput: {kpi_data.get('thp_v')}개 (목표: {kpi_data.get('thp_t')}개)
- TAT: {kpi_data.get('tat_v')}시간 (목표: {kpi_data.get('tat_t')}시간)
- WIP: {kpi_data.get('wip_v')}개 (목표: {kpi_data.get('wip_t')}개)
- 양품 출하: {kpi_data.get('good_out_qty')}개

## 3. 로트 상태 요약
- 총 로트 수: {lot_summary['total_lots']}개
- 상태별 분포: {lot_summary['state_counts']}
- HOLD 발생: {lot_summary['hold_count']}회

## 4. 장비 다운타임
- 총 다운타임: {downtime_info['total_downtime_hours']:.2f}시간
- 발생 횟수: {downtime_info['downtime_count']}회

## 5. 레시피 정보
"""

    for rcp in rcp_data:
        context += f"- {rcp.get('rcp_id')}: 복잡도 {rcp.get('complex_level')}/10\n"

    # 추세 데이터 섹션 (있는 경우만 추가)
    if trend_data:
        context += "\n## 6. KPI 추세 (직전 7일)\n"
        context += "| 날짜 | OEE(%) | THP(개) | TAT(h) | WIP(개) | 알람 |\n"
        context += "|------|--------|---------|--------|---------|------|\n"
        for row in trend_data:
            alarm_mark = "Y" if row.get('alarm_flag') == 1 else "-"
            context += (
                f"| {row.get('date', '-')} "
                f"| {row.get('oee_v', '-')} "
                f"| {row.get('thp_v', '-')} "
                f"| {row.get('tat_v', '-')} "
                f"| {row.get('wip_v', '-')} "
                f"| {alarm_mark} |\n"
            )

    return context