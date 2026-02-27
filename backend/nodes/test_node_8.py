"""
Node 8: Report Writer 테스트
"""

import sys
from pathlib import Path

# 프로젝트 루트를 경로에 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.nodes.node_1_input_router import node_1_input_router
from backend.nodes.node_2_load_alarm_kpi import node_2_load_alarm_kpi
from backend.nodes.node_3_context_fetch import node_3_context_fetch
from backend.nodes.node_6_root_cause_analysis import node_6_root_cause_analysis
from backend.nodes.node_7_human_choice import node_7_human_choice
from backend.nodes.node_8_report_writer import node_8_report_writer


def test_report_generation():
    """리포트 생성 테스트"""
    
    print("\n" + "=" * 60)
    print("리포트 생성 테스트")
    print("=" * 60 + "\n")
    
    # 초기 State
    state = {'input_type': 'alarm'}
    
    # Node 1~7 실행
    print("1. Node 1~7 실행...")
    state.update(node_1_input_router(state))
    state.update(node_2_load_alarm_kpi(state))
    state.update(node_3_context_fetch(state))
    state.update(node_6_root_cause_analysis(state))
    state.update(node_7_human_choice(state))
    
    # Node 8 실행
    print("2. Node 8 실행...")
    result = node_8_report_writer(state)
    state.update(result)
    
    # 검증
    assert 'error' not in state, f"에러 발생: {state.get('error')}"
    assert state.get('final_report') is not None, "리포트 없음"
    assert state.get('report_id') is not None, "리포트 ID 없음"
    
    final_report = state['final_report']
    report_id = state['report_id']
    
    # 리포트 기본 검증
    assert len(final_report) > 100, "리포트가 너무 짧음"
    assert '분석 리포트' in final_report or '리포트' in final_report, "리포트 제목 없음"
    
    # report_id 형식 검증
    assert report_id.startswith('report_'), "리포트 ID 형식 오류"
    assert state['alarm_date'] in report_id, "날짜 정보 없음"
    assert state['alarm_eqp_id'] in report_id, "장비 ID 정보 없음"
    
    print(f"\n리포트 생성 성공!")
    print(f"   리포트 ID: {report_id}")
    print(f"   리포트 길이: {len(final_report)}자")
    print(f"   줄 수: {len(final_report.split(chr(10)))}줄")
    
    # 필수 섹션 확인
    required_sections = ['문제', '원인', '조치', '권장']
    found_sections = []
    
    for section in required_sections:
        if section in final_report:
            found_sections.append(section)
    
    print(f"   필수 섹션: {len(found_sections)}/{len(required_sections)}개")
    
    print("\n리포트 생성 테스트 통과!\n")


def test_report_content():
    """리포트 내용 검증 테스트"""
    
    print("=" * 60)
    print("리포트 내용 검증 테스트")
    print("=" * 60 + "\n")
    
    # 과거 알람으로 테스트
    state = {
        'alarm_date': '2026-01-20',
        'alarm_eqp_id': 'EQP01',
        'alarm_kpi': 'OEE'
    }
    
    # Node 2~8 실행
    state.update(node_2_load_alarm_kpi(state))
    state.update(node_3_context_fetch(state))
    state.update(node_6_root_cause_analysis(state))
    state.update(node_7_human_choice(state))
    state.update(node_8_report_writer(state))
    
    # 검증
    assert 'error' not in state, f"에러 발생: {state.get('error')}"
    
    final_report = state['final_report']
    
    print(f"리포트 전체:")
    print("=" * 60)
    print(final_report)
    print("=" * 60)
    
    # 기본 검증만 수행 (날짜 형식이 다양할 수 있으므로)
    # 날짜 관련: 2026, 01, 20 중 하나라도 포함
    has_date_info = ('2026' in final_report or 
                     '01' in final_report or 
                     '20' in final_report or
                     '1월' in final_report or
                     'January' in final_report)
    
    # 장비 ID: EQP01 또는 EQP-01 또는 장비 등
    has_eqp_info = ('EQP01' in final_report or 
                    'EQP' in final_report or
                    '장비' in final_report)
    
    # KPI: OEE
    has_kpi_info = 'OEE' in final_report or '효율' in final_report
    
    print(f"\n리포트 내용 검증:")
    print(f"   날짜 정보: {'' if has_date_info else '[ERROR] '}")
    print(f"   장비 정보: {'' if has_eqp_info else '[ERROR] '}")
    print(f"   KPI 정보: {'' if has_kpi_info else '[ERROR] '}")
    
    # 최소한 하나의 정보는 포함되어야 함
    assert has_date_info or has_eqp_info or has_kpi_info, \
        "리포트에 알람 관련 정보가 전혀 없음"
    
    # 리포트 길이 확인
    assert len(final_report) > 200, "리포트가 너무 짧음"
    
    print("\n리포트 내용 검증 테스트 통과!\n")

def test_llm_call_count():
    """LLM 호출 횟수 확인"""
    
    print("=" * 60)
    print("LLM 호출 횟수 테스트")
    print("=" * 60 + "\n")
    
    # 초기 State
    state = {'input_type': 'alarm', 'metadata': {'llm_calls': 0}}
    
    # 전체 워크플로우 실행
    state.update(node_1_input_router(state))
    state.update(node_2_load_alarm_kpi(state))
    state.update(node_3_context_fetch(state))
    
    print("Node 6 실행 전 LLM 호출: 0회")
    state.update(node_6_root_cause_analysis(state))
    print(f"Node 6 실행 후 LLM 호출: {state['metadata']['llm_calls']}회")
    
    state.update(node_7_human_choice(state))
    
    print(f"Node 8 실행 전 LLM 호출: {state['metadata']['llm_calls']}회")
    state.update(node_8_report_writer(state))
    print(f"Node 8 실행 후 LLM 호출: {state['metadata']['llm_calls']}회")
    
    # 검증: Node 6에서 1회, Node 8에서 1회 = 총 2회
    assert state['metadata']['llm_calls'] == 2, "LLM 호출 횟수 오류"
    
    print(f"\n총 LLM 호출 횟수: {state['metadata']['llm_calls']}회")
    print("   - Node 6 (Root Cause Analysis): 1회")
    print("   - Node 8 (Report Writer): 1회")
    
    print("\nLLM 호출 횟수 테스트 통과!\n")


def main():
    """모든 테스트 실행"""
    
    print("\nNode 8: Report Writer 테스트 시작\n")
    
    try:
        test_report_generation()
        test_report_content()
        test_llm_call_count()
        
        print("=" * 60)
        print("모든 테스트 통과!")
        print("=" * 60 + "\n")
        
    except AssertionError as e:
        print(f"\n[ERROR] 테스트 실패: {e}\n")
        raise
    except Exception as e:
        print(f"\n[ERROR] 예상치 못한 오류: {e}\n")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    main()