"""
LangGraph Agent State 정의

State는 Agent가 실행되면서 변화하는 모든 데이터를 저장합니다.
각 노드는 State를 읽고, 처리하고, 업데이트합니다.
"""

from typing import TypedDict, Optional, List, Dict, Any, Literal


class AgentState(TypedDict, total=False):
    """
    AI Agent의 전체 상태를 정의합니다.
    
    total=False: 모든 필드가 필수가 아님 (선택적)
    
    워크플로우 흐름에 따른 State 변화:
    1. 입력 → input_type, input_data 설정
    2. 알람 로드 → alarm_* 필드 설정
    3. 컨텍스트 조회 → *_data 필드 설정
    4. 근본 원인 분석 → root_causes 설정
    5. 사용자 선택 → selected_cause 설정
    6. 리포트 작성 → final_report 설정
    """
    
    # ========== 입력 관련 ==========
    input_type: Literal["alarm", "question"]
    """입력 타입: 'alarm' (알람) 또는 'question' (질문)"""
    
    input_data: Optional[str]
    """원본 입력 데이터 (알람 정보 또는 질문 텍스트)"""
    
    # ========== 알람 정보 ==========
    alarm_date: Optional[str]
    """알람 발생 날짜 (YYYY-MM-DD)"""
    
    alarm_eqp_id: Optional[str]
    """알람이 발생한 장비 ID (예: EQP01)"""
    
    alarm_kpi: Optional[str]
    """문제가 된 KPI (OEE, THP, TAT, WIP_EXCEED, WIP_SHORTAGE)"""
    
    # ========== 데이터베이스 조회 결과 ==========
    kpi_data: Optional[Dict[str, Any]]
    """KPI_DAILY 테이블에서 조회한 데이터"""
    
    lot_data: Optional[List[Dict[str, Any]]]
    """LOT_STATE 테이블에서 조회한 로트 상태 이력"""
    
    eqp_data: Optional[List[Dict[str, Any]]]
    """EQP_STATE 테이블에서 조회한 장비 상태 이력"""
    
    rcp_data: Optional[List[Dict[str, Any]]]
    """RCP_STATE 테이블에서 조회한 레시피 정보"""

    trend_data: Optional[List[Dict[str, Any]]]
    """KPI_DAILY 테이블에서 조회한 직전 7일 추세 데이터"""

    context_text: Optional[str]
    """LLM에 제공할 포맷팅된 컨텍스트 텍스트"""
    
    # ========== RAG 관련 ==========
    report_exists: Optional[bool]
    """과거 유사 리포트 존재 여부"""
    
    similar_reports: Optional[List[Dict[str, Any]]]
    """ChromaDB에서 검색한 유사 리포트 리스트"""
    
    # ========== 질문 관련 ==========
    question_text: Optional[str]
    """정제된 질문 텍스트"""
    
    final_answer: Optional[str]
    """질문에 대한 최종 답변 (LLM 생성)"""
    
    # ========== 근본 원인 분석 ==========
    root_causes: Optional[List[Dict[str, Any]]]
    """
    LLM이 분석한 근본 원인 후보 리스트
    형식: [
        {
            "cause": "원인 설명",
            "probability": 40,
            "evidence": "근거"
        },
        ...
    ]
    """
    
    problem_summary: Optional[str]
    """LLM이 생성한 문제 요약 (Node 6에서 설정)"""

    selected_cause: Optional[Dict[str, Any]]
    """사용자가 선택한 최종 근본 원인"""

    selected_cause_index: Optional[int]
    """선택된 원인의 인덱스"""
    
    # ========== 최종 출력 ==========
    final_report: Optional[str]
    """LLM이 작성한 최종 분석 리포트 (마크다운 형식)"""
    
    report_id: Optional[str]
    """생성된 리포트의 고유 ID (예: report_20260120_EQP01_OEE)"""
    
    rag_saved: Optional[bool]
    """RAG 저장 성공 여부"""
    
    # ========== 에러 처리 ==========
    error: Optional[str]
    """처리 중 발생한 에러 메시지"""
    
    # ========== 메타데이터 ==========
    metadata: Optional[Dict[str, Any]]
    """
    추가 메타데이터
    - created_at: 생성 시간
    - processing_time: 처리 시간
    - llm_calls: LLM 호출 횟수
    등등
    """


# State 초기값 생성 헬퍼 함수
def create_initial_state(
    input_type: Literal["alarm", "question"],
    input_data: str = None
) -> AgentState:
    """
    초기 State를 생성합니다.
    
    Args:
        input_type: 입력 타입 ("alarm" 또는 "question")
        input_data: 입력 데이터
    
    Returns:
        AgentState: 초기화된 State 객체
    
    Examples:
        >>> state = create_initial_state("alarm")
        >>> print(state['input_type'])
        'alarm'
    """
    from datetime import datetime
    
    state = AgentState(
        input_type=input_type,
        metadata={
            "created_at": datetime.now().isoformat(),
            "llm_calls": 0
        }
    )
    
    if input_data:
        state['input_data'] = input_data
    
    return state


def print_state_summary(state: AgentState) -> str:
    """
    State의 주요 정보를 요약해서 출력합니다.
    
    디버깅이나 로깅에 사용됩니다.
    
    Args:
        state: Agent State
    
    Returns:
        str: State 요약 문자열
    """
    summary = []
    summary.append("=" * 60)
    summary.append("현재 State 요약")
    summary.append("=" * 60)
    
    # 입력 정보
    summary.append(f"\n입력 타입: {state.get('input_type', 'N/A')}")
    if state.get('input_data'):
        summary.append(f"입력 데이터: {state.get('input_data', 'N/A')[:50]}...")
    
    # 알람 정보
    if state.get('alarm_date'):
        summary.append(f"\n알람 날짜: {state['alarm_date']}")
        summary.append(f"장비 ID: {state.get('alarm_eqp_id', 'N/A')}")
        summary.append(f"KPI: {state.get('alarm_kpi', 'N/A')}")
    
    # 질문 정보
    if state.get('question_text'):
        summary.append(f"\n질문: {state['question_text'][:50]}...")
    
    # 데이터 조회 상태
    if state.get('kpi_data'):
        summary.append(f"\nKPI 데이터: 조회 완료")
    if state.get('lot_data'):
        summary.append(f"로트 데이터: {len(state['lot_data'])}건")
    if state.get('eqp_data'):
        summary.append(f"장비 데이터: {len(state['eqp_data'])}건")
    
    # 분석 결과
    if state.get('root_causes'):
        summary.append(f"\n근본 원인 후보: {len(state['root_causes'])}개")
    if state.get('selected_cause'):
        summary.append(f"선택된 원인: {state['selected_cause'].get('cause', 'N/A')[:50]}...")
    
    # 최종 리포트
    if state.get('final_report'):
        summary.append(f"\n최종 리포트: 생성 완료")
        summary.append(f"리포트 ID: {state.get('report_id', 'N/A')}")
        summary.append(f"RAG 저장: {'' if state.get('rag_saved') else '[ERROR] '}")
    
    # 질문 답변
    if state.get('final_answer'):
        summary.append(f"\n답변: 생성 완료 ({len(state['final_answer'])}자)")
    
    # 에러
    if state.get('error'):
        summary.append(f"\n[ERROR] 에러: {state['error']}")
    
    summary.append("\n" + "=" * 60)
    
    return "\n".join(summary)