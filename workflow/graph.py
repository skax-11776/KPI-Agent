"""
KPI 분석 워크플로우 그래프 정의
"""
from langgraph.graph import StateGraph, END
from workflow.state import AnalysisState, initial_state
from workflow.nodes.node_01_detect_alarm import detect_alarm
from workflow.nodes.node_02_1_collect_common_data import collect_common_data
from datetime import date, timedelta

def create_workflow() -> StateGraph:
    """
    LangGraph 워크플로우
    """
    # 빈 그래프 생성
    workflow = StateGraph(AnalysisState)

    # 노드 추가
    workflow.add_node("alarm_detection", detect_alarm)
    workflow.add_node("collect_common_data", collect_common_data)

    # 노드 시작점 설정
    workflow.set_entry_point("alarm_detection")
    

    # 노드 간 연결
    workflow.add_edge("alarm_detection", "collect_common_data")
    workflow.add_edge("collect_common_data", END)

    return workflow.compile()


if __name__ == "__main__": 
    # 그래프 생성
    app = create_workflow()
    
    # 기간 설정
    start_date = date(2026, 1, 20)
    end_date = date(2026, 1, 31)
    check_date = start_date
    
    # 날짜별 반복 실행
    print("\n" + "=" * 60)
    print("워크플로우 실행 시작")
    print("=" * 60)
    
    day_count = 0
    total_alarms = 0
    
    while check_date <= end_date:
        day_count += 1
        
        print("\n" + "=" * 60)
        print(f"현재 날짜 : {check_date.strftime('%Y-%m-%d')}")
        print("=" * 60)
        
        state = initial_state(
            start_date=start_date,
            end_date=end_date,
            check_date=check_date
        )
        
        result = app.invoke(state)
        
        alarm_count = len(result.get("alarm_cases", []))
        total_alarms += alarm_count       
        check_date += timedelta(days=1)
    
    print("\n" + "=" * 60)
    print("실행 완료!")
    print("=" * 60)