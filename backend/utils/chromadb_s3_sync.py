"""
ChromaDB ↔ S3 동기화 유틸리티

파드 재시작 시 S3에서 ChromaDB 데이터를 복원하고,
add/delete 이후 S3에 백업합니다.
"""

import os
import boto3
from pathlib import Path

# ChromaDB 로컬 경로 (chroma_config.py와 동일한 기본값)
_LOCAL_DIR = Path(os.getenv("CHROMA_DB_PATH", "./data/chromadb"))

# S3 위치: team4-bucket/chromadb/
_S3_BUCKET = os.getenv("S3_BUCKET", "ag-prod-s3-bucket")
_S3_PREFIX = os.getenv("S3_PREFIX", "team4-bucket/") + "chromadb/"


def _s3():
    return boto3.client(
        "s3",
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )


def sync_from_s3() -> int:
    """
    S3 → 로컬: 파드 시작 시 기존 ChromaDB 데이터 복원.

    Returns:
        int: 다운로드된 파일 수 (0 이면 S3에 데이터 없음 = 첫 실행)
    """
    _LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    try:
        client = _s3()
        paginator = client.get_paginator("list_objects_v2")
        count = 0
        for page in paginator.paginate(Bucket=_S3_BUCKET, Prefix=_S3_PREFIX):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                rel = key[len(_S3_PREFIX):]
                if not rel:  # prefix 자체는 건너뜀
                    continue
                local_path = _LOCAL_DIR / rel
                local_path.parent.mkdir(parents=True, exist_ok=True)
                client.download_file(_S3_BUCKET, key, str(local_path))
                count += 1

        if count:
            print(f"[ChromaDB S3] ↓ S3에서 {count}개 파일 복원 완료")
        else:
            print("[ChromaDB S3] S3에 기존 데이터 없음 (첫 실행)")
        return count

    except Exception as e:
        print(f"[ChromaDB S3] 경고: S3 복원 실패 (무시하고 계속): {e}")
        return 0


def sync_to_s3() -> int:
    """
    로컬 → S3: add/delete 이후 ChromaDB 전체를 S3에 백업.

    Returns:
        int: 업로드된 파일 수
    """
    if not _LOCAL_DIR.exists():
        return 0
    try:
        client = _s3()
        count = 0
        for local_file in _LOCAL_DIR.rglob("*"):
            if local_file.is_file():
                rel = local_file.relative_to(_LOCAL_DIR)
                s3_key = _S3_PREFIX + str(rel).replace("\\", "/")
                client.upload_file(str(local_file), _S3_BUCKET, s3_key)
                count += 1

        print(f"[ChromaDB S3] ↑ S3에 {count}개 파일 백업 완료")
        return count

    except Exception as e:
        print(f"[ChromaDB S3] 경고: S3 백업 실패: {e}")
        return 0
