# Stage: runtime
FROM python:3.11-slim

# psycopg2(RDS), chromadb 등이 필요로 하는 시스템 패키지
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 의존성 먼저 복사
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사 (backend/data/ 포함)
COPY backend/ ./backend/

# 환경 변수 기본값 (실제 값은 ECS Task Definition 또는 .env에서 주입)
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE 8000

CMD ["sh", "-c", "python -c 'from backend.utils.load_reports_to_rag import load_reports_to_rag; load_reports_to_rag()' ; uvicorn backend.api.main:app --host 0.0.0.0 --port 8000"]
