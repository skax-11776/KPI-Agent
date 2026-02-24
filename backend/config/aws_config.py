"""
AWS Bedrock 설정 및 클라이언트 초기화
"""

import os
import boto3
import json
from dotenv import load_dotenv
from typing import List

# .env 파일에서 환경 변수 로드
load_dotenv()

class AWSConfig:
    """
    AWS Bedrock 설정 클래스
    """
    
    def __init__(self):
        """환경 변수에서 AWS 설정을 로드합니다."""
        # AWS 인증 정보
        self.access_key_id = os.getenv('AWS_ACCESS_KEY_ID')
        self.secret_access_key = os.getenv('AWS_SECRET_ACCESS_KEY')
        self.region = os.getenv('AWS_REGION', 'us-east-1')
        
        # Bedrock 모델 ID
        self.model_id = os.getenv(
            'BEDROCK_MODEL_ID',
            'anthropic.claude-3-haiku-20240307-v1:0'
        )
        self.embedding_model_id = os.getenv(
            'BEDROCK_EMBEDDING_MODEL_ID',
            'amazon.titan-embed-text-v1'
        )
        
        # 설정 유효성 검사
        self._validate_config()
    
    def _validate_config(self):
        """필수 설정 값이 있는지 확인합니다."""
        if not self.access_key_id:
            raise ValueError("❌ AWS_ACCESS_KEY_ID가 .env 파일에 설정되지 않았습니다.")
        if not self.secret_access_key:
            raise ValueError("❌ AWS_SECRET_ACCESS_KEY가 .env 파일에 설정되지 않았습니다.")
    
    def get_bedrock_runtime_client(self):
        """
        Bedrock Runtime 클라이언트를 반환합니다.
        
        Returns:
            boto3.client: Bedrock Runtime 클라이언트
        """
        return boto3.client(
            service_name='bedrock-runtime',
            region_name=self.region,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key
        )
    
    def invoke_claude(
        self, 
        prompt: str, 
        max_tokens: int = 2000,
        temperature: float = 0.7,
        system_prompt: str = None
    ) -> str:
        """
        Claude 모델을 호출하여 응답을 받습니다.
        
        Args:
            prompt: 사용자 프롬프트
            max_tokens: 최대 생성 토큰 수 (기본: 2000)
            temperature: 생성 다양성 0.0~1.0 (기본: 0.7)
            system_prompt: 시스템 프롬프트 (선택)
        
        Returns:
            str: Claude의 응답 텍스트
        """
        client = self.get_bedrock_runtime_client()
        
        # 메시지 구성
        messages = [{"role": "user", "content": prompt}]
        
        # 요청 본문
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2048,
            "temperature": 0.7,
            "messages": messages
        }
        
        # 시스템 프롬프트가 있으면 추가
        if system_prompt:
            body["system"] = system_prompt
        
        # 모델 호출
        response = client.invoke_model(
            modelId=self.model_id,
            body=json.dumps(body)
        )
        
        # 응답 파싱
        response_body = json.loads(response['body'].read())
        return response_body['content'][0]['text']
    
    def get_embeddings(self, text: str) -> List[float]:
        """
        텍스트를 임베딩 벡터로 변환합니다.
        
        Args:
            text: 임베딩할 텍스트
        
        Returns:
            List[float]: 임베딩 벡터 (1536차원)
        """
        client = self.get_bedrock_runtime_client()
        
        # 요청 본문
        body = json.dumps({
            "inputText": text
        })
        
        # 모델 호출
        response = client.invoke_model(
            modelId=self.embedding_model_id,
            body=body
        )
        
        # 응답 파싱
        response_body = json.loads(response['body'].read())
        return response_body['embedding']

# 싱글톤 패턴: 프로그램 전체에서 하나의 설정 객체만 사용
aws_config = AWSConfig()