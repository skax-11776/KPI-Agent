"""
LLM 프롬프트 템플릿
"""

def get_root_cause_analysis_prompt(context_data: str) -> str:
    """
    근본 원인 분석을 위한 프롬프트를 생성합니다.
    
    Args:
        context_data: 분석할 컨텍스트 데이터
    
    Returns:
        str: 프롬프트 문자열
    """
    return f"""당신은 제조 라인 KPI 분석 전문가입니다. 
아래 데이터를 분석하여 문제의 근본 원인을 찾아주세요.

{context_data}

**분석 요구사항:**
1. 문제점을 명확히 정의하세요
2. 가능한 근본 원인을 3~5개 제시하세요
3. 각 원인의 가능성을 퍼센트(%)로 표시하세요
4. 각 원인에 대한 증거/근거를 제시하세요

**출력 형식:**
JSON 형식으로 다음과 같이 출력하세요:
{{
    "problem_summary": "문제 요약",
    "root_causes": [
        {{
            "cause": "원인 1",
            "probability": 40,
            "evidence": "근거 설명"
        }},
        ...
    ]
}}
"""


def get_report_writer_prompt(
    problem_summary: str,
    selected_cause: str,
    evidence: str,
    context_data: str
) -> str:
    """
    최종 분석 리포트 작성을 위한 프롬프트를 생성합니다.
    
    Args:
        problem_summary: 문제 요약
        selected_cause: 사용자가 선택한 근본 원인
        evidence: 해당 원인의 근거
        context_data: 분석 컨텍스트
    
    Returns:
        str: 프롬프트 문자열
    """
    return f"""당신은 제조 라인 KPI 분석 리포트 작성 전문가입니다.
아래 정보를 바탕으로 상세한 분석 리포트를 작성해주세요.

## 문제 요약
{problem_summary}

## 확정된 근본 원인
{selected_cause}

## 근거
{evidence}

## 원본 데이터
{context_data}

**리포트 작성 요구사항:**
1. 경영진도 이해할 수 있도록 명확하게 작성
2. 구체적인 수치와 데이터 포함
3. 권장 조치사항 제시
4. 예상 효과 설명

**출력 형식:**
마크다운 형식으로 다음 섹션을 포함하세요:
- # 분석 리포트
- ## 1. 문제 정의
- ## 2. 근본 원인 분석
- ## 3. 영향 분석
- ## 4. 권장 조치사항
- ## 5. 예상 효과
"""


def get_question_answer_prompt(question: str, similar_reports: list) -> str:
    
    # 참고 보고서 텍스트 구성 (출처 명확히)
    reports_text = ""
    for i, report in enumerate(similar_reports, 1):
        meta = report['metadata']
        reports_text += f"\n### 📄 참고 보고서 {i}"
        reports_text += f" | {meta.get('date','?')} | {meta.get('eqp_id','?')} | KPI: {meta.get('kpi','?')}\n"
        reports_text += f"{report['document'][:800]}\n"
        reports_text += "---\n"

    reports_section = reports_text if reports_text else "※ 유사한 과거 보고서가 없습니다."

    return f"""당신은 제조 라인 KPI 분석 전문가 AI입니다.
과거 분석 보고서를 참고하되, 자유롭게 전문가 관점에서 답변하세요.
보고서에 없는 내용도 KPI 지식을 바탕으로 답변할 수 있습니다.

## 사용자 질문
{question}

## 참고 가능한 과거 보고서 (ChromaDB 검색 결과)
{reports_section}

## 답변 지침
1. 질문에 직접적으로 답변하세요
2. 과거 보고서를 참고했다면 "📄 [날짜] [장비] 보고서 참고" 형식으로 출처를 명시하세요
3. 보고서에 없는 내용은 전문가 지식으로 자유롭게 보완하세요
4. 날씨, 주식 등 제조와 무관한 질문은 "저는 KPI 분석 전문가라 해당 질문은 답변이 어렵습니다" 라고만 짧게 답하세요. 절대 보고서 내용을 억지로 연결하지 마세요.
5. 답변은 명확하고 실용적으로 작성하세요

## 답변:
"""