# config/ollama.py
import httpx
from typing import List, Dict, Any, Optional

from config.settings import settings


class OllamaClient:
    """
    Ollama HTTP 클라이언트 래퍼
    - /api/tags: 모델 목록 조회
    - /api/chat: 대화형 LLM 호출
    """

    def __init__(self) -> None:
        # settings.py 에 있는 환경변수 사용
        self.base_url: str = settings.OLLAMA_BASE_URL.rstrip("/")
        self.model: str = settings.OLLAMA_MODEL

        self.client = httpx.Client(
            base_url=self.base_url,
            timeout=30.0,
        )

    def list_models(self) -> List[Dict[str, Any]]:
        """
        현재 Ollama 인스턴스에 로드된 모델 목록 조회
        """
        resp = self.client.get("/api/tags")
        resp.raise_for_status()
        data = resp.json()
        return data.get("models", [])

    def chat(self, prompt: str, history: Optional[list] = None) -> str:
        """
        간단 챗봇 스타일 대화
        - 항상 한국어
        - 한두 문장 이내로 짧게
        - history 로 이전 대화 이어가기 가능
        """
        messages: list[dict] = []

        # 시스템 프롬프트
        messages.append({
            "role": "system",
            "content": (
                "너는 생산 KPI 에이전트 개발을 돕는 한국어 전용 어시스턴트야. "
                "대답은 항상 자연스러운 한국어로 하고, 한두 문장 이내로 짧게 답해."
            )
        })

        # 지금까지의 대화 히스토리
        if history:
            messages.extend(history)

        # 이번 사용자 발화
        messages.append({
            "role": "user",
            "content": prompt,
        })

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.3,
            },
        }

        resp = self.client.post("/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()
        message = data.get("message", {})
        
        return message.get("content", "")

    def close(self) -> None:
        """
        httpx 클라이언트 종료
        """
        self.client.close()
