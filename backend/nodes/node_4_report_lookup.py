import re
import sys
from pathlib import Path

# 프로젝트 루트 경로 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.config.chroma_config import chroma_config
def node_4_report_lookup(state: dict) -> dict:
    
    print("\n" + "=" * 60)
    print("[Node 4] Report Lookup 실행")
    print("=" * 60)

    question = state.get('input_data', '')
    if not question:
        return {'report_exists': False, 'question_text': ''}

    print(f"사용자 질문: {question}\n")

    # ── 1. 날짜 추출 시도 ──────────────────────────────
    date_str = _extract_date(question)
    
    if date_str:
        print(f"날짜 감지: {date_str} → 메타데이터 직접 검색")
        result = chroma_config.get_report_by_date(date_str)
        if result:
            print(f"   날짜 매칭 리포트 발견: {result['id']}")
            return {
                'report_exists': True,
                'question_text': question,
                'similar_reports': [result]
            }
        else:
            print(f"   [ERROR] {date_str} 날짜의 리포트 없음")

    # ── 2. 의미론적 유사도 검색 ────────────────────────
    print("ChromaDB에서 관련 리포트 검색 중...")
    try:
        results = chroma_config.search_similar_reports(
            query_text=question,
            n_results=3
        )

        similar_reports = []
        if results and len(results) > 0:
            for r in results:
                distance = r['distance']
                print(f"   리포트 ID: {r['id']} | 유사도 거리: {distance:.4f}")
                if distance < 1.0:
                    similar_reports.append(r)

            if similar_reports:
                report_exists = True
                print(f"   관련성 있음 ({len(similar_reports)}개)")
            else:
                report_exists = False
                print(f"   [WARN] 관련성 낮음 (임계값 1.0 초과)")
        else:
            report_exists = False

    except Exception as e:
        print(f"   [ERROR] 검색 실패: {e}")
        report_exists = False
        similar_reports = []

    print(f"\n결과: {'과거 리포트 있음' if report_exists else '과거 리포트 없음'}")
    print("=" * 60 + "\n")

    return {
        'report_exists': report_exists,
        'question_text': question,
        'similar_reports': similar_reports
    }


def _extract_date(question: str) -> str:
    """
    질문에서 날짜를 추출합니다.
    예: "1월 23일" → "2026-01-23"
        "2026년 1월 23일" → "2026-01-23"
    """
    # 패턴 1: "2026년 1월 23일"
    m = re.search(r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일', question)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

    # 패턴 2: "1월 23일" (연도 없으면 2026 기본값)
    m = re.search(r'(\d{1,2})월\s*(\d{1,2})일', question)
    if m:
        return f"2026-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

    # 패턴 3: "2026-01-23"
    m = re.search(r'(\d{4})-(\d{2})-(\d{2})', question)
    if m:
        return m.group(0)

    return None