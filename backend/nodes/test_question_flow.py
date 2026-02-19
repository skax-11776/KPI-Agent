"""
질문 경로 워크플로우 테스트 (Node 1 → 4 → 5)
"""

import sys
from pathlib import Path

# 프로젝트 루트를 경로에 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.nodes.node_1_input_router import node_1_input_router
from backend.nodes.node_4_report_lookup import node_4_report_lookup
from backend.nodes.node_5_rag_answer import node_5_rag_answer


def test_question_with_existing_report():
    """과거 리포트가 있는 질문 테스트"""
    
    print("\n" + "=" * 60)
    print("🧪 과거 리포트가 있는 질문 테스트")
    print("=" * 60 + "\n")
    
    # 질문: EQP01 OEE 문제 (과거 리포트 있음)
    state = {
        'input_type': 'question',
        'input_data': '2026년 1월 20일에 EQP01 장비에서 OEE 문제가 발생했는데 원인이 뭐였나요?'
    }
    
    # Node 1: Input Router
    print("1️⃣ Node 1 실행...")
    result1 = node_1_input_router(state)
    state.update(result1)
    
    # Node 4: Report Lookup
    print("2️⃣ Node 4 실행...")
    result4 = node_4_report_lookup(state)
    state.update(result4)
    
    # 검증
    print(f"\n검증:")
    print(f"   report_exists: {state.get('report_exists')}")
    
    # Node 5: RAG Answer
    print("\n3️⃣ Node 5 실행...")
    result5 = node_5_rag_answer(state)
    state.update(result5)
    
    # 검증
    assert 'error' not in state, f"에러 발생: {state.get('error')}"
    assert state.get('final_answer') is not None, "답변 없음"
    
    print(f"\n✅ 질문 답변 성공!")
    print(f"   참고 리포트: {len(state.get('similar_reports', []))}개")
    print(f"   답변 길이: {len(state['final_answer'])}자")
    
    print("\n✅ 과거 리포트가 있는 질문 테스트 통과!\n")


def test_question_without_existing_report():
    """과거 리포트가 없는 질문 테스트"""
    
    print("=" * 60)
    print("🧪 과거 리포트가 없는 질문 테스트")
    print("=" * 60 + "\n")
    
    # 질문: 관련 없는 질문
    state = {
        'input_type': 'question',
        'input_data': '내일 날씨가 어떨까요?'
    }
    
    # Node 1~5 실행
    state.update(node_1_input_router(state))
    state.update(node_4_report_lookup(state))
    state.update(node_5_rag_answer(state))
    
    # 검증
    assert 'error' not in state, f"에러 발생: {state.get('error')}"
    assert state.get('final_answer') is not None, "답변 없음"
    
    print(f"\n✅ 답변 생성 완료!")
    print(f"   report_exists: {state.get('report_exists')}")
    print(f"   답변 길이: {len(state['final_answer'])}자")
    
    print("\n✅ 과거 리포트가 없는 질문 테스트 통과!\n")


def test_various_questions():
    """다양한 질문 테스트"""
    
    print("=" * 60)
    print("🧪 다양한 질문 테스트")
    print("=" * 60 + "\n")
    
    questions = [
        "지난주 EQP12에서 처리량 문제가 있었나요?",
        "장비 다운타임이 발생한 적이 있나요?",
        "HOLD 상태가 자주 발생하는 이유가 뭔가요?",
        "레시피 복잡도가 성능에 어떤 영향을 주나요?"
    ]
    
    for i, question in enumerate(questions, 1):
        print(f"\n질문 {i}: {question}")
        
        state = {
            'input_type': 'question',
            'input_data': question
        }
        
        # 워크플로우 실행
        state.update(node_1_input_router(state))
        state.update(node_4_report_lookup(state))
        state.update(node_5_rag_answer(state))
        
        # 결과
        print(f"   관련 리포트: {'있음' if state.get('report_exists') else '없음'}")
        print(f"   참고 문서: {len(state.get('similar_reports', []))}개")
        print(f"   답변 길이: {len(state.get('final_answer', ''))}자")
    
    print("\n✅ 다양한 질문 테스트 통과!\n")


def test_full_question_workflow():
    """전체 질문 워크플로우 테스트"""
    
    print("=" * 60)
    print("🧪 전체 질문 워크플로우 테스트")
    print("=" * 60 + "\n")
    
    state = {
        'input_type': 'question',
        'input_data': 'EQP01 장비에서 OEE가 낮아진 이유를 설명해주세요',
        'metadata': {'llm_calls': 0}
    }
    
    print("🔄 질문 답변 워크플로우 시작...\n")
    
    # Node 1
    print("1️⃣ Node 1: Input Router")
    state.update(node_1_input_router(state))
    print(f"   ✅ 타입: {state['input_type']}\n")
    
    # Node 4
    print("2️⃣ Node 4: Report Lookup")
    state.update(node_4_report_lookup(state))
    print(f"   ✅ 리포트 존재: {state['report_exists']}\n")
    
    # Node 5
    print("3️⃣ Node 5: RAG Answer")
    state.update(node_5_rag_answer(state))
    print(f"   ✅ 답변 생성 완료\n")
    
    # 최종 결과
    print("=" * 60)
    print("🎉 질문 워크플로우 성공!")
    print("=" * 60)
    
    print(f"\n💬 최종 답변:")
    print("=" * 60)
    print(state['final_answer'])
    print("=" * 60)
    
    print(f"\n📊 통계:")
    print(f"   질문: {state['question_text'][:50]}...")
    print(f"   참고 리포트: {len(state['similar_reports'])}개")
    print(f"   LLM 호출: {state['metadata']['llm_calls']}회")
    
    print("\n✅ 전체 질문 워크플로우 테스트 통과!\n")


def main():
    """모든 테스트 실행"""
    
    print("\n🧪 질문 경로 워크플로우 테스트 시작\n")
    
    try:
        test_question_with_existing_report()
        test_question_without_existing_report()
        test_various_questions()
        test_full_question_workflow()
        
        print("=" * 60)
        print("🎊 모든 테스트 통과!")
        print("=" * 60 + "\n")
        
    except AssertionError as e:
        print(f"\n❌ 테스트 실패: {e}\n")
        raise
    except Exception as e:
        print(f"\n❌ 예상치 못한 오류: {e}\n")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    main()