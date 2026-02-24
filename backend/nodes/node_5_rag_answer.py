"""
Node 5: RAG Answer
과거 리포트를 참고하여 사용자 질문에 답변합니다.

입력:
- question_text: 사용자 질문
- report_exists: 리포트 존재 여부

출력:
- final_answer: LLM이 생성한 답변
- similar_reports: 참고한 리포트 목록
"""

import sys
from pathlib import Path

# 프로젝트 루트 경로 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.config.chroma_config import chroma_config
from backend.config.aws_config import aws_config
from backend.utils.prompt_templates import get_question_answer_prompt


def node_5_rag_answer(state: dict) -> dict:
    """
    과거 리포트를 참고하여 사용자 질문에 답변합니다.
    
    Args:
        state: 현재 Agent State
            - question_text: 사용자 질문
            - report_exists: 리포트 존재 여부 (optional)
    
    Returns:
        dict: 업데이트할 State
            - final_answer: 답변 텍스트
            - similar_reports: 참고한 리포트
            - error: 에러 메시지 (실패 시)
    """
    
    print("\n" + "=" * 60)
    print("- [Node 5] RAG Answer 실행")
    print("=" * 60)
    
    # 1. 질문 가져오기
    question = state.get('question_text') or state.get('input_data', '')
    
    if not question:
        error_msg = "질문이 없습니다"
        print(f"- {error_msg}")
        return {'error': error_msg}
    
    print(f"- 질문: {question}\n")
    
    # 2. ChromaDB에서 유사 리포트 검색
    print("- 유사 리포트 검색 중...")
    
    try:
        similar_reports = chroma_config.search_similar_reports(
            query_text=question,
            n_results=3  # 최대 3개 참고
        )
        
        if similar_reports:
            print(f"   - {len(similar_reports)}개 리포트 발견")
            for i, report in enumerate(similar_reports, 1):
                print(f"   {i}. {report['id']} (거리: {report['distance']:.4f})")
        else:
            print(f"   - 유사 리포트 없음")
            similar_reports = []
    
    except Exception as e:
        print(f"   - 검색 실패: {e}")
        similar_reports = []
    
    # 3. 프롬프트 생성
    print(f"\n- 답변 생성 중...")
    prompt = get_question_answer_prompt(
        question=question,
        similar_reports=similar_reports
    )
    
    # 4. LLM 호출
    print(f"- Claude 호출 중...")
    
    try:
        # metadata 업데이트
        metadata = state.get('metadata', {})
        llm_calls = metadata.get('llm_calls', 0)
        metadata['llm_calls'] = llm_calls + 1
        
        # Claude 호출
        answer = aws_config.invoke_claude(prompt)
        
        print(f"   - 답변 생성 완료 ({len(answer)}자)")
        
    except Exception as e:
        error_msg = f"LLM 호출 실패: {str(e)}"
        print(f"   - {error_msg}")
        return {'error': error_msg}
    
    # 5. 답변 미리보기
    print(f"\n- 답변 미리보기:")
    print("=" * 60)
    lines = answer.split('\n')
    for line in lines[:10]:  # 처음 10줄
        print(line)
    if len(lines) > 10:
        print("...")
    print("=" * 60)
    
    # 6. 통계
    print(f"\n- 결과:")
    print(f"   참고 리포트: {len(similar_reports)}개")
    print(f"   답변 길이: {len(answer)}자")
    print(f"   LLM 호출: {metadata['llm_calls']}회")
    
    print("=" * 60 + "\n")
    
    # 7. State 업데이트
    return {
        'final_answer': answer,
        'similar_reports': similar_reports,
        'metadata': metadata
    }