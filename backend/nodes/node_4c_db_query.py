"""
Node 4C: DB Query
Node 4B의 분류 결과를 바탕으로 RDS에서 필요한 데이터만 조회합니다.

스마트 데이터 페칭 전략:
- 특정 날짜 있음 → 해당 날짜만 조회
- 날짜 범위 있음 → 해당 범위 조회
- 특정 장비 있음 → 해당 장비 필터
- 필터 없음     → 최근 30일 + LIMIT 50
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.config.rds_config import rds_config

# 필터 없을 때 기본 조회 범위
DEFAULT_DAYS = 30
DEFAULT_LIMIT = 50


def _format_kpi_daily(rows: List[Dict]) -> str:
    if not rows:
        return ""
    lines = ["[KPI_DAILY — 일별 KPI 실적]"]
    lines.append("날짜       | 장비  | OEE목표 | OEE실적 | THP목표 | THP실적 | TAT목표 | TAT실적 | WIP목표 | WIP실적")
    lines.append("-" * 95)
    for r in rows:
        lines.append(
            f"{r.get('date','')} | {r.get('eqp_id',''):5} | "
            f"{r.get('oee_t',''):>7} | {r.get('oee_v',''):>7} | "
            f"{r.get('thp_t',''):>7} | {r.get('thp_v',''):>7} | "
            f"{r.get('tat_t',''):>7} | {r.get('tat_v',''):>7} | "
            f"{r.get('wip_t',''):>7} | {r.get('wip_v',''):>7}"
        )
    return "\n".join(lines)


def _format_eqp_state(rows: List[Dict]) -> str:
    if not rows:
        return ""
    lines = ["[EQP_STATE — 장비 상태 이력]"]
    lines.append("이벤트 시간          | 장비  | 상태  | 이전상태 | 지속시간(분)")
    lines.append("-" * 65)
    for r in rows:
        lines.append(
            f"{str(r.get('event_time',''))[:19]:19} | {r.get('eqp_id',''):5} | "
            f"{r.get('state',''):5} | {r.get('prev_state',''):8} | "
            f"{r.get('duration_min',''):>12}"
        )
    return "\n".join(lines)


def _format_lot_state(rows: List[Dict]) -> str:
    if not rows:
        return ""
    lines = ["[LOT_STATE — 로트 처리 이력]"]
    lines.append("이벤트 시간          | 장비  | LOT ID    | 상태  | RCP ID")
    lines.append("-" * 65)
    for r in rows:
        lines.append(
            f"{str(r.get('event_time',''))[:19]:19} | {r.get('eqp_id',''):5} | "
            f"{r.get('lot_id',''):10} | {r.get('state',''):5} | {r.get('rcp_id','')}"
        )
    return "\n".join(lines)


def _format_rcp_state(rows: List[Dict]) -> str:
    if not rows:
        return ""
    lines = ["[RCP_STATE — 레시피 정보]"]
    lines.append("RCP ID    | 장비  | 복잡도 | 처리시간(분)")
    lines.append("-" * 45)
    for r in rows:
        lines.append(
            f"{r.get('rcp_id',''):10} | {r.get('eqp_id',''):5} | "
            f"{r.get('complexity',''):>6} | {r.get('process_time_min',''):>12}"
        )
    return "\n".join(lines)


def node_4c_db_query(state: dict) -> dict:
    """
    필요한 RDS 테이블을 스마트하게 조회합니다.

    Args:
        state: 현재 Agent State
            - needed_tables: 조회할 테이블 목록
            - query_filters: {date, eqp_id, start_date, end_date}

    Returns:
        dict: 업데이트할 State
            - db_context: 포맷된 DB 조회 결과 텍스트
    """
    print("\n" + "=" * 60)
    print("[Node 4C] DB Query 실행")
    print("=" * 60)

    needed_tables = state.get('needed_tables', [])
    filters = state.get('query_filters', {})

    if not needed_tables:
        print("   조회할 테이블 없음 — 스킵")
        print("=" * 60 + "\n")
        return {'db_context': ''}

    # 필터 출력
    specific_date = filters.get('date')
    eqp_id = filters.get('eqp_id')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    print(f"   테이블: {', '.join(needed_tables)}")
    if specific_date:
        print(f"   날짜 필터: {specific_date}")
    elif start_date:
        print(f"   날짜 범위: {start_date} ~ {end_date}")
    else:
        print(f"   필터 없음 → 최근 {DEFAULT_DAYS}일 (최대 {DEFAULT_LIMIT}행)")
    if eqp_id:
        print(f"   장비 필터: {eqp_id}")

    # 필터 없을 때 기본 날짜 범위 설정
    if not specific_date and not start_date:
        BASE_DATE = datetime(2026, 1, 31)
        end_date = BASE_DATE.strftime('%Y-%m-%d')
        start_date = (BASE_DATE - timedelta(days=DEFAULT_DAYS)).strftime('%Y-%m-%d')

    sections = []

    try:
        # ── kpi_daily ──────────────────────────────────────────
        if 'kpi_daily' in needed_tables:
            print(f"\n   kpi_daily 조회 중...")
            if specific_date:
                rows = rds_config.get_kpi_daily(date=specific_date, eqp_id=eqp_id)
            else:
                rows = rds_config.get_kpi_trend(
                    start_date=start_date,
                    end_date=end_date,
                    eqp_id=eqp_id,
                )
                rows = rows[:DEFAULT_LIMIT]
            print(f"   → {len(rows)}행 조회")
            if rows:
                sections.append(_format_kpi_daily(rows))

        # ── eqp_state ──────────────────────────────────────────
        if 'eqp_state' in needed_tables:
            print(f"\n   eqp_state 조회 중...")
            time_start = f"{specific_date or start_date} 00:00:00" if (specific_date or start_date) else None
            time_end   = f"{specific_date or end_date} 23:59:59"   if (specific_date or end_date)   else None
            rows = rds_config.get_eqp_state(
                start_time=time_start,
                end_time=time_end,
                eqp_id=eqp_id,
            )
            rows = rows[:DEFAULT_LIMIT]
            print(f"   → {len(rows)}행 조회")
            if rows:
                sections.append(_format_eqp_state(rows))

        # ── lot_state ──────────────────────────────────────────
        if 'lot_state' in needed_tables:
            print(f"\n   lot_state 조회 중...")
            time_start = f"{specific_date or start_date} 00:00:00" if (specific_date or start_date) else None
            time_end   = f"{specific_date or end_date} 23:59:59"   if (specific_date or end_date)   else None
            rows = rds_config.get_lot_state(
                start_time=time_start,
                end_time=time_end,
                eqp_id=eqp_id,
            )
            rows = rows[:DEFAULT_LIMIT]
            print(f"   → {len(rows)}행 조회")
            if rows:
                sections.append(_format_lot_state(rows))

        # ── rcp_state ──────────────────────────────────────────
        if 'rcp_state' in needed_tables:
            print(f"\n   rcp_state 조회 중...")
            rows = rds_config.get_rcp_state(eqp_id=eqp_id)
            print(f"   → {len(rows)}행 조회")
            if rows:
                sections.append(_format_rcp_state(rows))

    except Exception as e:
        print(f"   [ERROR] DB 조회 실패: {e}")
        print("=" * 60 + "\n")
        return {'db_context': f'[DB 조회 실패: {e}]'}

    db_context = "\n\n".join(sections) if sections else ""
    print(f"\n   DB 컨텍스트 생성 완료 ({len(db_context)}자)")
    print("=" * 60 + "\n")

    return {'db_context': db_context}
