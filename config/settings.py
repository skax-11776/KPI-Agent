"""
프로젝트 설정 파일
- Supabase DB 연결
- Ollama LLM 설정
"""
from pathlib import Path

import httpx
from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import create_client, Client, ClientOptions

ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT_DIR / ".env"


class Settings(BaseSettings):
    """
    환경 변수 설정 클래스

    .env 파일의 내용을 자동으로 읽어서 저장함
    """
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )
    
    # Supabase Database
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # 사내망용 TLS 검증 옵션
    SUPABASE_TLS_VERIFY: bool = True

    # Ollama LLM
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"


    def supabase(self) -> Client:
        """
        Supabase 클라이언트 생성
        - 사내망 환경에서 TLS 이슈가 있으면 SUPABASE_TLS_VERIFY=false 로 설정
        """
        if self.SUPABASE_TLS_VERIFY:
            # TLS 검증 ON
            options = ClientOptions(
                httpx_client=httpx.Client(timeout=10.0)
            )
        else:
            # TLS 검증 OFF
            options = ClientOptions(
                httpx_client=httpx.Client(verify=False, timeout=10.0)
            )

        return create_client(self.SUPABASE_URL, self.SUPABASE_KEY, options)


# 전역 설정 객체 생성
settings = Settings()
sb = settings.supabase()