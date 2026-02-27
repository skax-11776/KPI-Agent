"""
Node 2: Load Alarm KPI
알람 발생 시점의 KPI 데이터를 조회합니다.

입력:
- alarm_date: 알람 날짜
- alarm_eqp_id: 알람 장비 ID

출력:
- kpi_data: KPI_DAILY 테이블 데이터
"""

import sys
from pathlib import Path

# 프로젝트 루트 경로 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.config.supabase_config import supabase_config
from backend.utils.data_utils import check_alarm_condition


def node_2_load_alarm_kpi(state: dict) -> dict:
    """
    알람 발생 시점의 KPI 데이터를 조회합니다.
    
    Args:
        state: 현재 Agent State
            - alarm_date: 알람 날짜 (YYYY-MM-DD)
            - alarm_eqp_id: 장비 ID
            - alarm_kpi: KPI 이름
    
    Returns:
        dict: 업데이트할 State
            - kpi_data: KPI_DAILY 테이블 데이터
            - error: 에러 메시지 (실패 시)
    
    Raises:
        조회 실패 시 error 필드에 메시지 저장
    """
    
    print("\n" + "=" * 60)
    print("[Node 2] Load Alarm KPI 실행")
    print("=" * 60)
    
    # 1. State에서 알람 정보 가져오기
    alarm_date = state.get('alarm_date')
    alarm_eqp_id = state.get('alarm_eqp_id')
    alarm_kpi = state.get('alarm_kpi')
    
    print(f"알람 날짜: {alarm_date}")
    print(f"장비 ID: {alarm_eqp_id}")
    print(f"KPI: {alarm_kpi}")
    
    # 2. 필수 정보 검증
    if not alarm_date or not alarm_eqp_id:
        error_msg = "알람 정보가 누락되었습니다 (날짜 또는 장비 ID)"
        print(f"[ERROR] {error_msg}")
        return {'error': error_msg}
    
    # 3. KPI_DAILY 테이블에서 데이터 조회
    print(f"\nKPI_DAILY 테이블 조회 중...")
    
    try:
        kpi_data_list = supabase_config.get_kpi_daily(
            date=alarm_date,
            eqp_id=alarm_eqp_id
        )
        
        if not kpi_data_list:
            error_msg = f"KPI 데이터를 찾을 수 없습니다 (날짜: {alarm_date}, 장비: {alarm_eqp_id})"
            print(f"[ERROR] {error_msg}")
            return {'error': error_msg}
        
        # 첫 번째 결과 사용 (날짜+장비로 조회하면 보통 1개)
        kpi_data = kpi_data_list[0]
        
        print(f"KPI 데이터 조회 성공")
        
    except Exception as e:
        error_msg = f"KPI 데이터 조회 실패: {str(e)}"
        print(f"[ERROR] {error_msg}")
        return {'error': error_msg}
    
    # 4. KPI 값 출력 (디버깅)
    print(f"\nKPI 상세 정보:")
    print(f"   - 날짜: {kpi_data.get('date')}")
    print(f"   - 장비: {kpi_data.get('eqp_id')}")
    print(f"   - 라인: {kpi_data.get('line_id')}")
    print(f"   - 공정: {kpi_data.get('oper_id')}")
    print(f"   - OEE: {kpi_data.get('oee_v')}% (목표: {kpi_data.get('oee_t')}%)")
    print(f"   - THP: {kpi_data.get('thp_v')}개 (목표: {kpi_data.get('thp_t')}개)")
    print(f"   - TAT: {kpi_data.get('tat_v')}h (목표: {kpi_data.get('tat_t')}h)")
    print(f"   - WIP: {kpi_data.get('wip_v')}개 (목표: {kpi_data.get('wip_t')}개)")
    print(f"   - 알람 플래그: {kpi_data.get('alarm_flag')}")
    
    # 5. alarm_kpi 결정
    #    - 외부에서 이미 지정된 경우 그대로 사용
    #    - 없는 경우 kpi_data의 이탈률로 자동 판단
    if not alarm_kpi:
        alarm_kpi = _detect_alarm_kpi(kpi_data)
        print(f"\nalarm_kpi 자동 판단: {alarm_kpi}")
    else:
        print(f"\nalarm_kpi 지정값 사용: {alarm_kpi}")

    # 6. 알람 조건 검증 (판단된 KPI 기준)
    print(f"알람 조건 검증:")

    kpi_values = {
        'OEE': (kpi_data.get('oee_t'), kpi_data.get('oee_v')),
        'THP': (kpi_data.get('thp_t'), kpi_data.get('thp_v')),
        'TAT': (kpi_data.get('tat_t'), kpi_data.get('tat_v')),
        'WIP': (kpi_data.get('wip_t'), kpi_data.get('wip_v')),
    }
    target, actual = kpi_values.get(alarm_kpi, (None, None))

    if target is not None and actual is not None:
        alarm_triggered, reason = check_alarm_condition(
            kpi_name=alarm_kpi,
            target_value=target,
            actual_value=actual
        )
        if alarm_triggered:
            print(f"   {reason}")
        else:
            print(f"   [WARN] 알람 조건 미충족: 목표 {target}, 실제 {actual}")

    print("=" * 60 + "\n")

    # 7. State 업데이트
    return {
        'kpi_data': kpi_data,
        'alarm_kpi': alarm_kpi,
    }


def _detect_alarm_kpi(kpi_data: dict) -> str:
    """
    kpi_data에서 목표 대비 이탈률이 가장 큰 KPI를 반환합니다.

    - OEE, THP: actual < target 일 때 이탈 (낮을수록 나쁨)
    - TAT, WIP:  actual > target 일 때 이탈 (높을수록 나쁨)

    이탈이 없는 KPI는 후보에서 제외하고,
    모든 KPI가 정상이면 'OEE'를 fallback으로 반환합니다.
    """
    deviations = {}

    oee_t = kpi_data.get('oee_t') or 0
    oee_v = kpi_data.get('oee_v') or 0
    if oee_t and oee_v < oee_t:
        deviations['OEE'] = (oee_t - oee_v) / oee_t

    thp_t = kpi_data.get('thp_t') or 0
    thp_v = kpi_data.get('thp_v') or 0
    if thp_t and thp_v < thp_t:
        deviations['THP'] = (thp_t - thp_v) / thp_t

    tat_t = kpi_data.get('tat_t') or 0
    tat_v = kpi_data.get('tat_v') or 0
    if tat_t and tat_v > tat_t:
        deviations['TAT'] = (tat_v - tat_t) / tat_t

    wip_t = kpi_data.get('wip_t') or 0
    wip_v = kpi_data.get('wip_v') or 0
    if wip_t and wip_v > wip_t:
        deviations['WIP'] = (wip_v - wip_t) / wip_t

    if not deviations:
        print("   [WARN] 이탈 KPI 없음, OEE로 fallback")
        return 'OEE'

    detected = max(deviations, key=lambda k: deviations[k])
    print(f"   이탈률: { {k: f'{v:.1%}' for k, v in deviations.items()} }")
    return detected