"""
Node 7: Human Choice
사용자가 근본 원인 후보 중 하나를 선택합니다.

실제 운영:
- 프론트엔드에서 원인 목록을 표시
- 사용자가 하나를 선택
- 선택된 원인 인덱스를 백엔드로 전달

테스트/개발:
- 자동으로 첫 번째 또는 가장 높은 확률의 원인 선택
"""

import sys
from pathlib import Path

# 프로젝트 루트 경로 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))


def node_7_human_choice(state: dict) -> dict:
    """
    사용자가 선택한 근본 원인을 State에 저장합니다.
    
    Args:
        state: 현재 Agent State
            - root_causes: 근본 원인 후보 리스트
            - selected_cause_index: 사용자가 선택한 인덱스 (optional)
    
    Returns:
        dict: 업데이트할 State
            - selected_cause: 선택된 근본 원인
                {
                    "cause": "원인 설명",
                    "probability": 40,
                    "evidence": "근거"
                }
            - error: 에러 메시지 (실패 시)
    """
    
    print("\n" + "=" * 60)
    print("👤 [Node 7] Human Choice 실행")
    print("=" * 60)
    
    # 1. State에서 원인 후보 가져오기
    root_causes = state.get('root_causes', [])
    
    if not root_causes:
        error_msg = "근본 원인 후보가 없습니다"
        print(f"❌ {error_msg}")
        return {'error': error_msg}
    
    print(f"📊 근본 원인 후보: {len(root_causes)}개")
    
    # 2. 원인 목록 표시
    print(f"\n근본 원인 후보:")
    for i, cause in enumerate(root_causes):
        print(f"\n{i+1}. {cause['cause']}")
        print(f"   확률: {cause['probability']}%")
        print(f"   근거: {cause['evidence'][:80]}...")
    
    # 3. 사용자 선택 처리
    selected_index = state.get('selected_cause_index')
    
    # 3-1. 이미 선택된 경우
    if selected_index is not None:
        print(f"\n✅ 사용자가 선택: {selected_index + 1}번")
        
        # 인덱스 검증
        if not 0 <= selected_index < len(root_causes):
            error_msg = f"잘못된 선택 인덱스: {selected_index}"
            print(f"❌ {error_msg}")
            return {'error': error_msg}
        
        selected_cause = root_causes[selected_index]
    
    # 3-2. 선택되지 않은 경우 (자동 선택)
    else:
        print(f"\n⚙️ 자동 선택 모드: 가장 높은 확률의 원인 선택")
        
        # 확률이 가장 높은 원인 선택
        selected_cause = max(root_causes, key=lambda x: x['probability'])
        selected_index = root_causes.index(selected_cause)
        
        print(f"   → {selected_index + 1}번 선택됨")
    
    # 4. 선택된 원인 출력
    print(f"\n✨ 선택된 근본 원인:")
    print(f"   원인: {selected_cause['cause']}")
    print(f"   확률: {selected_cause['probability']}%")
    print(f"   근거: {selected_cause['evidence'][:100]}...")
    
    print("=" * 60 + "\n")
    
    # 5. State 업데이트
    return {
        'selected_cause': selected_cause,
        'selected_cause_index': selected_index
    }


def display_causes_for_selection(root_causes: list) -> None:
    """
    프론트엔드에서 사용할 수 있도록 원인 목록을 포맷팅합니다.
    
    실제 프론트엔드 구현 시 참고용 함수입니다.
    
    Args:
        root_causes: 근본 원인 후보 리스트
    """
    
    print("\n" + "=" * 60)
    print("근본 원인 분석 결과")
    print("=" * 60 + "\n")
    
    print("다음 중 가장 가능성 높은 원인을 선택해주세요:\n")
    
    for i, cause in enumerate(root_causes, 1):
        print(f"[{i}] {cause['cause']}")
        print(f"    가능성: {cause['probability']}%")
        print(f"    근거: {cause['evidence']}")
        print()
    
    print("=" * 60)