"""
AWS Bedrock 설정 및 클라이언트 초기화
"""

import os
import boto3
import json
from pathlib import Path
from dotenv import load_dotenv
from typing import List, Dict, Any

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

        # S3 설정 (.env에서 로드)
        self.s3_bucket = os.getenv('S3_BUCKET', 'ag-prod-s3-bucket')
        self.s3_prefix = os.getenv('S3_PREFIX', 'team4-bucket/')

        # 설정 유효성 검사
        self._validate_config()
    
    def _validate_config(self):
        """필수 설정 값이 있는지 확인합니다."""
        if not self.access_key_id:
            raise ValueError("[ERROR] AWS_ACCESS_KEY_ID가 .env 파일에 설정되지 않았습니다.")
        if not self.secret_access_key:
            raise ValueError("[ERROR] AWS_SECRET_ACCESS_KEY가 .env 파일에 설정되지 않았습니다.")
    
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

    # ──────────────────────────────────────────────────────────────
    # S3 관련 메서드
    # ──────────────────────────────────────────────────────────────

    def get_s3_client(self):
        """S3 클라이언트를 반환합니다."""
        return boto3.client(
            service_name='s3',
            region_name=self.region,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key
        )

    def _s3_key(self, filename: str) -> str:
        """파일명 → S3 키 (prefix + filename)"""
        return f"{self.s3_prefix}{filename}"

    def upload_file_to_s3(self, local_path: str, filename: str) -> str:
        """
        로컬 파일을 S3에 업로드합니다.

        Args:
            local_path: 로컬 파일 경로
            filename: S3에 저장할 파일명 (prefix 제외)

        Returns:
            str: S3 URI (s3://bucket/key)
        """
        s3_key = self._s3_key(filename)
        client = self.get_s3_client()
        client.upload_file(str(local_path), self.s3_bucket, s3_key)
        uri = f"s3://{self.s3_bucket}/{s3_key}"
        print(f"[S3] 업로드 완료: {uri}")
        return uri

    def delete_file_from_s3(self, filename: str) -> bool:
        """
        S3에서 파일을 삭제합니다.

        Args:
            filename: 삭제할 파일명 (prefix 제외)

        Returns:
            bool: 성공 여부
        """
        s3_key = self._s3_key(filename)
        client = self.get_s3_client()
        client.delete_object(Bucket=self.s3_bucket, Key=s3_key)
        print(f"[S3] 삭제 완료: s3://{self.s3_bucket}/{s3_key}")
        return True

    def list_files_in_s3(self) -> List[Dict[str, Any]]:
        """
        S3 prefix 아래의 파일 목록을 반환합니다.

        Returns:
            List[Dict]: [{filename, s3_key, size, last_modified}, ...]
        """
        client = self.get_s3_client()
        response = client.list_objects_v2(
            Bucket=self.s3_bucket,
            Prefix=self.s3_prefix
        )
        files = []
        for obj in response.get('Contents', []):
            key = obj['Key']
            filename = key[len(self.s3_prefix):]  # prefix 제거
            if filename:  # prefix 자체는 제외
                files.append({
                    'filename': filename,
                    's3_key': key,
                    's3_uri': f"s3://{self.s3_bucket}/{key}",
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat()
                })
        print(f"[S3] 파일 목록 조회: {len(files)}개")
        return files

    def file_exists_in_s3(self, filename: str) -> bool:
        """S3에 파일이 존재하는지 확인합니다."""
        try:
            client = self.get_s3_client()
            client.head_object(Bucket=self.s3_bucket, Key=self._s3_key(filename))
            return True
        except Exception:
            return False


# 싱글톤 패턴: 프로그램 전체에서 하나의 설정 객체만 사용
aws_config = AWSConfig()