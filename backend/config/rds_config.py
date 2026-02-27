"""
Amazon RDS (PostgreSQL) 설정 및 연결
- Supabase가 메인 DB이며, RDS는 보조/대안 DB로 사용됩니다.
"""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional

# 환경 변수 로드
load_dotenv()


class RDSConfig:
    """
    Amazon RDS (PostgreSQL) 설정 클래스
    """

    def __init__(self):
        """환경 변수에서 RDS 설정을 로드합니다."""
        self.host = os.getenv('RDS_HOST')
        self.port = int(os.getenv('RDS_PORT', '5432'))
        self.database = os.getenv('RDS_DB')
        self.user = os.getenv('RDS_USER')
        self.password = os.getenv('RDS_PASSWORD')
        self.schema = os.getenv('RDS_SCHEMA', 'kpi_monitor')

        # 설정 유효성 검사
        self._validate_config()

    def _validate_config(self):
        """필수 설정 값이 있는지 확인합니다."""
        if not self.host:
            raise ValueError("[ERROR] RDS_HOST가 .env 파일에 설정되지 않았습니다.")
        if not self.database:
            raise ValueError("[ERROR] RDS_DB가 .env 파일에 설정되지 않았습니다.")
        if not self.user:
            raise ValueError("[ERROR] RDS_USER가 .env 파일에 설정되지 않았습니다.")
        if not self.password:
            raise ValueError("[ERROR] RDS_PASSWORD가 .env 파일에 설정되지 않았습니다.")

    def get_connection(self):
        """
        psycopg2 데이터베이스 연결을 반환합니다.

        Returns:
            psycopg2.connection: 데이터베이스 연결 객체
        """
        return psycopg2.connect(
            host=self.host,
            port=self.port,
            database=self.database,
            user=self.user,
            password=self.password,
            connect_timeout=10,
        )

    def test_connection(self) -> bool:
        """
        RDS 연결을 테스트합니다.

        Returns:
            bool: 연결 성공 여부
        """
        try:
            conn = self.get_connection()
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.close()
            conn.close()
            return True
        except Exception as e:
            print(f"[ERROR] RDS 연결 실패: {str(e)}")
            return False

    def _execute_query(
        self, query: str, params: tuple = None
    ) -> List[Dict[str, Any]]:
        """
        SELECT 쿼리를 실행하고 결과를 dict 리스트로 반환합니다.

        Args:
            query: SQL 쿼리 문자열
            params: 바인딩 파라미터 (옵션)

        Returns:
            List[Dict]: 조회 결과
        """
        conn = self.get_connection()
        try:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(query, params)
            rows = [dict(row) for row in cur.fetchall()]
            cur.close()
            return rows
        finally:
            conn.close()

    # ──────────────────────────────────────────────────────────────
    # 테이블 조회 메서드 (Supabase와 동일한 인터페이스)
    # ──────────────────────────────────────────────────────────────

    def get_scenario_map(self, date: str = None) -> List[Dict[str, Any]]:
        """
        scenario_map 테이블에서 알람 데이터 조회

        Args:
            date: 특정 날짜 (YYYY-MM-DD), None이면 전체 조회

        Returns:
            List[Dict]: 알람 데이터 리스트
        """
        s = self.schema
        if date:
            return self._execute_query(
                f"SELECT * FROM {s}.scenario_map WHERE date = %s ORDER BY date",
                (date,),
            )
        return self._execute_query(f"SELECT * FROM {s}.scenario_map ORDER BY date")

    def get_kpi_daily(
        self,
        date: str = None,
        eqp_id: str = None,
    ) -> List[Dict[str, Any]]:
        """
        kpi_daily 테이블에서 일별 KPI 데이터 조회

        Args:
            date: 특정 날짜 (YYYY-MM-DD)
            eqp_id: 장비 ID (예: EQP01)

        Returns:
            List[Dict]: KPI 데이터 리스트
        """
        s = self.schema
        conditions, params = [], []
        if date:
            conditions.append("date = %s")
            params.append(date)
        if eqp_id:
            conditions.append("eqp_id = %s")
            params.append(eqp_id)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        return self._execute_query(
            f"SELECT * FROM {s}.kpi_daily {where} ORDER BY date",
            tuple(params) or None,
        )

    def get_kpi_trend(
        self,
        start_date: str,
        end_date: str,
        eqp_id: str = None,
    ) -> List[Dict[str, Any]]:
        """
        kpi_daily 테이블에서 날짜 범위의 KPI 추세 데이터 조회

        Args:
            start_date: 시작 날짜 (YYYY-MM-DD, 포함)
            end_date: 종료 날짜 (YYYY-MM-DD, 포함)
            eqp_id: 장비 ID

        Returns:
            List[Dict]: KPI 데이터 리스트 (날짜 오름차순)
        """
        s = self.schema
        conditions = ["date >= %s", "date <= %s"]
        params: list = [start_date, end_date]
        if eqp_id:
            conditions.append("eqp_id = %s")
            params.append(eqp_id)

        where = f"WHERE {' AND '.join(conditions)}"
        return self._execute_query(
            f"SELECT * FROM {s}.kpi_daily {where} ORDER BY date ASC",
            tuple(params),
        )

    def get_lot_state(
        self,
        start_time: str = None,
        end_time: str = None,
        eqp_id: str = None,
    ) -> List[Dict[str, Any]]:
        """
        lot_state 테이블에서 로트 상태 이력 조회

        Args:
            start_time: 시작 시간 (YYYY-MM-DD HH:MM)
            end_time: 종료 시간 (YYYY-MM-DD HH:MM)
            eqp_id: 장비 ID

        Returns:
            List[Dict]: 로트 상태 데이터
        """
        s = self.schema
        conditions, params = [], []
        if start_time:
            conditions.append("event_time >= %s")
            params.append(start_time)
        if end_time:
            conditions.append("event_time <= %s")
            params.append(end_time)
        if eqp_id:
            conditions.append("eqp_id = %s")
            params.append(eqp_id)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        return self._execute_query(
            f"SELECT * FROM {s}.lot_state {where} ORDER BY event_time",
            tuple(params) or None,
        )

    def get_eqp_state(
        self,
        start_time: str = None,
        end_time: str = None,
        eqp_id: str = None,
    ) -> List[Dict[str, Any]]:
        """
        eqp_state 테이블에서 장비 상태 이력 조회

        Args:
            start_time: 시작 시간
            end_time: 종료 시간
            eqp_id: 장비 ID

        Returns:
            List[Dict]: 장비 상태 데이터
        """
        s = self.schema
        conditions, params = [], []
        if start_time:
            conditions.append("event_time >= %s")
            params.append(start_time)
        if end_time:
            conditions.append("event_time <= %s")
            params.append(end_time)
        if eqp_id:
            conditions.append("eqp_id = %s")
            params.append(eqp_id)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        return self._execute_query(
            f"SELECT * FROM {s}.eqp_state {where} ORDER BY event_time",
            tuple(params) or None,
        )

    def get_rcp_state(self, eqp_id: str = None) -> List[Dict[str, Any]]:
        """
        rcp_state 테이블에서 레시피 정보 조회

        Args:
            eqp_id: 장비 ID

        Returns:
            List[Dict]: 레시피 데이터
        """
        s = self.schema
        if eqp_id:
            return self._execute_query(
                f"SELECT * FROM {s}.rcp_state WHERE eqp_id = %s",
                (eqp_id,),
            )
        return self._execute_query(f"SELECT * FROM {s}.rcp_state")


# 싱글톤 패턴: 프로그램 전체에서 하나의 설정 객체만 사용
rds_config = RDSConfig()
