# main.py
from config.settings import sb
from config.ollama_client import OllamaClient


def check_supabase():
    print("=== Supabase KPI_DAILY 확인 ===")
    resp = sb.table("KPI_DAILY").select("*").limit(5).execute()
    print("row count:", len(resp.data))
    for row in resp.data:
        print(row)


def check_ollama_chatbot():
    print("\n=== Ollama 챗봇 스타일 테스트 ===")
    ollama = OllamaClient()

    history: list[dict] = []

    # 1번째 질문
    user_msg = "안녕, 너는 어떤 역할이야?"
    reply1 = ollama.chat(user_msg, history=history)
    history.append({"role": "user", "content": user_msg})
    history.append({"role": "assistant", "content": reply1})
    print("Q1:", user_msg)
    print("A1:", reply1)

    # 2번째 질문
    user_msg = "내가 만들고 있는 생산 KPI 에이전트는 어떤 구조가 좋을까? 한 줄로만 말해줘."
    reply2 = ollama.chat(user_msg, history=history)
    history.append({"role": "user", "content": user_msg})
    history.append({"role": "assistant", "content": reply2})
    print("\nQ2:", user_msg)
    print("A2:", reply2)

    ollama.close()


if __name__ == "__main__":
    check_supabase()
    check_ollama_chatbot()