"""
테스트 실행 스크립트
"""

import sys
from pathlib import Path

# 프로젝트 루트를 경로에 추가
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

if __name__ == "__main__":
    print("=" * 60)
    print("테스트 선택:")
    print("=" * 60)
    print("1. AWS Bedrock 테스트")
    print("2. Supabase 테스트")
    print("3. ChromaDB 테스트")
    print("=" * 60)
    
    choice = input("\n선택 (1/2/3): ")
    
    if choice == "1":
        from backend.config.test_connection import main
        main()
    elif choice == "2":
        from backend.config.test_supabase import main
        main()
    elif choice == "3":
        from backend.config.test_chroma import main
        main()
    else:
        print("잘못된 선택입니다.")