"""
Supabase 연결 및 데이터 조회 테스트
"""

from supabase_config import supabase_config

def main():
    """Supabase 연결 테스트"""
    
    print("\n" + "=" * 60)
    print("Supabase 연결 테스트")
    print("=" * 60 + "\n")
    
    # 1. 연결 테스트
    print("Supabase 연결 중...\n")
    
    if not supabase_config.test_connection():
        print("[ERROR] Supabase 연결 실패!")
        print("확인사항:")
        print("1. .env 파일에 SUPABASE_URL과 SUPABASE_KEY가 올바른지")
        print("2. Supabase 프로젝트가 활성화되어 있는지")
        print("3. 테이블 이름이 소문자(scenario_map)인지 대문자(SCENARIO_MAP)인지")
        return
    
    print("Supabase 연결 성공!\n")
    
    # 2. SCENARIO_MAP 조회 테스트
    print("=" * 60)
    print("SCENARIO_MAP 테이블 조회")
    print("=" * 60 + "\n")
    
    try:
        scenarios = supabase_config.get_scenario_map()
        print(f"조회 성공! 총 {len(scenarios)}개의 알람 시나리오")
        
        if scenarios:
            print(f"\n첫 번째 알람:")
            first = scenarios[0]
            print(f"   날짜: {first.get('date')}")
            print(f"   장비: {first.get('alarm_eqp_id')}")
            print(f"   KPI: {first.get('alarm_kpi')}")
        print()
        
    except Exception as e:
        print(f"[ERROR] 조회 실패: {str(e)}\n")
    
    # 3. KPI_DAILY 조회 테스트
    print("=" * 60)
    print("KPI_DAILY 테이블 조회 (최근 1개)")
    print("=" * 60 + "\n")
    
    try:
        kpis = supabase_config.client.table('kpi_daily').select('*').limit(1).execute()
        
        if kpis.data:
            print(f"조회 성공!")
            kpi = kpis.data[0]
            print(f"\n샘플 데이터:")
            print(f"   날짜: {kpi.get('date')}")
            print(f"   장비: {kpi.get('eqp_id')}")
            print(f"   OEE: {kpi.get('oee_v')}% (목표: {kpi.get('oee_t')}%)")
            print(f"   알람: {'발생' if kpi.get('alarm_flag') == 1 else '정상'}")
        print()
        
    except Exception as e:
        print(f"[ERROR] 조회 실패: {str(e)}\n")
    
    # 4. 테이블 목록 확인
    print("=" * 60)
    print("업로드된 테이블 목록")
    print("=" * 60 + "\n")
    
    tables = ['scenario_map', 'kpi_daily', 'lot_state', 'eqp_state', 'rcp_state']
    
    for table in tables:
        try:
            result = supabase_config.client.table(table).select('*').limit(1).execute()
            count = len(result.data)
            print(f"{table}: 데이터 존재")
        except Exception as e:
            print(f"[ERROR] {table}: 오류 - {str(e)}")
    
    print("\n" + "=" * 60)
    print("Supabase 테스트 완료!")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    main()