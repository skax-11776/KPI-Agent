"""
Node 4B: Question Classifier
질문을 분석하여 필요한 데이터 소스(DB/RAG)와 쿼리 필터를 결정합니다.

LLM 호출 없이 정규식 + 키워드 기반으로 처리 (빠르고 비용 없음)

결정 사항:
- needs_db: RDS 쿼리 필요 여부
- needs_rag: ChromaDB RAG 검색 필요 여부
- needed_tables: 조회할 테이블 목록
- query_filters: 날짜, 장비 ID 등 필터
"""

import re
import sys
from pathlib import Path
from datetime import datetime, timedelta

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))


# ── 테이블별 키워드 ────────────────────────────────────────────
TABLE_KEYWORDS = {
    'kpi_daily': [
        'oee', 'thp', 'tat', 'wip', '추이', '달성', '목표', '실적',
        'kpi', '성능', '효율', '처리량', '소요시간', '재공', '트렌드',
        '이번 달', '지난달', '최근', '일별',
    ],
    'eqp_state': [
        'down', '다운', '장비 상태', '가동', '중단', '고장', '설비',
        '상태 이상', 'eqp', '장비', '자주', '반복', '멈',
    ],
    'lot_state': [
        'lot', '로트', '웨이퍼', '배치', '투입', '공급',
    ],
    'rcp_state': [
        'rcp', '레시피', '복잡도', 'recipe',
    ],
}

# RAG가 필요한 키워드 (과거 보고서 참조)
RAG_KEYWORDS = [
    '보고서', '과거', '이전에', '비슷한', '원인 분석', '사례',
    '유사', '알람 이력', '분석 리포트', '분석해', '왜', '원인',
    '해결', '조치', '대책',
]

# DB만 필요하고 RAG는 불필요한 키워드
DB_ONLY_KEYWORDS = [
    '장비 상태', '가동 현황', '지금 down', '지금 상태',
    '현재 상태', '실시간',
]

# live_context만으로 답변 가능한 키워드 (DB/RAG 모두 불필요)
# 조건: 날짜/장비 특정 없이 "지금/현재" 단순 수치 조회
LIVE_ONLY_KEYWORDS = [
    '지금 oee', '지금 thp', '지금 tat', '지금 wip',
    '현재 oee', '현재 thp', '현재 tat', '현재 wip',
    'oee 얼마', 'thp 얼마', 'tat 얼마', 'wip 얼마',
    'oee 몇', 'thp 몇', 'tat 몇', 'wip 몇',
    '임계값', '임계 값', 'threshold',
    '목표값 뭐', '기준값',
    '정상이야', '정상인가', '이상이야', '이상인가',
]


