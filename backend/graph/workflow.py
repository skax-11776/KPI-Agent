"""
LangGraph 워크플로우 정의

두 가지 경로:
1. 알람 분석: 1 → 2 → 3 → 6 → 7 → 8 → 9
2. 질문 답변: 1 → 4 → 5
"""

import sys
import uuid
from pathlib import Path
from typing import Literal

# 프로젝트 루트 경로 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from langgraph.graph import StateGraph, END
from backend.graph.state import AgentState
from backend.utils.cache import analysis_cache, qa_cache, SimpleCache

# 각 노드 함수 개별 import
from backend.nodes.node_1_input_router import node_1_input_router
from backend.nodes.node_2_load_alarm_kpi import node_2_load_alarm_kpi
from backend.nodes.node_3_context_fetch import node_3_context_fetch
from backend.nodes.node_4_report_lookup import node_4_report_lookup
from backend.nodes.node_5_rag_answer import node_5_rag_answer
from backend.nodes.node_6_root_cause_analysis import node_6_root_cause_analysis
from backend.nodes.node_7_human_choice import node_7_human_choice
from backend.nodes.node_8_report_writer import node_8_report_writer
from backend.nodes.node_9_persist_report import node_9_persist_report

# Phase 1 중간 상태 캐시 (30분 유효)
phase1_cache = SimpleCache(ttl_seconds=1800)


def route_after_input(state: AgentState) -> Literal["alarm_path", "question_path"]:
    """
    Node 1 이후 경로 결정
    
    Args:
        state: 현재 State
    
    Returns:
        "alarm_path" 또는 "question_path"
    """
    input_type = state.get('input_type')
    
    if input_type == 'alarm':
        return "alarm_path"
    else:
        return "question_path"


def create_workflow() -> StateGraph:
    """
    LangGraph 워크플로우를 생성합니다.
    
    Returns:
        StateGraph: 컴파일된 워크플로우
    """
    
    # StateGraph 생성
    workflow = StateGraph(AgentState)
    
    # ========== 노드 추가 ==========
    
    # 공통 노드
    workflow.add_node("node_1", node_1_input_router)
    
    # 알람 경로 노드
    workflow.add_node("node_2", node_2_load_alarm_kpi)
    workflow.add_node("node_3", node_3_context_fetch)
    workflow.add_node("node_6", node_6_root_cause_analysis)
    workflow.add_node("node_7", node_7_human_choice)
    workflow.add_node("node_8", node_8_report_writer)
    workflow.add_node("node_9", node_9_persist_report)
    
    # 질문 경로 노드
    workflow.add_node("node_4", node_4_report_lookup)
    workflow.add_node("node_5", node_5_rag_answer)
    
    # ========== 엣지 추가 ==========
    
    # 시작점: Node 1
    workflow.set_entry_point("node_1")
    
    # Node 1 이후 조건부 분기
    workflow.add_conditional_edges(
        "node_1",
        route_after_input,
        {
            "alarm_path": "node_2",
            "question_path": "node_4"
        }
    )
    
    # 알람 경로: 2 → 3 → 6 → 7 → 8 → 9 → END
    workflow.add_edge("node_2", "node_3")
    workflow.add_edge("node_3", "node_6")
    workflow.add_edge("node_6", "node_7")
    workflow.add_edge("node_7", "node_8")
    workflow.add_edge("node_8", "node_9")
    workflow.add_edge("node_9", END)
    
    # 질문 경로: 4 → 5 → END
    workflow.add_edge("node_4", "node_5")
    workflow.add_edge("node_5", END)
    
    # 컴파일
    app = workflow.compile()
    
    return app


# 전역 워크플로우 인스턴스 (lazy initialization)
_workflow_app = None


def get_workflow_app():
    """워크플로우 앱을 가져옵니다 (싱글톤 패턴)"""
    global _workflow_app
    if _workflow_app is None:
        _workflow_app = create_workflow()
    return _workflow_app


def run_alarm_analysis(alarm_date: str = None, alarm_eqp_id: str = None, alarm_kpi: str = None) -> AgentState:
    """
    알람 분석 워크플로우를 실행합니다.
    
    캐싱을 사용하여 동일한 알람 재분석 시 LLM 비용을 절감합니다.
    
    Args:
        alarm_date: 알람 날짜 (None이면 최신 알람)
        alarm_eqp_id: 장비 ID (None이면 최신 알람)
        alarm_kpi: KPI (None이면 최신 알람)
    
    Returns:
        AgentState: 최종 State
    """
    
    print("\n" + "=" * 60)
    print("알람 분석 워크플로우 시작")
    print("=" * 60 + "\n")
    
    # 1. 캐시 키 생성
    if alarm_date and alarm_eqp_id and alarm_kpi:
        cache_key = analysis_cache.generate_key('alarm', alarm_date, alarm_eqp_id, alarm_kpi)
    else:
        # 최신 알람은 캐시하지 않음 (매번 새로운 결과를 보여주기 위해)
        cache_key = None
    
    # 2. 캐시 확인
    if cache_key:
        cached_result = analysis_cache.get(cache_key)
        if cached_result:
            print("캐시된 분석 결과 사용 (LLM 호출 생략)")
            print("=" * 60 + "\n")
            return cached_result
    
    # 3. 초기 State
    initial_state = {
        'input_type': 'alarm',
        'metadata': {'llm_calls': 0}
    }
    
    # 특정 알람 지정 시
    if alarm_date and alarm_eqp_id and alarm_kpi:
        initial_state['alarm_date'] = alarm_date
        initial_state['alarm_eqp_id'] = alarm_eqp_id
        initial_state['alarm_kpi'] = alarm_kpi
    
    # 4. 워크플로우 실행
    app = get_workflow_app()
    final_state = app.invoke(initial_state)
    
    # 5. 결과 캐싱 (에러가 없고, 특정 알람인 경우만)
    if cache_key and 'error' not in final_state and final_state.get('rag_saved'):
        analysis_cache.set(cache_key, final_state)
    
    print("\n" + "=" * 60)
    print("알람 분석 워크플로우 완료")
    print("=" * 60 + "\n")
    
    return final_state


