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
    start_date : date
    end_date : date
    check_date : date

    # 노드 1 - 2 : 데이터 수집
    alarm_cases : List[Dict[str, Any]]
    common_data : Dict[str, List[Dict[str, Any]]]
    specific_data : Dict[str, List[Dict[str, Any]]]

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
def initial_state(start_date : date, end_date : date, check_date : date) -> AnalysisState:
    """
    State 초기화 함수
    
    Args :
        - start_date : 분석 시작 날짜
        - end_date : 분석 끝 날짜
        - check_date : 분석 대상 날짜

    Returns :
        - 초기화된 State 
    """
    return {
        "start_date" : start_date,
        "end_date" : end_date,
        "check_date" : check_date,

        "alarm_cases" : [],
        "common_data" : {},
        "specific_data" : {},

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