def _extract_date(text: str) -> str | None:
    """질문에서 날짜를 추출합니다."""
    # "2026년 1월 23일"
    m = re.search(r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일', text)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

    # "1월 23일" (연도 없으면 2026 기본값)
    m = re.search(r'(\d{1,2})월\s*(\d{1,2})일', text)
    if m:
        return f"2026-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

    # "2026-01-23"
    m = re.search(r'(\d{4})-(\d{2})-(\d{2})', text)
    if m:
        return m.group(0)

    return None


def _extract_eqp_id(text: str) -> str | None:
    """질문에서 장비 ID를 추출합니다."""
    m = re.search(r'EQP\d+', text.upper())
    return m.group(0) if m else None


def _extract_date_range(text: str) -> tuple[str, str] | None:
    """
    상대적 날짜 표현을 절대 날짜 범위로 변환합니다.
    기준일: 2026-01-31 (데이터 최신일 기준)
    """
    BASE_DATE = datetime(2026, 1, 31)

    if '이번 달' in text or '1월' in text:
        return ('2026-01-01', '2026-01-31')
    if '지난주' in text or '지난 주' in text:
        end = BASE_DATE
        start = end - timedelta(days=7)
        return (start.strftime('%Y-%m-%d'), end.strftime('%Y-%m-%d'))
    if '최근' in text:
        end = BASE_DATE
        start = end - timedelta(days=14)
        return (start.strftime('%Y-%m-%d'), end.strftime('%Y-%m-%d'))

    return None


def node_4b_classifier(state: dict) -> dict:
    """
    질문을 분석하여 필요한 데이터 소스와 쿼리 필터를 결정합니다.

    Args:
        state: 현재 Agent State
            - input_data: 사용자 질문

    Returns:
        dict: 업데이트할 State
            - needs_db: RDS 조회 필요 여부
            - needs_rag: RAG 검색 필요 여부
            - needed_tables: 조회할 테이블 목록
            - query_filters: {date, eqp_id, start_date, end_date}
    """
    print("\n" + "=" * 60)
    print("[Node 4B] Question Classifier 실행")
    print("=" * 60)

    question = state.get('input_data', '')
    q_lower = question.lower()

    # ── 1. 메타데이터 추출 ────────────────────────────────────
    specific_date = _extract_date(question)
    eqp_id = _extract_eqp_id(question)
    date_range = _extract_date_range(question) if not specific_date else None

    query_filters = {}
    if specific_date:
        query_filters['date'] = specific_date
        print(f"   날짜 추출: {specific_date}")
    if eqp_id:
        query_filters['eqp_id'] = eqp_id
        print(f"   장비 추출: {eqp_id}")
    if date_range:
        query_filters['start_date'], query_filters['end_date'] = date_range
        print(f"   날짜 범위: {date_range[0]} ~ {date_range[1]}")

    # ── 2. 필요한 테이블 결정 ─────────────────────────────────
    needed_tables = []
    for table, keywords in TABLE_KEYWORDS.items():
        if any(kw in q_lower for kw in keywords):
            needed_tables.append(table)

    # 장비 ID가 있으면 eqp_state, kpi_daily 기본 포함
    if eqp_id:
        if 'eqp_state' not in needed_tables:
            needed_tables.append('eqp_state')
        if 'kpi_daily' not in needed_tables:
            needed_tables.append('kpi_daily')

    # 테이블이 하나도 감지 안 되면 기본 kpi_daily 포함
    if not needed_tables and any(kw in q_lower for kw in ['상태', '현황', '어때', '이래']):
        needed_tables = ['kpi_daily', 'eqp_state']

    needs_db = len(needed_tables) > 0

    # ── 3. live_only 판단 (DB/RAG 모두 불필요) ────────────────
    # 날짜·장비 특정 없이 단순 현재값/임계값 질문이면 live_context만으로 충분
    is_live_only = (
        any(kw in q_lower for kw in LIVE_ONLY_KEYWORDS)
        and not specific_date
        and not eqp_id
        and not any(kw in q_lower for kw in RAG_KEYWORDS)
    )

    if is_live_only:
        needs_db  = False
        needs_rag = False
        needed_tables = []
        route = 'live_only'
        print(f"   경로: live_only (live_context만 참조)")
        print("=" * 60 + "\n")
        return {
            'needs_db': False,
            'needs_rag': False,
            'needed_tables': [],
            'query_filters': {},
            'qa_route': 'live_only',
        }

    # ── 4. RAG 필요 여부 결정 ─────────────────────────────────
    needs_rag = any(kw in q_lower for kw in RAG_KEYWORDS)

    # DB만으로 충분한 경우 RAG 스킵
    if any(kw in q_lower for kw in DB_ONLY_KEYWORDS):
        needs_rag = False

    # DB도 RAG도 안 잡히면 기본 RAG 사용
    if not needs_db and not needs_rag:
        needs_rag = True

    route = 'db' if needs_db else 'rag'

    # ── 5. 결과 출력 ──────────────────────────────────────────
    print(f"   경로: {route}")
    print(f"   DB 조회: {'필요' if needs_db else '불필요'}")
    if needed_tables:
        print(f"   테이블: {', '.join(needed_tables)}")
    print(f"   RAG 검색: {'필요' if needs_rag else '불필요'}")
    print("=" * 60 + "\n")

    return {
        'needs_db': needs_db,
        'needs_rag': needs_rag,
        'needed_tables': needed_tables,
        'query_filters': query_filters,
        'qa_route': route,
    }
