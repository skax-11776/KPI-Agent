"""
Config 모듈
- settings: 환경 변수 설정
- sb: Supabase 클라이언트
- OllamaClient: LLM 클라이언트
"""

from .settings import settings, sb
from .ollama_client import OllamaClient

# 전역 Ollama 클라이언트 인스턴스
ollama = OllamaClient()

__all__ = [
    'settings',
    'sb',
    'OllamaClient',
    'ollama',
]