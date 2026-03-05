"""
AWS Bedrock 연결 테스트
"""

from aws_config import aws_config

def main():
    """AWS Bedrock 연결 테스트 실행"""
    
    print("\n" + "=" * 60)
    print("AWS Bedrock 연결 테스트")
    print("=" * 60 + "\n")
    
    # 1. Claude 3 Haiku 테스트
    print("Claude 3 Haiku 테스트 중...\n")
    
    try:
        response = aws_config.invoke_claude(
            prompt="안녕하세요! 간단하게 인사해주세요.",
            max_tokens=100,
            system_prompt="당신은 친절한 AI 어시스턴트입니다."
        )
        
        print(f"Claude 응답:\n{response}\n")
        print("Claude 연결 성공!\n")
        
    except Exception as e:
        print(f"[ERROR] Claude 연결 실패: {str(e)}\n")
        return
    
    # 2. Titan Embeddings 테스트
    print("=" * 60)
    print("Titan Embeddings 테스트 중...\n")
    
    try:
        test_text = "제조 라인 KPI 분석 테스트"
        embedding = aws_config.get_embeddings(test_text)
        
        print(f"임베딩 생성 성공!")
        print(f"벡터 차원: {len(embedding)}")
        print(f"처음 5개 값: {embedding[:5]}\n")
        print("Titan Embeddings 연결 성공!\n")
        
    except Exception as e:
        print(f"[ERROR] Embeddings 연결 실패: {str(e)}\n")
        return
    
    # 최종 결과
    print("=" * 60)
    print("모든 테스트 통과! AWS Bedrock 설정 완료!")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    main()