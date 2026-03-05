"""
대화 기록 관리 API — S3 저장/조회/삭제
- GET    /api/chatlogs        → S3에서 전체 대화 기록 목록 반환
- POST   /api/chatlogs        → 대화 기록 S3에 저장
- DELETE /api/chatlogs/{id}   → S3에서 대화 기록 삭제
"""

import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/chatlogs", tags=["ChatLogs"])

_S3_FOLDER = "chatlogs/"   # team4-bucket/ prefix 아래 chatlogs/


def _s3_client():
    from backend.config.aws_config import aws_config
    return aws_config.get_s3_client(), aws_config.s3_bucket, aws_config.s3_prefix


# ─── 모델 ────────────────────────────────────────────────────────
class ChatMessageModel(BaseModel):
    role: str
    content: str
    timestamp: str
    source: Optional[str] = None
    noSelect: Optional[bool] = None


class SaveChatLogRequest(BaseModel):
    id: str
    title: str
    date: str
    msgCount: int
    messages: List[ChatMessageModel]


# ─── GET /api/chatlogs ───────────────────────────────────────────
@router.get("")
async def list_chatlogs():
    """S3에서 전체 대화 기록 목록 반환"""
    try:
        s3, bucket, prefix = _s3_client()
        folder_key = prefix + _S3_FOLDER

        resp = s3.list_objects_v2(Bucket=bucket, Prefix=folder_key)
        items = []
        for obj in resp.get("Contents", []):
            key = obj["Key"]
            if not key.endswith(".json"):
                continue
            try:
                body = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
                data = json.loads(body)
                items.append(data)
            except Exception:
                continue

        # 최신순 정렬
        items.sort(key=lambda x: x.get("id", "0"), reverse=True)
        return {"success": True, "count": len(items), "data": items}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"S3 조회 실패: {str(e)}")


# ─── POST /api/chatlogs ──────────────────────────────────────────
@router.post("")
async def save_chatlog(req: SaveChatLogRequest):
    """대화 기록을 S3에 JSON으로 저장"""
    try:
        s3, bucket, prefix = _s3_client()
        key = prefix + _S3_FOLDER + f"{req.id}.json"

        payload = req.dict()
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(payload, ensure_ascii=False),
            ContentType="application/json"
        )
        print(f"[ChatLog] S3 저장 완료: {key}")
        return {"success": True, "id": req.id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"S3 저장 실패: {str(e)}")


# ─── DELETE /api/chatlogs/{id} ───────────────────────────────────
@router.delete("/{log_id}")
async def delete_chatlog(log_id: str):
    """S3에서 대화 기록 삭제"""
    try:
        s3, bucket, prefix = _s3_client()
        key = prefix + _S3_FOLDER + f"{log_id}.json"

        s3.delete_object(Bucket=bucket, Key=key)
        print(f"[ChatLog] S3 삭제 완료: {key}")
        return {"success": True, "id": log_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"S3 삭제 실패: {str(e)}")
