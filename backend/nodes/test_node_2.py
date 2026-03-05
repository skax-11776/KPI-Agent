"""
Node 2: Load Alarm KPI 테스트
"""

import sys
from pathlib import Path

# 프로젝트 루트를 경로에 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.nodes.node_1_input_router import node_1_input_router
from backend.nodes.node_2_load_alarm_kpi import node_2_load_alarm_kpi


def test_load_latest_alarm():
    """최신 알람 KPI 로드 테스트"""
    
    print("\n" + "=" * 60)
    print("최신 알람 KPI 로드 테스트")
    print("=" * 60 + "\n")
    
    # 1. Node 1 실행 (최신 알람 정보 로드)
    print("1. Node 1 실행...")
    state = {'input_type': 'alarm'}
    result1 = node_1_input_router(state)
    
    # State 업데이트
    state.update(result1)
    
    print(f"\nNode 1 결과:")
    print(f"  alarm_date: {state.get('alarm_date')}")
    print(f"  alarm_eqp_id: {state.get('alarm_eqp_id')}")
    print(f"  alarm_kpi: {state.get('alarm_kpi')}")
    
    # 2. Node 2 실행 (KPI 데이터 조회)
    print("\n2. Node 2 실행...")
    result2 = node_2_load_alarm_kpi(state)
    
    # State 업데이트
    state.update(result2)
    
    # 3. 결과 검증
    assert 'error' not in state, f"에러 발생: {state.get('error')}"
    assert state.get('kpi_data') is not None, "KPI 데이터가 없음"
    
    kpi_data = state['kpi_data']
    
    print("\n조회 성공!")
    print(f"   날짜: {kpi_data['date']}")
    print(f"   장비: {kpi_data['eqp_id']}")
    print(f"   라인: {kpi_data['line_id']}")
    
    # 최신 알람은 2026-01-31, EQP12, THP
    assert kpi_data['date'] == '2026-01-31', "날짜 불일치"
    assert kpi_data['eqp_id'] == 'EQP12', "장비 ID 불일치"
    
    print("\n최신 알람 KPI 로드 테스트 통과!\n")


def test_specific_alarm():
    """특정 날짜 알람 테스트"""
    
    print("=" * 60)
    print("특정 날짜 알람 KPI 로드 테스트")
    print("=" * 60 + "\n")
    
    # 과거 알람 지정 (2026-01-20, EQP01, OEE)
    state = {
        'alarm_date': '2026-01-20',
        'alarm_eqp_id': 'EQP01',
        'alarm_kpi': 'OEE'
    }
    
    # Node 2 실행
    result = node_2_load_alarm_kpi(state)
    
    # 검증
    assert 'error' not in result, f"에러 발생: {result.get('error')}"
    assert result.get('kpi_data') is not None, "KPI 데이터가 없음"
    
    kpi_data = result['kpi_data']
    
    print("\n조회 성공!")
    print(f"   OEE: {kpi_data['oee_v']}% (목표: {kpi_data['oee_t']}%)")
    
    # OEE 값 검증 (CSV 데이터 기준)
    assert kpi_data['oee_v'] == 53.51, "OEE 값 불일치"
    assert kpi_data['oee_t'] == 70, "OEE 목표치 불일치"
    assert kpi_data['alarm_flag'] == 1, "알람 플래그 불일치"
    
    print("\n특정 날짜 알람 KPI 로드 테스트 통과!\n")


def test_missing_data():
    """데이터 없는 경우 테스트"""
    
    print("=" * 60)
    print("데이터 없는 경우 테스트")
    print("=" * 60 + "\n")
    
    # 존재하지 않는 날짜/장비
    state = {
        'alarm_date': '2026-12-31',
        'alarm_eqp_id': 'EQP99',
        'alarm_kpi': 'OEE'
    }
    
    # Node 2 실행
    result = node_2_load_alarm_kpi(state)
    
    # 검증: 에러 발생해야 함
    assert 'error' in result, "에러가 발생해야 함"
    assert result.get('kpi_data') is None, "KPI 데이터가 있으면 안 됨"
    
    print(f"\n예상대로 에러 발생: {result['error']}")
    print("\n데이터 없는 경우 테스트 통과!\n")


def main():
    """모든 테스트 실행"""
    
    print("\nNode 2: Load Alarm KPI 테스트 시작\n")
    
    try:
        test_load_latest_alarm()
        test_specific_alarm()
        test_missing_data()
        
        print("=" * 60)
        print("모든 테스트 통과!")
        print("=" * 60 + "\n")
        
    except AssertionError as e:
        print(f"\n[ERROR] 테스트 실패: {e}\n")
        raise
    except Exception as e:
        print(f"\n[ERROR] 예상치 못한 오류: {e}\n")
        raise


if __name__ == "__main__":
    main()