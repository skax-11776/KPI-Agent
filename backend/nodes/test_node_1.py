"""
Node 1: Input Router 테스트
"""

import sys
from pathlib import Path

# 프로젝트 루트를 경로에 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.nodes.node_1_input_router import node_1_input_router
from backend.graph.state import create_initial_state


def test_alarm_route():
    """알람 경로 테스트"""
    
    print("\n" + "=" * 60)
    print("알람 경로 테스트")
    print("=" * 60 + "\n")
    
    # 알람 타입 State 생성
    state = {
        'input_type': 'alarm'
    }
    
    # 노드 실행
    result = node_1_input_router(state)
    
    # 결과 확인
    print("\n결과:")
    print(f"  alarm_date: {result.get('alarm_date')}")
    print(f"  alarm_eqp_id: {result.get('alarm_eqp_id')}")
    print(f"  alarm_kpi: {result.get('alarm_kpi')}")
    
    # 검증
    assert result.get('alarm_date') == '2026-01-31', "최신 날짜여야 함"
    assert result.get('alarm_eqp_id') == 'EQP12', "EQP12여야 함"
    assert result.get('alarm_kpi') == 'THP', "THP여야 함"
    
    print("\n알람 경로 테스트 통과!\n")


def test_question_route():
    """질문 경로 테스트"""
    
    print("=" * 60)
    print("질문 경로 테스트")
    print("=" * 60 + "\n")
    
    # 질문 타입 State 생성
    state = {
        'input_type': 'question',
        'input_data': '지난주 EQP01에서 무슨 문제가 있었나요?'
    }
    
    # 노드 실행
    result = node_1_input_router(state)
    
    # 결과 확인
    print("\n결과:")
    print(f"  반환값: {result}")
    
    # 검증 (질문 경로는 특별한 처리 없음)
    assert result == {} or result.get('error') is None, "에러 없어야 함"
    
    print("\n질문 경로 테스트 통과!\n")


def test_invalid_type():
    """잘못된 타입 테스트"""
    
    print("=" * 60)
    print("[WARN] 잘못된 타입 테스트")
    print("=" * 60 + "\n")
    
    # 잘못된 타입
    state = {
        'input_type': 'invalid'
    }
    
    # 노드 실행
    result = node_1_input_router(state)
    
    # 결과 확인
    print("\n결과:")
    print(f"  input_type: {result.get('input_type')}")
    print(f"  error: {result.get('error')}")
    
    # 검증
    assert result.get('input_type') == 'question', "기본값 question이어야 함"
    assert result.get('error') is not None, "에러 메시지 있어야 함"
    
    print("\n잘못된 타입 테스트 통과!\n")


def main():
    """모든 테스트 실행"""
    
    print("\nNode 1: Input Router 테스트 시작\n")
    
    try:
        test_alarm_route()
        test_question_route()
        test_invalid_type()
        
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