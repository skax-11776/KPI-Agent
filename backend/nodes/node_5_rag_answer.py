"""
Node 5: RAG Answer
과거 리포트를 참고하여 사용자 질문에 답변합니다.
"""
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.config.chroma_config import chroma_config
from backend.config.aws_config import aws_config
from backend.utils.prompt_templates import get_question_answer_prompt


def _get_search_count(question: str) -> int:
    """질문 유형에 따라 검색할 리포트 수를 결정합니다."""
    question_lower = question.lower()

    # 전체 조회 키워드
    all_keywords = ["전체", "모든", "모두", "전부", "12일", "12건",
                    "전체적", "전반적", "요약", "총", "목록", "여태", "지금까지", "모두"]
    if any(kw in question_lower for kw in all_keywords):
        total = chroma_config.count_reports()
        print(f"   📊 전체 조회 모드: {total}개")
        return total if total > 0 else 20

    # 다수 조회 키워드
    multi_keywords = ["여러", "패턴", "비교", "트렌드", "자주", "주로",
                      "어떤 장비", "어떤 kpi", "분석해", "알려줘"]
    if any(kw in question_lower for kw in multi_keywords):
        return 10

    # 기본값
    return 5


def node_5_rag_answer(state: dict) -> dict:
    """
    과거 리포트를 참고하여 사용자 질문에 답변합니다.
    """
    print("\n" + "=" * 60)
    print("💬 [Node 5] RAG Answer 실행")
    print("=" * 60)

    # 1. 질문 가져오기
    question = state.get('question_text') or state.get('input_data', '')
    if not question:
        return {'error': '질문이 없습니다'}

    print(f"💬 질문: {question}\n")

    # 2. 리포트 검색
    print("🔍 유사 리포트 검색 중...")

    try:
        # Node 4에서 날짜 매칭으로 찾은 리포트 우선 사용
        already_found = state.get('similar_reports', [])

        if already_found:
            print(f"   ✅ Node 4 전달 리포트 사용: {already_found[0]['id']}")
            similar_reports = already_found
        else:
            # 질문 유형에 따라 검색 수 결정
            n = _get_search_count(question)
            print(f"   🔢 검색 개수: {n}개")
            similar_reports = chroma_config.search_similar_reports(
                query_text=question,
                n_results=n
            )

        if similar_reports:
            print(f"   ✅ {len(similar_reports)}개 리포트 발견")
            for i, r in enumerate(similar_reports, 1):
                dist = r.get('distance', 0)
                print(f"   {i}. {r['id']} (거리: {dist:.4f})")
        else:
            print(f"   ⚠️ 유사 리포트 없음")
            similar_reports = []

    except Exception as e:
        print(f"   ❌ 검색 실패: {e}")
        similar_reports = []

    # 3. 프롬프트 생성 및 LLM 호출
    print(f"\n📋 답변 생성 중...")
    prompt = get_question_answer_prompt(
        question=question,
        similar_reports=similar_reports
    )

    print(f"🤖 Claude 호출 중...")
    try:
        metadata = state.get('metadata', {})
        metadata['llm_calls'] = metadata.get('llm_calls', 0) + 1
        answer = aws_config.invoke_claude(prompt)
        print(f"   ✅ 답변 생성 완료 ({len(answer)}자)")
    except Exception as e:
        error_msg = f"LLM 호출 실패: {str(e)}"
        print(f"   ❌ {error_msg}")
        return {'error': error_msg}

    # 4. 결과 미리보기
    print(f"\n💬 답변 미리보기:")
    print("=" * 60)
    for line in answer.split('\n')[:10]:
        print(line)
    print("=" * 60)

    print(f"\n📊 결과:")
    print(f"   참고 리포트: {len(similar_reports)}개")
    print(f"   답변 길이: {len(answer)}자")
    print(f"   LLM 호출: {metadata['llm_calls']}회")
    print("=" * 60 + "\n")

    return {
        'final_answer': answer,
        'similar_reports': similar_reports,
        'metadata': metadata
    }