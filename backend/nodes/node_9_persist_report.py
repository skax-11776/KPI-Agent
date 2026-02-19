"""
Node 9: Persist Report
생성된 분석 리포트를 ChromaDB에 저장합니다.

입력:
- final_report: 최종 분석 리포트
- report_id: 리포트 고유 ID
- alarm_date: 알람 날짜
- alarm_eqp_id: 장비 ID
- alarm_kpi: KPI

출력:
- rag_saved: 저장 성공 여부
"""

import sys
from pathlib import Path

# 프로젝트 루트 경로 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.config.chroma_config import chroma_config


def node_9_persist_report(state: dict) -> dict:
    """
    생성된 리포트를 ChromaDB에 저장합니다.
    
    Args:
        state: 현재 Agent State
            - final_report: 최종 리포트 텍스트
            - report_id: 리포트 ID
            - alarm_date: 알람 날짜
            - alarm_eqp_id: 장비 ID
            - alarm_kpi: KPI
    
    Returns:
        dict: 업데이트할 State
            - rag_saved: 저장 성공 여부 (True/False)
            - error: 에러 메시지 (실패 시)
    """
    
    print("\n" + "=" * 60)
    print("💾 [Node 9] Persist Report 실행")
    print("=" * 60)
    
    # 1. State에서 필요한 정보 가져오기
    final_report = state.get('final_report')
    report_id = state.get('report_id')
    alarm_date = state.get('alarm_date')
    alarm_eqp_id = state.get('alarm_eqp_id')
    alarm_kpi = state.get('alarm_kpi')
    
    # 필수 정보 검증
    if not final_report:
        error_msg = "저장할 리포트가 없습니다"
        print(f"❌ {error_msg}")
        return {'error': error_msg, 'rag_saved': False}
    
    if not report_id:
        error_msg = "리포트 ID가 없습니다"
        print(f"❌ {error_msg}")
        return {'error': error_msg, 'rag_saved': False}
    
    print(f"📄 리포트 정보:")
    print(f"   ID: {report_id}")
    print(f"   날짜: {alarm_date}")
    print(f"   장비: {alarm_eqp_id}")
    print(f"   KPI: {alarm_kpi}")
    print(f"   크기: {len(final_report)}자")
    
    # 2. 메타데이터 생성
    metadata = {
        "date": alarm_date,
        "eqp_id": alarm_eqp_id,
        "kpi": alarm_kpi,
        "alarm_flag": 1,
        "source": "ai_analysis"
    }
    
    print(f"\n💾 ChromaDB에 저장 중...")
    
    # 3. ChromaDB에 저장
    try:
        success = chroma_config.add_report(
            report_id=report_id,
            report_text=final_report,
            metadata=metadata
        )
        
        if success:
            print(f"   ✅ ChromaDB 저장 성공!")
            
            # 4. 저장 확인
            total_reports = chroma_config.count_reports()
            print(f"   📊 현재 총 리포트 개수: {total_reports}개")
            
            # 5. 저장된 리포트 조회 확인
            saved_report = chroma_config.get_report_by_id(report_id)
            if saved_report:
                print(f"   ✅ 저장 검증 완료")
            else:
                print(f"   ⚠️ 저장 검증 실패 (조회 안 됨)")
            
            print("=" * 60 + "\n")
            
            return {'rag_saved': True}
        
        else:
            error_msg = "ChromaDB 저장 실패"
            print(f"   ❌ {error_msg}")
            print("=" * 60 + "\n")
            return {'error': error_msg, 'rag_saved': False}
    
    except Exception as e:
        error_msg = f"저장 중 오류 발생: {str(e)}"
        print(f"   ❌ {error_msg}")
        print("=" * 60 + "\n")
        return {'error': error_msg, 'rag_saved': False}