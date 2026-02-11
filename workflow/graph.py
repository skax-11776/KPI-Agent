"""
KPI 분석 워크플로우 그래프 정의
"""
from langgraph.graph import StateGraph, END
from state import AnalysisState

def workflow() -> StateGraph:
    """
    LangGraph 워크플로우
    """
    workflow = StateGraph(AnalysisState)
