"""
Supabase 데이터베이스 설정 및 연결
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import List, Dict, Any

# 환경 변수 로드
load_dotenv()

class SupabaseConfig:
    """
    Supabase 설정 클래스
    """
    
    def __init__(self):
        """환경 변수에서 Supabase 설정을 로드합니다."""
        # Supabase 연결 정보
        self.url = os.getenv('SUPABASE_URL')
        self.key = os.getenv('SUPABASE_KEY')
        
        # 설정 유효성 검사
        self._validate_config()
        
        # Supabase 클라이언트 생성
        self.client: Client = create_client(self.url, self.key)
    
    def _validate_config(self):
        """필수 설정 값이 있는지 확인합니다."""
        if not self.url:
            raise ValueError("❌ SUPABASE_URL이 .env 파일에 설정되지 않았습니다.")
        if not self.key:
            raise ValueError("❌ SUPABASE_KEY가 .env 파일에 설정되지 않았습니다.")
    
    def test_connection(self) -> bool:
        """
        Supabase 연결을 테스트합니다.
        
        Returns:
            bool: 연결 성공 여부
        """
        try:
            # scenario_map 테이블에서 1개 행만 조회 (테스트)
            # 테이블 이름이 대문자라면 'SCENARIO_MAP'으로 변경하세요
            response = self.client.table('scenario_map').select('*').limit(1).execute()
            return True
        except Exception as e:
            print(f"❌ 연결 실패: {str(e)}")
            return False
    
    def get_scenario_map(self, date: str = None) -> List[Dict[str, Any]]:
        """
        SCENARIO_MAP 테이블에서 알람 데이터 조회
        
        Args:
            date: 특정 날짜 (YYYY-MM-DD), None이면 전체 조회
        
        Returns:
            List[Dict]: 알람 데이터 리스트
        """
        query = self.client.table('scenario_map').select('*')
        
        if date:
            query = query.eq('date', date)
        
        response = query.execute()
        return response.data
    
    def get_kpi_daily(
        self, 
        date: str = None, 
        eqp_id: str = None
    ) -> List[Dict[str, Any]]:
        """
        KPI_DAILY 테이블에서 일별 KPI 데이터 조회
        
        Args:
            date: 특정 날짜 (YYYY-MM-DD)
            eqp_id: 장비 ID (예: EQP01)
        
        Returns:
            List[Dict]: KPI 데이터 리스트
        """
        query = self.client.table('kpi_daily').select('*')
        
        if date:
            query = query.eq('date', date)
        if eqp_id:
            query = query.eq('eqp_id', eqp_id)
        
        response = query.execute()
        return response.data
    
    def get_lot_state(
        self,
        start_time: str = None,
        end_time: str = None,
        eqp_id: str = None
    ) -> List[Dict[str, Any]]:
        """
        LOT_STATE 테이블에서 로트 상태 이력 조회
        
        Args:
            start_time: 시작 시간 (YYYY-MM-DD HH:MM)
            end_time: 종료 시간 (YYYY-MM-DD HH:MM)
            eqp_id: 장비 ID
        
        Returns:
            List[Dict]: 로트 상태 데이터
        """
        query = self.client.table('lot_state').select('*')
        
        if start_time:
            query = query.gte('event_time', start_time)
        if end_time:
            query = query.lte('event_time', end_time)
        if eqp_id:
            query = query.eq('eqp_id', eqp_id)
        
        response = query.execute()
        return response.data
    
    def get_eqp_state(
        self,
        start_time: str = None,
        end_time: str = None,
        eqp_id: str = None
    ) -> List[Dict[str, Any]]:
        """
        EQP_STATE 테이블에서 장비 상태 이력 조회
        
        Args:
            start_time: 시작 시간
            end_time: 종료 시간
            eqp_id: 장비 ID
        
        Returns:
            List[Dict]: 장비 상태 데이터
        """
        query = self.client.table('eqp_state').select('*')
        
        if start_time:
            query = query.gte('event_time', start_time)
        if end_time:
            query = query.lte('event_time', end_time)
        if eqp_id:
            query = query.eq('eqp_id', eqp_id)
        
        response = query.execute()
        return response.data
    
    def get_rcp_state(self, eqp_id: str = None) -> List[Dict[str, Any]]:
        """
        RCP_STATE 테이블에서 레시피 정보 조회
        
        Args:
            eqp_id: 장비 ID
        
        Returns:
            List[Dict]: 레시피 데이터
        """
        query = self.client.table('rcp_state').select('*')
        
        if eqp_id:
            query = query.eq('eqp_id', eqp_id)
        
        response = query.execute()
        return response.data

# 싱글톤 패턴으로 전역 설정 객체 생성
supabase_config = SupabaseConfig()