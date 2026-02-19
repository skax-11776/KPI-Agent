"""
Node 9: Persist Report 테스트
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
from backend.nodes.node_8_report_writer import node_8_report_writer
from backend.nodes.node_9_persist_report import node_9_persist_report
from backend.config.chroma_config import chroma_config


def test_persist_report():
    """리포트 저장 테스트"""
    
    print("\n" + "=" * 60)
    print("🧪 리포트 저장 테스트")
    print("=" * 60 + "\n")
    
    # 초기 리포트 개수
    initial_count = chroma_config.count_reports()
    print(f"초기 리포트 개수: {initial_count}개\n")
    
    # 초기 State
    state = {'input_type': 'alarm'}
    
    # Node 1~8 실행
    print("1️⃣ Node 1~8 실행...")
    state.update(node_1_input_router(state))
    state.update(node_2_load_alarm_kpi(state))
    state.update(node_3_context_fetch(state))
    state.update(node_6_root_cause_analysis(state))
    state.update(node_7_human_choice(state))
    state.update(node_8_report_writer(state))
    
    report_id = state['report_id']
    
    # Node 9 실행
    print("2️⃣ Node 9 실행...")
    result = node_9_persist_report(state)
    state.update(result)
    
    # 검증
    assert 'error' not in state, f"에러 발생: {state.get('error')}"
    assert state.get('rag_saved') is True, "저장 실패"
    
    # 리포트 개수 증가 확인
    final_count = chroma_config.count_reports()
    print(f"최종 리포트 개수: {final_count}개")
    
    # 저장된 리포트 조회
    saved_report = chroma_config.get_report_by_id(report_id)
    assert saved_report is not None, "저장된 리포트 조회 실패"
    
    print(f"\n✅ 리포트 저장 성공!")
    print(f"   리포트 ID: {report_id}")
    print(f"   저장 위치: ChromaDB")
    print(f"   메타데이터: {saved_report['metadata']}")
    
    print("\n✅ 리포트 저장 테스트 통과!\n")


def test_full_workflow():
    """전체 워크플로우 테스트 (Node 1~9)"""
    
    print("=" * 60)
    print("🧪 전체 워크플로우 테스트 (Node 1~9)")
    print("=" * 60 + "\n")
    
    # 초기 State
    state = {'input_type': 'alarm'}
    
    print("🔄 알람 분석 워크플로우 시작...\n")
    
    # Node 1: Input Router
    print("1️⃣ Node 1: Input Router")
    state.update(node_1_input_router(state))
    print(f"   ✅ 알람 타입: {state['input_type']}")
    print(f"   ✅ 날짜: {state['alarm_date']}, 장비: {state['alarm_eqp_id']}\n")
    
    # Node 2: Load Alarm KPI
    print("2️⃣ Node 2: Load Alarm KPI")
    state.update(node_2_load_alarm_kpi(state))
    print(f"   ✅ KPI 데이터 조회 완료\n")
    
    # Node 3: Context Fetch
    print("3️⃣ Node 3: Context Fetch")
    state.update(node_3_context_fetch(state))
    print(f"   ✅ 로트: {len(state['lot_data'])}개")
    print(f"   ✅ 장비 이벤트: {len(state['eqp_data'])}개")
    print(f"   ✅ 레시피: {len(state['rcp_data'])}개\n")
    
    # Node 6: Root Cause Analysis
    print("4️⃣ Node 6: Root Cause Analysis")
    state.update(node_6_root_cause_analysis(state))
    print(f"   ✅ 근본 원인 후보: {len(state['root_causes'])}개\n")
    
    # Node 7: Human Choice
    print("5️⃣ Node 7: Human Choice")
    state.update(node_7_human_choice(state))
    print(f"   ✅ 선택된 원인: {state['selected_cause']['cause'][:50]}...\n")
    
    # Node 8: Report Writer
    print("6️⃣ Node 8: Report Writer")
    state.update(node_8_report_writer(state))
    print(f"   ✅ 리포트 생성: {len(state['final_report'])}자")
    print(f"   ✅ 리포트 ID: {state['report_id']}\n")
    
    # Node 9: Persist Report
    print("7️⃣ Node 9: Persist Report")
    state.update(node_9_persist_report(state))
    print(f"   ✅ RAG 저장: {state['rag_saved']}\n")
    
    # 최종 검증
    assert 'error' not in state, f"워크플로우 중 에러 발생: {state.get('error')}"
    assert state.get('rag_saved') is True, "RAG 저장 실패"
    
    print("=" * 60)
    print("🎉 전체 워크플로우 성공!")
    print("=" * 60)
    
    print(f"\n📊 최종 결과:")
    print(f"   알람: {state['alarm_date']} - {state['alarm_eqp_id']} - {state['alarm_kpi']}")
    print(f"   근본 원인: {state['selected_cause']['cause'][:60]}...")
    print(f"   리포트 ID: {state['report_id']}")
    print(f"   RAG 저장: ✅")
    print(f"   LLM 호출: {state['metadata']['llm_calls']}회")
    
    print("\n✅ 전체 워크플로우 테스트 통과!\n")


def test_search_saved_report():
    """저장된 리포트 검색 테스트"""
    
    print("=" * 60)
    print("🧪 저장된 리포트 검색 테스트")
    print("=" * 60 + "\n")
    
    # 검색 쿼리
    query = "EQP12 장비에서 처리량 문제가 발생했습니다"
    print(f"검색어: {query}\n")
    
    # ChromaDB 검색
    results = chroma_config.search_similar_reports(
        query_text=query,
        n_results=3
    )
    
    if results:
        print(f"✅ {len(results)}개의 유사 리포트 발견:\n")
        
        for i, report in enumerate(results, 1):
            print(f"{i}. ID: {report['id']}")
            print(f"   유사도: {report['distance']:.4f}")
            print(f"   메타데이터: {report['metadata']}")
            print(f"   내용: {report['document'][:100]}...")
            print()
    else:
        print("⚠️ 유사 리포트 없음")
    
    print("✅ 저장된 리포트 검색 테스트 통과!\n")


def main():
    """모든 테스트 실행"""
    
    print("\n🧪 Node 9: Persist Report 테스트 시작\n")
    
    try:
        test_persist_report()
        test_full_workflow()
        test_search_saved_report()
        
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