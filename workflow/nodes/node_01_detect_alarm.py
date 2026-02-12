"""
Node 1
    - 알람 감지(KPI_DAILY 데이터를 조회하여 목표 미달 케이스 탐지)
"""

from workflow.state import AnalysisState, initial_state
from config.settings import sb
from typing import Any, List, Dict
from datetime import date, timedelta


def detect_alarm(state : AnalysisState) -> AnalysisState:
    """
    알람 감지 노드

    Input:
        - check_date : 분석 대상 날짜

    Output:
        - alarm_cases : 알람 발생 케이스 리스트

    Process:
        - Supabase에서 check_date 및 alarm_flag = 1 조회
        - alarm_cases 리스트 생성
    """
    check_date = state["check_date"]

    print(f"[노드 1] 알람 감지 시작 날짜 : {check_date}")

    # Supabase에서 alarm_flag = 1인 데이터 조회
    response = sb.table("kpi_daily").select("*").eq(
        "date", check_date.strftime("%Y-%m-%d")).eq("alarm_flag", 1).execute()
    
    alarm_data = response.data

    alarm_cases = []

    for row in alarm_data:
        dropped_kpis = identify_kpis(row)

        if not dropped_kpis:
            continue

        kpi_info = max(dropped_kpis, key = lambda x : abs(x["gap_percent"]))

        alarm_case = {
            "eqp_id" : row["eqp_id"],
            "kpi_name" : kpi_info["name"],
            "current_value" : kpi_info["current"],
            "target_value" : kpi_info["target"],
            "gap" : kpi_info["gap"],
            "gap_percent" : kpi_info["gap_percent"]
        }

        if kpi_info["name"] == "WIP":
            alarm_case["issue_type"] = kpi_info.get("issue_type")

        alarm_cases.append(alarm_case)
    
    print(f"[노드 1] 알람 {len(alarm_cases)}건 감지")
    
    for case in alarm_cases:
        percent = abs(case["gap_percent"])

        if case["kpi_name"] == "TAT":
            status = "초과"
        
        elif case["kpi_name"] == "WIP":
            status = "초과" if case.get("issue_type") == "EXCEED" else "미달"

        else:
            status = "미달"
        
        print(f"\n- {case['eqp_id']} : {case['kpi_name']} {percent :.1f}% {status}\n")


    return {"alarm_cases" : alarm_cases}



def identify_kpis(row : Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    detect_alarm 함수 내부에서만 사용되는 함수

    역할:
        - kpi_daily의 한 row를 받음
        - OEE, THP, TAT, WIP의 현재값과 목표값을 비교
        - 목표 미달인 KPI만 리스트로 반환
    
    Args:
        - row : kpi_daily 테이블의 한 줄

    KPI 판단 기준:
        - OEE : 낮을수록 문제 / 현재값 < 목표값 -> 문제
        - THP : 낮을수록 문제 / 현재값 < 목표값 -> 문제
        - TAT : 높을수록 문제 / 현재값 > 목표값 -> 문제
        - WIP : 상한/하한 목표값과 차이가 많이나면 문제 / 현재값 > 상한 OR 현재값 < 하한 -> 문제
    """
    dropped = []

    # case 1 : oee
    if row["oee_v"] < row["oee_t"]:
        gap = row["oee_t"] - row["oee_v"]

        dropped.append({
            "name" : "OEE",
            "current" : row["oee_v"],
            "target" : row["oee_t"],
            "gap" : gap,
            "gap_percent" : (gap / row["oee_t"]) * 100
        })
    
    # case 2 : thp
    if row["thp_v"] < row["thp_t"]:
        gap = row["thp_t"] - row["thp_v"]

        dropped.append({
            "name" : "THP",
            "current" : row["thp_v"],
            "target" : row["thp_t"],
            "gap" : gap,
            "gap_percent" : (gap / row["thp_t"]) * 100
        })

    # case 3 : tat
    if row["tat_v"] > row["tat_t"]:
        gap = row["tat_v"] - row["tat_t"]

        dropped.append({
            "name" : "TAT",
            "current" : row["tat_v"],
            "target" : row["tat_t"],
            "gap" : gap,
            "gap_percent" : (gap / row["tat_t"]) * 100
        })

    # case 4 : wip
    wip_t_lower = row["wip_t"] * 0.7

    # 1. wip 목표 초과
    if row["wip_v"] > row["wip_t"]:
        gap = row["wip_v"] - row["wip_t"]

        dropped.append({
            "name" : "WIP",
            "current" : row["wip_v"],
            "target" : row["wip_t"],
            "gap" : gap,
            "gap_percent" : (gap / row["wip_t"]) * 100,
            "issue_type" : "EXCEED"
        })
    
    # 2. wip 목표 미달
    if wip_t_lower > row["wip_v"]:
        gap = wip_t_lower- row["wip_v"]

        dropped.append({
            "name" : "WIP",
            "current" : row["wip_v"],
            "target" : wip_t_lower,
            "gap" : gap,
            "gap_percent" : (gap / wip_t_lower) * 100,
            "issue_type" : "SHORTAGE"
        })
    
    return dropped


if __name__ == "__main__":
    print("=" * 60)
    print("노드 1: 알람 감지 테스트")
    print("=" * 60)

    state = initial_state(
        start_date=date(2026, 1, 20),
        end_date=date(2026, 1, 31),
        check_date=date(2026, 1, 20),
    )

    total_cases = 0

    day = state["start_date"]

    while day <= state["end_date"]:
        state["check_date"] = day
        print("=" * 60)
        print(f"[날짜] {day}")
        print("=" * 60)
        
        result = detect_alarm(state)
        day_cases = result.get("alarm_cases", [])
        total_cases += len(day_cases)

        if day_cases:
            for i, case in enumerate(result['alarm_cases'], 1):
                print(f"\n[케이스 {i}]")
                print(f"- 설비 : {case['eqp_id']}")
                print(f"- KPI : {case['kpi_name']}")
                print(f"- 현재 : {case['current_value']}")
                print(f"- 목표 : {case['target_value']}")
                print(f"- 편차 : {abs(case['gap_percent']):.1f}%\n")

                if case['kpi_name'] == 'WIP' and 'issue_type' in case:
                    issue_kr = "재공 과다" if case['issue_type'] == 'EXCEED' else "SHORTAGE"
                    print(f"- 유형 : {case['issue_type']}\n")

        else:
            print("알람 없음")
        
        day += timedelta(days = 1)

    print("\n" + "=" * 60)
    print(f"[기간 요약] 총 알람 케이스 수 : {total_cases}")
    print("=" * 60)