"""
Node 8: Report Writer
선택된 근본 원인을 바탕으로 최종 분석 리포트를 작성합니다.

입력:
- selected_cause: 선택된 근본 원인
- context_text: 컨텍스트 데이터
- kpi_data: KPI 데이터

출력:
- final_report: 최종 분석 리포트 (마크다운)
- report_id: 리포트 고유 ID
"""

import sys
from pathlib import Path
from datetime import datetime

# 프로젝트 루트 경로 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.config.aws_config import aws_config
from backend.utils.prompt_templates import get_report_writer_prompt


def node_8_report_writer(state: dict) -> dict:
    """
    선택된 근본 원인을 바탕으로 최종 분석 리포트를 작성합니다.
    
    Args:
        state: 현재 Agent State
            - selected_cause: 선택된 근본 원인
            - context_text: 컨텍스트 데이터
            - kpi_data: KPI 데이터
            - alarm_date: 알람 날짜
            - alarm_eqp_id: 장비 ID
            - alarm_kpi: KPI
    
    Returns:
        dict: 업데이트할 State
            - final_report: 최종 리포트 (마크다운)
            - report_id: 리포트 ID
            - error: 에러 메시지 (실패 시)
    """
    
    print("\n" + "=" * 60)
    print("- [Node 8] Report Writer 실행")
    print("=" * 60)
    
    # 1. State에서 필요한 정보 가져오기
    selected_cause = state.get('selected_cause')
    context_text = state.get('context_text')
    kpi_data = state.get('kpi_data')
    alarm_date = state.get('alarm_date')
    alarm_eqp_id = state.get('alarm_eqp_id')
    alarm_kpi = state.get('alarm_kpi')
    
    # 필수 정보 검증
    if not selected_cause:
        error_msg = "선택된 근본 원인이 없습니다"
        print(f"- {error_msg}")
        return {'error': error_msg}
    
    if not context_text or not kpi_data:
        error_msg = "컨텍스트 또는 KPI 데이터가 없습니다"
        print(f"- {error_msg}")
        return {'error': error_msg}
    
    print(f"- 알람 정보:")
    print(f"   날짜: {alarm_date}")
    print(f"   장비: {alarm_eqp_id}")
    print(f"   KPI: {alarm_kpi}")
    print(f"\n- 선택된 근본 원인:")
    print(f"   {selected_cause['cause']}")
    print(f"   확률: {selected_cause['probability']}%")
    
    # 2. 문제 요약 생성
    problem_summary = _generate_problem_summary(kpi_data, alarm_kpi)
    
    # 3. 프롬프트 생성
    print(f"\n- 프롬프트 생성 중...")
    prompt = get_report_writer_prompt(
        problem_summary=problem_summary,
        selected_cause=selected_cause['cause'],
        evidence=selected_cause['evidence'],
        context_data=context_text
    )
    print(f"   - 프롬프트 생성 완료 ({len(prompt)}자)")
    
    # 4. LLM 호출
    print(f"\n- Claude 호출 중... (이 작업은 몇 초 걸릴 수 있습니다)")
    
    try:
        # metadata 업데이트
        metadata = state.get('metadata', {})
        llm_calls = metadata.get('llm_calls', 0)
        metadata['llm_calls'] = llm_calls + 1
        
        # Claude 호출
        final_report = aws_config.invoke_claude(prompt)
        
        print(f"   - Claude 응답 받음 ({len(final_report)}자)")
        
    except Exception as e:
        error_msg = f"LLM 호출 실패: {str(e)}"
        print(f"   - {error_msg}")
        return {'error': error_msg}
    
    # 5. 리포트 ID 생성
    # 형식: report_YYYYMMDD_EQPXX_KPI
    report_id = f"report_{alarm_date}_{alarm_eqp_id}_{alarm_kpi}"
    print(f"\n🆔 리포트 ID: {report_id}")
    
    # 6. 리포트 미리보기
    print(f"\n- 리포트 미리보기:")
    print("=" * 60)
    lines = final_report.split('\n')
    for line in lines[:15]:  # 처음 15줄만
        print(line)
    print("...")
    print("=" * 60)
    
    # 7. 통계
    print(f"\n- 리포트 통계:")
    print(f"   총 길이: {len(final_report)}자")
    print(f"   줄 수: {len(lines)}줄")
    print(f"   LLM 호출 횟수: {metadata['llm_calls']}회")
    
    print("=" * 60 + "\n")
    
    # 8. State 업데이트
    return {
        'final_report': final_report,
        'report_id': report_id,
        'metadata': metadata
    }


def _generate_problem_summary(kpi_data: dict, alarm_kpi: str) -> str:
    """
    KPI 데이터를 바탕으로 문제 요약을 생성합니다.
    
    Args:
        kpi_data: KPI 데이터
        alarm_kpi: 문제가 된 KPI
    
    Returns:
        str: 문제 요약 텍스트
    """
    
    # KPI별 목표/실제값 추출
    if alarm_kpi == 'OEE':
        target = kpi_data.get('oee_t')
        actual = kpi_data.get('oee_v')
        unit = '%'
        kpi_name = 'OEE (Overall Equipment Effectiveness)'
    elif alarm_kpi == 'THP':
        target = kpi_data.get('thp_t')
        actual = kpi_data.get('thp_v')
        unit = '개'
        kpi_name = '처리량 (Throughput)'
    elif alarm_kpi == 'TAT':
        target = kpi_data.get('tat_t')
        actual = kpi_data.get('tat_v')
        unit = '시간'
        kpi_name = '처리 시간 (Turn Around Time)'
    else:  # WIP
        target = kpi_data.get('wip_t')
        actual = kpi_data.get('wip_v')
        unit = '개'
        kpi_name = '재공품 (Work In Process)'
    
    # 차이 계산
    gap = actual - target
    gap_percent = (gap / target * 100) if target != 0 else 0
    
    # 문제 요약 생성
    summary = f"""
{kpi_name} 지표에 문제가 발생했습니다.

- 목표치: {target}{unit}
- 실제치: {actual}{unit}
- 차이: {gap:+.2f}{unit} ({gap_percent:+.1f}%)

장비 {kpi_data.get('eqp_id')}에서 {kpi_data.get('date')}에 발생한 문제입니다.
    """.strip()
    
    return summary