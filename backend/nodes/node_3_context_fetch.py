"""
Node 3: Context Fetch
알람 분석에 필요한 모든 컨텍스트 데이터를 조회합니다.

조회 데이터:
1. LOT_STATE: 로트 상태 이력
2. EQP_STATE: 장비 상태 이력 (다운타임)
3. RCP_STATE: 레시피 정보

출력:
- lot_data: 로트 상태 데이터 리스트
- eqp_data: 장비 상태 데이터 리스트
- rcp_data: 레시피 정보 리스트
- context_text: LLM에 제공할 포맷팅된 텍스트
"""

import sys
from pathlib import Path

# 프로젝트 루트 경로 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.config.supabase_config import supabase_config
from backend.utils.date_utils import get_time_window
from backend.utils.data_utils import format_context_data


def node_3_context_fetch(state: dict) -> dict:
    """
    알람 분석에 필요한 컨텍스트 데이터를 조회합니다.
    
    알람 발생 시점을 중심으로 전후 데이터를 수집합니다.
    - 시간 윈도우: 알람 발생 전후 각 12시간 (총 24시간)
    
    Args:
        state: 현재 Agent State
            - alarm_date: 알람 날짜
            - alarm_eqp_id: 장비 ID
            - kpi_data: KPI 데이터
    
    Returns:
        dict: 업데이트할 State
            - lot_data: 로트 상태 데이터
            - eqp_data: 장비 상태 데이터
            - rcp_data: 레시피 정보
            - context_text: 포맷팅된 컨텍스트
            - error: 에러 메시지 (실패 시)
    """
    
    print("\n" + "=" * 60)
    print("- [Node 3] Context Fetch 실행")
    print("=" * 60)
    
    # 1. State에서 필요한 정보 가져오기
    alarm_date = state.get('alarm_date')
    alarm_eqp_id = state.get('alarm_eqp_id')
    kpi_data = state.get('kpi_data')
    
    if not alarm_date or not alarm_eqp_id or not kpi_data:
        error_msg = "필수 정보 누락 (alarm_date, alarm_eqp_id, kpi_data)"
        print(f"- {error_msg}")
        return {'error': error_msg}
    
    print(f"- 알람 날짜: {alarm_date}")
    print(f"- 장비 ID: {alarm_eqp_id}")
    
    # 2. 시간 윈도우 계산
    # 알람 날짜의 정오(12:00)를 중심으로 전후 12시간
    center_time = f"{alarm_date} 12:00:00"
    start_time, end_time = get_time_window(
        center_time=center_time,
        hours_before=12,
        hours_after=12
    )
    
    print(f"⏰ 조회 시간 범위: {start_time} ~ {end_time}")
    
    # 3. LOT_STATE 조회
    print(f"\n- LOT_STATE 조회 중...")
    try:
        lot_data = supabase_config.get_lot_state(
            start_time=start_time,
            end_time=end_time,
            eqp_id=alarm_eqp_id
        )
        print(f"   - {len(lot_data)}개 로트 이벤트 조회")
        
    except Exception as e:
        print(f"   - LOT_STATE 조회 실패: {e}")
        lot_data = []
    
    # 4. EQP_STATE 조회
    print(f"- EQP_STATE 조회 중...")
    try:
        eqp_data = supabase_config.get_eqp_state(
            start_time=start_time,
            end_time=end_time,
            eqp_id=alarm_eqp_id
        )
        print(f"   - {len(eqp_data)}개 장비 상태 이벤트 조회")
        
        # 다운타임 정보 출력
        downtime_count = sum(1 for e in eqp_data if e.get('eqp_state') == 'DOWN')
        if downtime_count > 0:
            print(f"   - 다운타임 발생: {downtime_count}회")
        
    except Exception as e:
        print(f"   - EQP_STATE 조회 실패: {e}")
        eqp_data = []
    
    # 5. RCP_STATE 조회
    print(f"- RCP_STATE 조회 중...")
    try:
        rcp_data = supabase_config.get_rcp_state(eqp_id=alarm_eqp_id)
        print(f"   - {len(rcp_data)}개 레시피 정보 조회")
        
        # 복잡도 정보 출력
        if rcp_data:
            complexities = [r.get('complex_level', 0) for r in rcp_data]
            avg_complexity = sum(complexities) / len(complexities)
            max_complexity = max(complexities)
            print(f"   - 레시피 복잡도: 평균 {avg_complexity:.1f}, 최대 {max_complexity}")
        
    except Exception as e:
        print(f"   - RCP_STATE 조회 실패: {e}")
        rcp_data = []
    
    # 6. 컨텍스트 텍스트 생성
    print(f"\n- 컨텍스트 텍스트 생성 중...")
    try:
        context_text = format_context_data(
            kpi_data=kpi_data,
            lot_data=lot_data,
            eqp_data=eqp_data,
            rcp_data=rcp_data
        )
        print(f"   - 컨텍스트 생성 완료 ({len(context_text)}자)")
        
    except Exception as e:
        error_msg = f"컨텍스트 생성 실패: {e}"
        print(f"   - {error_msg}")
        return {'error': error_msg}
    
    # 7. 요약 정보 출력
    print(f"\n- 수집 데이터 요약:")
    print(f"   - 로트 이벤트: {len(lot_data)}개")
    print(f"   - 장비 상태 변경: {len(eqp_data)}개")
    print(f"   - 레시피 정보: {len(rcp_data)}개")
    print(f"   - 컨텍스트 크기: {len(context_text)}자")
    
    print("=" * 60 + "\n")
    
    # 8. State 업데이트
    return {
        'lot_data': lot_data,
        'eqp_data': eqp_data,
        'rcp_data': rcp_data,
        'context_text': context_text
    }