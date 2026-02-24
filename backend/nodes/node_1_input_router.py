"""
Node 1: Input Router
프론트엔드 요청을 받아서 워크플로우를 시작합니다.

두 가지 경로:
1. alarm: 최신 알람 분석 (프론트가 알람창 클릭)
2. question: 과거 데이터 질문 (프론트가 챗봇 사용)
"""

import sys
from pathlib import Path

# 프로젝트 루트 경로 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.utils.data_utils import get_latest_alarm


def node_1_input_router(state: dict) -> dict:
    """
    입력 타입에 따라 초기 설정을 수행합니다.
    
    Args:
        state: 현재 Agent State
            - input_type: "alarm" 또는 "question"
            - input_data: 입력 데이터 (optional)
    
    Returns:
        dict: 업데이트할 State
    
    알람 경로:
        - 최신 알람 정보를 자동으로 로드
        - alarm_date, alarm_eqp_id, alarm_kpi 설정
    
    질문 경로:
        - question_text 설정
    """
    
    print("\n" + "=" * 60)
    print("[Node 1] Input Router 실행")
    print("=" * 60)
    
    input_type = state.get('input_type')
    
    # 타입 검증
    if input_type not in ['alarm', 'question']:
        print(f"- 잘못된 입력 타입: {input_type}")
        return {
            'input_type': 'question',
            'error': f'Invalid input_type: {input_type}'
        }
    
    print(f"- 입력 타입: {input_type}")
    
    # === 알람 경로 ===
    if input_type == 'alarm':
        print("\n알람 경로 선택")
        
        # 최신 알람 정보 조회
        latest_alarm = get_latest_alarm()
        
        if not latest_alarm:
            print("- 알람 정보를 찾을 수 없습니다")
            return {
                'error': 'No alarm found'
            }
        
        print(f"- 최신 알람 로드:")
        print(f"   - 날짜: {latest_alarm['date']}")
        print(f"   - 장비: {latest_alarm['eqp_id']}")
        print(f"   - KPI: Node 2에서 판단")

        # State 업데이트 (alarm_kpi는 Node 2에서 kpi_daily 데이터로 판단)
        update = {
            'alarm_date': latest_alarm['date'],
            'alarm_eqp_id': latest_alarm['eqp_id'],
        }
    
    # === 질문 경로 ===
    else:  # question
        print("\n질문 경로 선택")
        
        input_data = state.get('input_data', '')
        print(f"  - 질문: {input_data[:100]}...")
        
        # State 업데이트 - question_text 필드 설정
        update = {
            'question_text': input_data
        }
    
    print("=" * 60 + "\n")
    
    return update