def run_question_answer(question: str) -> AgentState:
    """
    질문 답변 워크플로우를 실행합니다.
    
    동일한 질문에 대해 캐싱을 사용합니다.
    
    Args:
        question: 사용자 질문
    
    Returns:
        AgentState: 최종 State
    """
    
    print("\n" + "=" * 60)
    print("질문 답변 워크플로우 시작")
    print("=" * 60 + "\n")
    
    # 1. 캐시 키 생성 (질문의 해시값 사용)
    import hashlib
    question_hash = hashlib.md5(question.lower().strip().encode()).hexdigest()
    cache_key = qa_cache.generate_key('question', question_hash)
    
    # 2. 캐시 확인
    cached_result = qa_cache.get(cache_key)
    if cached_result:
        print("캐시된 답변 사용 (LLM 호출 생략)")
        print("=" * 60 + "\n")
        return cached_result
    
    # 3. 초기 State
    initial_state = {
        'input_type': 'question',
        'input_data': question,
        'metadata': {'llm_calls': 0}
    }
    
    # 4. 워크플로우 실행
    app = get_workflow_app()
    final_state = app.invoke(initial_state)
    
    # 5. 결과 캐싱 (에러가 없는 경우만)
    if 'error' not in final_state and final_state.get('final_answer'):
        qa_cache.set(cache_key, final_state)
    
    print("\n" + "=" * 60)
    print("질문 답변 워크플로우 완료")
    print("=" * 60 + "\n")

    return final_state


def run_alarm_analysis_phase1(alarm_date: str = None, alarm_eqp_id: str = None, alarm_kpi: str = None) -> dict:
    """
    알람 분석 Phase 1: Nodes 1→2→3→6 실행.
    근본 원인 후보를 반환하고 중간 상태를 세션으로 캐싱합니다.

    Args:
        alarm_date: 알람 날짜 (None이면 최신 알람)
        alarm_eqp_id: 장비 ID
        alarm_kpi: KPI

    Returns:
        dict: root_causes, session_id 포함 상태
    """

    print("\n" + "=" * 60)
    print("알람 분석 Phase 1 시작 (Nodes 1→2→3→6)")
    print("=" * 60 + "\n")

    # 초기 상태
    state: dict = {'input_type': 'alarm', 'metadata': {'llm_calls': 0}}
    if alarm_date and alarm_eqp_id and alarm_kpi:
        state['alarm_date'] = alarm_date
        state['alarm_eqp_id'] = alarm_eqp_id
        state['alarm_kpi'] = alarm_kpi

    # 노드 순차 실행
    for node_fn in [node_1_input_router, node_2_load_alarm_kpi,
                    node_3_context_fetch, node_6_root_cause_analysis]:
        result = node_fn(state)
        state.update(result)
        if 'error' in state:
            print(f"[ERROR] Phase 1 실패: {state['error']}")
            return state

    # 세션 ID 발급 및 중간 상태 캐싱
    session_id = str(uuid.uuid4())
    phase1_cache.set(session_id, dict(state))
    state['session_id'] = session_id

    print("\n" + "=" * 60)
    print(f"알람 분석 Phase 1 완료 (session_id: {session_id})")
    print("=" * 60 + "\n")

    return state


def run_alarm_analysis_phase2(session_id: str, selected_index: int) -> dict:
    """
    알람 분석 Phase 2: 사용자 선택 반영 후 Nodes 7→8→9 실행.

    Args:
        session_id: Phase 1에서 발급받은 세션 ID
        selected_index: 사용자가 선택한 원인 인덱스 (0부터 시작)

    Returns:
        dict: selected_cause, final_report, report_id 등 포함 상태
    """

    print("\n" + "=" * 60)
    print(f"알람 분석 Phase 2 시작 (session_id: {session_id}, 선택: {selected_index}번)")
    print("=" * 60 + "\n")

    # 캐시된 Phase 1 상태 복원
    cached_state = phase1_cache.get(session_id)
    if not cached_state:
        return {'error': '세션을 찾을 수 없습니다. Phase 1을 다시 실행해주세요.'}

    state = dict(cached_state)
    state['selected_cause_index'] = selected_index

    # 노드 순차 실행
    for node_fn in [node_7_human_choice, node_8_report_writer, node_9_persist_report]:
        result = node_fn(state)
        state.update(result)
        if 'error' in state:
            print(f"[ERROR] Phase 2 실패: {state['error']}")
            return state

    # 사용 완료 후 세션 캐시 삭제
    phase1_cache.delete(session_id)

    print("\n" + "=" * 60)
    print("알람 분석 Phase 2 완료")
    print("=" * 60 + "\n")

    return state