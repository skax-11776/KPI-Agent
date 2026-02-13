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
    print("📊 [Node 2] Load Alarm KPI 실행")
    print("=" * 60)
    
    # 1. State에서 알람 정보 가져오기
    alarm_date = state.get('alarm_date')
    alarm_eqp_id = state.get('alarm_eqp_id')
    alarm_kpi = state.get('alarm_kpi')
    
    print(f"📅 알람 날짜: {alarm_date}")
    print(f"🔧 장비 ID: {alarm_eqp_id}")
    print(f"📈 KPI: {alarm_kpi}")
    
    # 2. 필수 정보 검증
    if not alarm_date or not alarm_eqp_id:
        error_msg = "알람 정보가 누락되었습니다 (날짜 또는 장비 ID)"
        print(f"❌ {error_msg}")
        return {'error': error_msg}
    
    # 3. KPI_DAILY 테이블에서 데이터 조회
    print(f"\n🔍 KPI_DAILY 테이블 조회 중...")
    
    try:
        kpi_data_list = supabase_config.get_kpi_daily(
            date=alarm_date,
            eqp_id=alarm_eqp_id
        )
        
        if not kpi_data_list:
            error_msg = f"KPI 데이터를 찾을 수 없습니다 (날짜: {alarm_date}, 장비: {alarm_eqp_id})"
            print(f"❌ {error_msg}")
            return {'error': error_msg}
        
        # 첫 번째 결과 사용 (날짜+장비로 조회하면 보통 1개)
        kpi_data = kpi_data_list[0]
        
        print(f"✅ KPI 데이터 조회 성공")
        
    except Exception as e:
        error_msg = f"KPI 데이터 조회 실패: {str(e)}"
        print(f"❌ {error_msg}")
        return {'error': error_msg}
    
    # 4. KPI 값 출력 (디버깅)
    print(f"\n📊 KPI 상세 정보:")
    print(f"   - 날짜: {kpi_data.get('date')}")
    print(f"   - 장비: {kpi_data.get('eqp_id')}")
    print(f"   - 라인: {kpi_data.get('line_id')}")
    print(f"   - 공정: {kpi_data.get('oper_id')}")
    print(f"   - OEE: {kpi_data.get('oee_v')}% (목표: {kpi_data.get('oee_t')}%)")
    print(f"   - THP: {kpi_data.get('thp_v')}개 (목표: {kpi_data.get('thp_t')}개)")
    print(f"   - TAT: {kpi_data.get('tat_v')}h (목표: {kpi_data.get('tat_t')}h)")
    print(f"   - WIP: {kpi_data.get('wip_v')}개 (목표: {kpi_data.get('wip_t')}개)")
    print(f"   - 알람 플래그: {kpi_data.get('alarm_flag')}")
    
    # 5. 알람 조건 확인 (검증)
    if alarm_kpi:
        print(f"\n🔍 알람 조건 검증:")
        
        # KPI 이름에 따라 적절한 값 추출
        if alarm_kpi == 'OEE':
            target = kpi_data.get('oee_t')
            actual = kpi_data.get('oee_v')
        elif alarm_kpi == 'THP':
            target = kpi_data.get('thp_t')
            actual = kpi_data.get('thp_v')
        elif alarm_kpi == 'TAT':
            target = kpi_data.get('tat_t')
            actual = kpi_data.get('tat_v')
        else:  # WIP
            target = kpi_data.get('wip_t')
            actual = kpi_data.get('wip_v')
        
        # 알람 조건 체크
        alarm_triggered, reason = check_alarm_condition(
            kpi_name=alarm_kpi,
            target_value=target,
            actual_value=actual
        )
        
        if alarm_triggered:
            print(f"   ✅ {reason}")
        else:
            print(f"   ⚠️ 알람 조건 미충족: 목표 {target}, 실제 {actual}")
    
    print("=" * 60 + "\n")
    
    # 6. State 업데이트
    return {
        'kpi_data': kpi_data
    }