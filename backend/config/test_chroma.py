"""
ChromaDB 연결 및 기능 테스트
"""

import sys
from pathlib import Path

# 프로젝트 루트를 경로에 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.config.chroma_config import chroma_config


def main():
    """ChromaDB 기능 테스트"""
    
    print("\n" + "=" * 60)
    print("ChromaDB 테스트 시작")
    print("=" * 60 + "\n")
    
    # 1. 현재 저장된 리포트 개수 확인
    print("현재 상태:")
    count = chroma_config.count_reports()
    print(f"   저장된 리포트 개수: {count}개\n")
    
    # 2. 테스트 리포트 추가
    print("=" * 60)
    print("테스트 리포트 저장")
    print("=" * 60 + "\n")
    
    test_report = """
    [분석 리포트]
    날짜: 2026-01-20
    장비: EQP01
    KPI: OEE
    문제: OEE가 목표치 70%보다 낮은 53.51%를 기록했습니다.
    
    원인 분석:
    1. 장비 다운타임 증가 (3시간)
    2. RCP01 레시피 실행 중 HOLD 상태 발생
    3. 복잡도 높은 레시피(complex_level: 9) 사용
    
    권장 조치:
    - 장비 점검 및 유지보수 실시
    - 레시피 파라미터 최적화 검토
    - 예방 정비 스케줄 조정
    """
    
    metadata = {
        "date": "2026-01-20",
        "eqp_id": "EQP01",
        "kpi": "OEE",
        "alarm_flag": 1
    }
    
    success = chroma_config.add_report(
        report_id="test_report_001",
        report_text=test_report,
        metadata=metadata
    )
    
    if success:
        print(f"테스트 리포트 저장 성공\n")
    else:
        print(f"[ERROR] 테스트 리포트 저장 실패\n")
        return
    
    # 3. 저장된 리포트 조회
    print("=" * 60)
    print("리포트 ID로 조회")
    print("=" * 60 + "\n")
    
    report = chroma_config.get_report_by_id("test_report_001")
    
    if report:
        print(f"리포트 조회 성공:")
        print(f"   ID: {report['id']}")
        print(f"   메타데이터: {report['metadata']}")
        print(f"   내용 미리보기: {report['document'][:100]}...\n")
    
    # 4. 유사 리포트 검색
    print("=" * 60)
    print("유사 리포트 검색 테스트")
    print("=" * 60 + "\n")
    
    query = "EQP01 장비에서 효율이 낮아졌어요. 다운타임이 발생했습니다."
    print(f"검색어: {query}\n")
    
    similar_reports = chroma_config.search_similar_reports(
        query_text=query,
        n_results=3
    )
    
    if similar_reports:
        print(f"{len(similar_reports)}개의 유사 리포트 발견:\n")
        for i, report in enumerate(similar_reports, 1):
            print(f"{i}. ID: {report['id']}")
            print(f"   유사도 거리: {report['distance']:.4f}")
            print(f"   메타데이터: {report['metadata']}")
            print(f"   내용: {report['document'][:80]}...")
            print()
    else:
        print("[WARN] 유사 리포트를 찾지 못했습니다.\n")
    
    # 5. 최종 상태 확인
    print("=" * 60)
    print("최종 상태")
    print("=" * 60 + "\n")
    
    final_count = chroma_config.count_reports()
    print(f"저장된 리포트 개수: {final_count}개\n")
    
    # 6. 테스트 데이터 정리 (선택)
    print("=" * 60)
    print("테스트 데이터 정리")
    print("=" * 60 + "\n")
    
    user_input = input("테스트 리포트를 삭제하시겠습니까? (y/n): ")
    
    if user_input.lower() == 'y':
        chroma_config.delete_report("test_report_001")
        print(f"남은 리포트: {chroma_config.count_reports()}개\n")
    
    print("=" * 60)
    print("ChromaDB 테스트 완료!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()