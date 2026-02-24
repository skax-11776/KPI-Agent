"""
Node 6: Root Cause Analysis
LLM을 사용하여 알람의 근본 원인을 분석합니다.

입력:
- context_text: 포맷팅된 컨텍스트 데이터
- alarm_kpi: 문제가 된 KPI

출력:
- root_causes: 근본 원인 후보 리스트 (확률, 근거 포함)
"""

import sys
from pathlib import Path
import json

# 프로젝트 루트 경로 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.config.aws_config import aws_config
from backend.utils.prompt_templates import get_root_cause_analysis_prompt


def node_6_root_cause_analysis(state: dict) -> dict:
    """
    LLM을 사용하여 근본 원인을 분석합니다.
    
    Args:
        state: 현재 Agent State
            - context_text: 분석할 컨텍스트 데이터
            - alarm_kpi: 문제가 된 KPI
    
    Returns:
        dict: 업데이트할 State
            - root_causes: 근본 원인 후보 리스트
                [
                    {
                        "cause": "원인 설명",
                        "probability": 40,
                        "evidence": "근거"
                    },
                    ...
                ]
            - error: 에러 메시지 (실패 시)
    """
    
    print("\n" + "=" * 60)
    print("- [Node 6] Root Cause Analysis 실행")
    print("=" * 60)
    
    # 1. State에서 필요한 정보 가져오기
    context_text = state.get('context_text')
    alarm_kpi = state.get('alarm_kpi')
    
    if not context_text:
        error_msg = "컨텍스트 데이터가 없습니다"
        print(f"- {error_msg}")
        return {'error': error_msg}
    
    print(f"- KPI: {alarm_kpi}")
    print(f"- 컨텍스트 크기: {len(context_text)}자")
    
    # 2. 프롬프트 생성
    print(f"\n- 프롬프트 생성 중...")
    prompt = get_root_cause_analysis_prompt(context_text)
    print(f"   - 프롬프트 생성 완료 ({len(prompt)}자)")
    
    # 3. LLM 호출
    print(f"\n- Claude 호출 중... (이 작업은 몇 초 걸릴 수 있습니다)")
    
    try:
        # metadata 업데이트 (LLM 호출 횟수)
        metadata = state.get('metadata', {})
        llm_calls = metadata.get('llm_calls', 0)
        metadata['llm_calls'] = llm_calls + 1
        
        # Claude 호출
        response_text = aws_config.invoke_claude(prompt)
        
        print(f"   - Claude 응답 받음 ({len(response_text)}자)")
        
    except Exception as e:
        error_msg = f"LLM 호출 실패: {str(e)}"
        print(f"   - {error_msg}")
        return {'error': error_msg}
    
    # 4. 응답 파싱 (JSON 추출)
    print(f"\n- 응답 파싱 중...")
    
    try:
        # JSON 블록 추출 (```json ... ``` 또는 {...})
        json_text = _extract_json(response_text)
        
        # JSON 파싱
        result = json.loads(json_text)
        
        # 필수 필드 검증
        if 'root_causes' not in result:
            raise ValueError("root_causes 필드가 없습니다")
        
        root_causes = result['root_causes']
        
        # 각 원인 검증
        for cause in root_causes:
            if 'cause' not in cause or 'probability' not in cause or 'evidence' not in cause:
                raise ValueError("원인 데이터 형식 오류")
        
        print(f"   - {len(root_causes)}개 근본 원인 후보 추출")
        
    except Exception as e:
        error_msg = f"응답 파싱 실패: {str(e)}"
        print(f"   - {error_msg}")
        print(f"\n원본 응답:\n{response_text[:500]}...")
        return {'error': error_msg}
    
    # 5. 결과 출력
    print(f"\n- 근본 원인 분석 결과:")
    print(f"\n문제 요약: {result.get('problem_summary', 'N/A')}")
    print(f"\n근본 원인 후보:")
    
    for i, cause in enumerate(root_causes, 1):
        print(f"\n{i}. {cause['cause']}")
        print(f"   확률: {cause['probability']}%")
        print(f"   근거: {cause['evidence'][:100]}...")
    
    print("\n" + "=" * 60 + "\n")
    
    # 6. State 업데이트
    return {
        'root_causes': root_causes,
        'metadata': metadata
    }


def _extract_json(text: str) -> str:
    """
    텍스트에서 JSON 블록을 추출합니다.
    
    Args:
        text: LLM 응답 텍스트
    
    Returns:
        str: JSON 문자열
    """
    
    # 1. ```json ... ``` 블록 찾기
    import re
    
    json_block = re.search(r'```json\s*(\{.*?\})\s*```', text, re.DOTALL)
    if json_block:
        return json_block.group(1)
    
    # 2. ``` ... ``` 블록 찾기 (json 키워드 없이)
    code_block = re.search(r'```\s*(\{.*?\})\s*```', text, re.DOTALL)
    if code_block:
        return code_block.group(1)
    
    # 3. { ... } 직접 찾기
    json_obj = re.search(r'\{.*\}', text, re.DOTALL)
    if json_obj:
        return json_obj.group(0)
    
    # 4. 찾지 못하면 전체 텍스트 반환
    return text