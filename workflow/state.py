"""
KPI 분석 워크플로우에서 사용되는 State 정의
State는 모든 노드가 공유되는 데이터 저장소로, 워크플로우 전체에서 데이터 전달
"""
from typing import TypedDict, List, Dict, Any, Optional
from datetime import date

# State 클래스 정의
class AnalysisState(TypedDict):
    """
    KPI 분석 워크플로우의 State

    - typing : Python은 원래 타입을 안 써도 되는 언어이지만 명시 가능 -> 실수 방지 및 자동완성, 코드 읽기 쉬움
    - TypedDict : 일반 딕셔너리 {key : value}와 비슷하지만 어떤 key들이 있고, 각 value의 타입이 무엇인지 미리 정의
    - Any : 아무 타입이나 가능(숫자, 문자열, 상관없음)
    - Optional : 값이 있을 수도 있고, None일 수도 있음
    """
    # 워크플로우 시작 입력 데이터(분석 대상 날짜)
    check_date : date

    # 노드 1 - 2 : 데이터 수집
    alarm_cases : List[Dict[str, Any]]
    raw_data : Dict[str, List[Dict[str, Any]]]

    # 노드 3 - 4 : 데이터 분석
    features : Dict[str, Dict[str, Any]]
    patterns : Dict[str, Any]
    pattern_confidence : float
    pattern_retry_count : int

    # 노드 5 : 원인/영향도 분석
    root_cause: Dict[str, Any]
    impact_scope : str
    impact_analysis : Dict[str, Any]
    
    # 노드 7 - 8 : 시나리오 생성 & 평가
    llm_scenarios: Optional[List[Dict[str, Any]]]
    top_scenarios: List[Dict[str, Any]]
    scenario_quality_score: float

    # 노드 9 : 관리자 선택
    selected_scenario : Optional[Dict[str, Any]]

    # 노드 10 : 최종 분석 리포트 생성
    final_report : Optional[str]
    case_id : Optional[int]


# State 초기화 함수
def initial_state(check_date : date) -> AnalysisState:
    """
    State 초기화 함수
    
    Args :
        - check_date : 분석 대상 날짜
    Returns :
        - 초기화된 State 
    """
    return {
        "check_date" : check_date,
        "alarm_cases" : [],
        "raw_data" : {},
        "features" : {},
        "patterns" : {},
        "pattern_confidence" : 0.0,
        "pattern_retry_count" : 0,
        "root_cause" : {},
        "impact_scope" : "",
        "impact_analysis" : {},
        "llm_scenarios" : None,
        "top_scenarios" : [],
        "scenario_quality_score" : 0.0,
        "selected_scenario" : None,
        "final_report" : None,
        "case_id" : None,
    }

if __name__ == "__main__":
    """State 초기화 및 Reducer 동작 확인"""
    
    print("LangGraph State 테스트")
    print("=" * 60)
    
    # State 초기화
    state = initial_state(date(2026, 1, 28))
    print("\nState 초기화")
    print(f"check_date: {state['check_date']}")
    print(f"alarm_cases: {state['alarm_cases']}")
    
    # 리스트 확장 테스트
    print("\n리스트 확장")
    print(f"- 초기: {state['alarm_cases']}")
    
    # 노드1에 알람 추가
    new_alarms = [
        {"eqp_id": "EQP6", "alarm_flag": 1},
        {"eqp_id": "EQP9", "alarm_flag": 1}
    ]
    state["alarm_cases"] = new_alarms
    print(f"- 추가 후: {state['alarm_cases']}")
    
    print("\n특징 추가")
    print(f"- 초기: {state['features']}")
    
    state["features"]["EQP6"] = {"downtime_ratio": 0.22}
    print(f"- EQP6 추가: {state['features']}")
    
    state["features"]["EQP9"] = {"downtime_ratio": 0.05}
    print(f"- EQP9 추가: {state['features']}")
    
    print("\n" + "=" * 60)