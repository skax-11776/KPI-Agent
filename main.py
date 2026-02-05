"""간단한 연결 테스트"""
from sqlalchemy import create_engine
import os
from dotenv import load_dotenv

load_dotenv()

print("🔍 간단 연결 테스트")
print("=" * 60)

# 환경 변수 직접 읽기
db_url = os.getenv("SUPABASE_DB_URL", "")

if not db_url:
    print("❌ SUPABASE_DB_URL이 설정되지 않았습니다!")
else:
    # 비밀번호 부분 가리기
    parts = db_url.split(":")
    if len(parts) >= 3:
        masked = f"{parts[0]}:{parts[1]}:***@..."
        print(f"📍 연결 문자열: {masked}")
    
    print()
    print("⏳ 연결 시도 중...")
    
    try:
        # 명시적으로 UTF-8 지정
        engine = create_engine(
            db_url,
            connect_args={
                "options": "-c client_encoding=utf8"
            }
        )
        
        with engine.connect() as conn:
            print("✅ 연결 성공!")
            
    except Exception as e:
        print(f"❌ 연결 실패: {e}")
        print()
        print("오류 타입:", type(e).__name__)

print("=" * 60)