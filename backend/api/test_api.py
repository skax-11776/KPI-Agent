"""
FastAPI API 테스트
"""

import requests
import json
from pprint import pprint

# API 베이스 URL
BASE_URL = "http://localhost:8000"


def test_health():
    """헬스체크 테스트"""
    
    print("\n" + "=" * 60)
    print("헬스체크 테스트")
    print("=" * 60 + "\n")
    
    response = requests.get(f"{BASE_URL}/health")
    
    print(f"Status Code: {response.status_code}")
    print(f"Response:")
    pprint(response.json())
    
    assert response.status_code == 200
    print("\n헬스체크 성공!\n")


def test_get_latest_alarm():
    """최신 알람 조회 테스트"""
    
    print("=" * 60)
    print("최신 알람 조회 테스트")
    print("=" * 60 + "\n")
    
    response = requests.get(f"{BASE_URL}/api/alarm/latest")
    
    print(f"Status Code: {response.status_code}")
    print(f"Response:")
    pprint(response.json())
    
    assert response.status_code == 200
    data = response.json()
    assert data['success'] is True
    
    print("\n최신 알람 조회 성공!\n")
    return data


def test_analyze_latest_alarm():
    """최신 알람 분석 테스트"""
    
    print("=" * 60)
    print("최신 알람 분석 테스트")
    print("=" * 60 + "\n")
    
    # 요청 데이터 (비어있으면 최신 알람 분석)
    request_data = {}
    
    print("Request:")
    pprint(request_data)
    print()
    
    response = requests.post(
        f"{BASE_URL}/api/alarm/analyze",
        json=request_data
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"\n분석 결과:")
        print(f"   날짜: {data['alarm_date']}")
        print(f"   장비: {data['alarm_eqp_id']}")
        print(f"   KPI: {data['alarm_kpi']}")
        print(f"\n   근본 원인 후보: {len(data['root_causes'])}개")
        for i, cause in enumerate(data['root_causes'], 1):
            print(f"   {i}. {cause['cause']} ({cause['probability']}%)")
        
        print(f"\n   선택된 원인: {data['selected_cause']['cause']}")
        print(f"   리포트 ID: {data['report_id']}")
        print(f"   RAG 저장: {'' if data['rag_saved'] else '[ERROR] '}")
        print(f"   LLM 호출: {data['llm_calls']}회")
        print(f"   처리 시간: {data['processing_time']:.2f}초")
        
        print("\n최신 알람 분석 성공!\n")
        return data
    else:
        print(f"\n[ERROR] 실패:")
        pprint(response.json())
        return None


def test_analyze_specific_alarm():
    """특정 알람 분석 테스트"""
    
    print("=" * 60)
    print("특정 알람 분석 테스트")
    print("=" * 60 + "\n")
    
    # 요청 데이터
    request_data = {
        "alarm_date": "2026-01-20",
        "alarm_eqp_id": "EQP01",
        "alarm_kpi": "OEE"
    }
    
    print("Request:")
    pprint(request_data)
    print()
    
    response = requests.post(
        f"{BASE_URL}/api/alarm/analyze",
        json=request_data
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"\n분석 결과:")
        print(f"   날짜: {data['alarm_date']}")
        print(f"   장비: {data['alarm_eqp_id']}")
        print(f"   KPI: {data['alarm_kpi']}")
        print(f"   선택된 원인: {data['selected_cause']['cause'][:50]}...")
        print(f"   처리 시간: {data['processing_time']:.2f}초")
        
        print("\n특정 알람 분석 성공!\n")
        return data
    else:
        print(f"\n[ERROR] 실패:")
        pprint(response.json())
        return None


def test_question_answer():
    """질문 답변 테스트"""
    
    print("=" * 60)
    print("질문 답변 테스트")
    print("=" * 60 + "\n")
    
    # 요청 데이터
    request_data = {
        "question": "2026년 1월 20일 EQP01에서 발생한 OEE 문제의 원인을 설명해주세요"
    }
    
    print("Request:")
    pprint(request_data)
    print()
    
    response = requests.post(
        f"{BASE_URL}/api/question/answer",
        json=request_data
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"\n답변 결과:")
        print(f"   질문: {data['question']}")
        print(f"   리포트 존재: {'있음' if data['report_exists'] else '없음'}")
        print(f"   참고 리포트: {len(data['similar_reports'])}개")
        print(f"\n   답변:")
        print(f"   {'-' * 60}")
        print(f"   {data['answer'][:300]}...")
        print(f"   {'-' * 60}")
        print(f"\n   LLM 호출: {data['llm_calls']}회")
        print(f"   처리 시간: {data['processing_time']:.2f}초")
        
        print("\n질문 답변 성공!\n")
        return data
    else:
        print(f"\n[ERROR] 실패:")
        pprint(response.json())
        return None


def test_multiple_questions():
    """여러 질문 테스트"""
    
    print("=" * 60)
    print("여러 질문 연속 테스트")
    print("=" * 60 + "\n")
    
    questions = [
        "최근 장비 다운타임이 발생한 적이 있나요?",
        "HOLD 상태가 자주 발생하는 이유는?",
        "레시피 복잡도가 높으면 어떤 문제가 생기나요?"
    ]
    
    for i, question in enumerate(questions, 1):
        print(f"질문 {i}: {question}")
        
        response = requests.post(
            f"{BASE_URL}/api/question/answer",
            json={"question": question}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"   답변 생성 완료 ({len(data['answer'])}자)")
            print(f"   참고 리포트: {len(data['similar_reports'])}개\n")
        else:
            print(f"   [ERROR] 실패\n")


def main():
    """모든 테스트 실행"""
    
    print("\n" + "=" * 60)
    print("FastAPI API 테스트 시작")
    print("=" * 60)
    print("\n[WARN]  서버가 실행 중인지 확인하세요!")
    print("   python backend/api/main.py\n")
    
    input("Enter를 눌러 테스트 시작...")
    
    try:
        # 1. 헬스체크
        test_health()
        
        # 2. 최신 알람 조회
        test_get_latest_alarm()
        
        # 3. 최신 알람 분석
        test_analyze_latest_alarm()
        
        # 4. 특정 알람 분석
        test_analyze_specific_alarm()
        
        # 5. 질문 답변
        test_question_answer()
        
        # 6. 여러 질문
        test_multiple_questions()
        
        print("=" * 60)
        print("모든 API 테스트 통과!")
        print("=" * 60 + "\n")
        
    except requests.exceptions.ConnectionError:
        print("\n[ERROR] 서버에 연결할 수 없습니다!")
        print("   서버가 실행 중인지 확인하세요.\n")
    except Exception as e:
        print(f"\n[ERROR] 테스트 실패: {e}\n")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()