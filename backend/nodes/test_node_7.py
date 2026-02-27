"""
Node 7: Human Choice 테스트
"""

import sys
from pathlib import Path

# 프로젝트 루트를 경로에 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.nodes.node_1_input_router import node_1_input_router
from backend.nodes.node_2_load_alarm_kpi import node_2_load_alarm_kpi
from backend.nodes.node_3_context_fetch import node_3_context_fetch
from backend.nodes.node_6_root_cause_analysis import node_6_root_cause_analysis
from backend.nodes.node_7_human_choice import node_7_human_choice


def test_auto_selection():
    """자동 선택 테스트 (가장 높은 확률)"""
    
    print("\n" + "=" * 60)
    print("자동 선택 테스트")
    print("=" * 60 + "\n")
    
    # 초기 State
    state = {'input_type': 'alarm'}
    
    # Node 1~6 실행
    print("1. Node 1~6 실행...")
    state.update(node_1_input_router(state))
    state.update(node_2_load_alarm_kpi(state))
    state.update(node_3_context_fetch(state))
    state.update(node_6_root_cause_analysis(state))
    
    # Node 7 실행 (자동 선택)
    print("2. Node 7 실행 (자동 선택)...")
    result = node_7_human_choice(state)
    state.update(result)
    
    # 검증
    assert 'error' not in state, f"에러 발생: {state.get('error')}"
    assert state.get('selected_cause') is not None, "선택된 원인 없음"
    assert state.get('selected_cause_index') is not None, "선택 인덱스 없음"
    
    selected_cause = state['selected_cause']
    root_causes = state['root_causes']
    
    # 가장 높은 확률인지 확인
    max_prob = max(c['probability'] for c in root_causes)
    assert selected_cause['probability'] == max_prob, "가장 높은 확률이 아님"
    
    print(f"\n자동 선택 성공!")
    print(f"   선택된 원인: {selected_cause['cause']}")
    print(f"   확률: {selected_cause['probability']}%")
    
    print("\n자동 선택 테스트 통과!\n")


def test_manual_selection():
    """수동 선택 테스트"""
    
    print("=" * 60)
    print("수동 선택 테스트")
    print("=" * 60 + "\n")
    
    # 샘플 원인 후보
    state = {
        'root_causes': [
            {
                'cause': '장비 다운타임 증가',
                'probability': 40,
                'evidence': '4회 다운타임 발생'
            },
            {
                'cause': '고복잡도 레시피 사용',
                'probability': 35,
                'evidence': '복잡도 10/10 레시피'
            },
            {
                'cause': '로트 HOLD 발생',
                'probability': 25,
                'evidence': '4회 HOLD 상태'
            }
        ]
    }
    
    # 2번 원인 선택
    print("사용자가 2번 원인 선택...")
    state['selected_cause_index'] = 1
    
    # Node 7 실행
    result = node_7_human_choice(state)
    state.update(result)
    
    # 검증
    assert 'error' not in state, f"에러 발생: {state.get('error')}"
    
    selected_cause = state['selected_cause']
    
    assert selected_cause['cause'] == '고복잡도 레시피 사용', "선택된 원인 불일치"
    assert selected_cause['probability'] == 35, "확률 불일치"
    
    print(f"\n수동 선택 성공!")
    print(f"   선택된 원인: {selected_cause['cause']}")
    print(f"   확률: {selected_cause['probability']}%")
    
    print("\n수동 선택 테스트 통과!\n")


def test_invalid_selection():
    """잘못된 선택 테스트"""
    
    print("=" * 60)
    print("잘못된 선택 테스트")
    print("=" * 60 + "\n")
    
    # 샘플 원인 후보 (3개)
    state = {
        'root_causes': [
            {'cause': '원인1', 'probability': 50, 'evidence': '근거1'},
            {'cause': '원인2', 'probability': 30, 'evidence': '근거2'},
            {'cause': '원인3', 'probability': 20, 'evidence': '근거3'}
        ]
    }
    
    # 잘못된 인덱스 (범위 초과)
    print("잘못된 인덱스 선택 (99)...")
    state['selected_cause_index'] = 99
    
    # Node 7 실행
    result = node_7_human_choice(state)
    
    # 검증: 에러 발생해야 함
    assert 'error' in result, "에러가 발생해야 함"
    
    print(f"\n예상대로 에러 발생: {result['error']}")
    
    print("\n잘못된 선택 테스트 통과!\n")


def test_no_causes():
    """원인 후보 없는 경우 테스트"""
    
    print("=" * 60)
    print("원인 후보 없는 경우 테스트")
    print("=" * 60 + "\n")
    
    # 원인 후보 없는 State
    state = {'root_causes': []}
    
    # Node 7 실행
    result = node_7_human_choice(state)
    
    # 검증: 에러 발생해야 함
    assert 'error' in result, "에러가 발생해야 함"
    
    print(f"\n예상대로 에러 발생: {result['error']}")
    
    print("\n원인 후보 없는 경우 테스트 통과!\n")


def main():
    """모든 테스트 실행"""
    
    print("\nNode 7: Human Choice 테스트 시작\n")
    
    try:
        test_auto_selection()
        test_manual_selection()
        test_invalid_selection()
        test_no_causes()
        
        print("=" * 60)
        print("모든 테스트 통과!")
        print("=" * 60 + "\n")
        
    except AssertionError as e:
        print(f"\n[ERROR] 테스트 실패: {e}\n")
        raise
    except Exception as e:
        print(f"\n[ERROR] 예상치 못한 오류: {e}\n")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    main()