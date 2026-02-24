"""
Node 4: Report Lookup
사용자 질문과 관련된 과거 리포트가 있는지 확인합니다.

입력:
- input_data: 사용자 질문
- input_type: "question"

출력:
- report_exists: 관련 리포트 존재 여부 (True/False)
- question_text: 정제된 질문 텍스트
"""

import sys
from pathlib import Path

# 프로젝트 루트 경로 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.config.chroma_config import chroma_config


def node_4_report_lookup(state: dict) -> dict:
    """
    사용자 질문과 관련된 과거 리포트가 있는지 확인합니다.
    
    Args:
        state: 현재 Agent State
            - input_data: 사용자 질문 텍스트
    
    Returns:
        dict: 업데이트할 State
            - report_exists: 리포트 존재 여부
            - question_text: 정제된 질문
    """
    
    print("\n" + "=" * 60)
    print("- [Node 4] Report Lookup 실행")
    print("=" * 60)
    
    # 1. 사용자 질문 가져오기
    question = state.get('input_data', '')
    
    if not question:
        print("- 질문이 없습니다")
        return {
            'report_exists': False,
            'question_text': ''
        }
    
    print(f"- 사용자 질문: {question}\n")
    
    # 2. ChromaDB에서 유사 리포트 검색
    print("- ChromaDB에서 관련 리포트 검색 중...")
    
    try:
        # 유사도가 높은 리포트 1개만 확인
        results = chroma_config.search_similar_reports(
            query_text=question,
            n_results=1
        )
        
        if results and len(results) > 0:
            # 유사도 확인 (거리가 낮을수록 유사)
            # 거리 < 1.5 정도면 관련 있다고 판단
            distance = results[0]['distance']
            
            print(f"   - 관련 리포트 발견")
            print(f"   - 유사도 거리: {distance:.4f}")
            print(f"   - 리포트 ID: {results[0]['id']}")
            
            # 유사도 임계값 확인
            if distance < 1.5:
                report_exists = True
                print(f"   - 관련성 높음 (거리 < 1.5)")
            else:
                report_exists = False
                print(f"   - 관련성 낮음 (거리 >= 1.5)")
        else:
            report_exists = False
            print(f"   - 관련 리포트 없음")
    
    except Exception as e:
        print(f"   - 검색 실패: {e}")
        report_exists = False
    
    print(f"\n결과: {'과거 리포트 있음' if report_exists else '과거 리포트 없음'}")
    print("=" * 60 + "\n")
    
    # 3. State 업데이트
    return {
        'report_exists': report_exists,
        'question_text': question
    }