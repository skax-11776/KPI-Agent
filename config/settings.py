"""
프로젝트 설정 파일
- Supabase DB 연결
- Ollama LLM 설정
"""

# pydantic_settings : 환경 변수를 클래스로 관리해주는 라이브러리
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    환경 변수 설정 클래스

    .env 파일의 내용을 자동으로 읽어서 저장함
    """
    # ========================================
    # Supabase Database
    # ========================================
    SUPABASE_URL : str = "https://sxikijraqmqiuzgtxpyh.supabase.co"
    SUPABASE_KEY :str = ""

    SUPABASE_PROJECT_ID : str = "sxikijraqmqiuzgtxpyh"
    SUPABASE_DB_PASSWORD : str = ""

    # ========================================
    # Ollama LLM
    # ========================================
    OLLAMA_BASE_URL : str = "https://localhost:11434"
    OLLAMA_MODEL : str = "llama3.2:3b"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def database_url(self) -> str:
        """DB 연결 URL 반환"""
        return f"postgresql+psycopg://postgres.{self.SUPABASE_PROJECT_ID}:{self.SUPABASE_DB_PASSWORD}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"

# 전역 설정 객체 생성
settings = Settings()