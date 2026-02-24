"""
시스템 관리 API 엔드포인트
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.utils.cache import analysis_cache, qa_cache
from backend.config.supabase_config import supabase_config

router = APIRouter(prefix="/system", tags=["System"])


class TargetSettings(BaseModel):
    oee_min: float
    thp_min: float
    tat_max: float
    wip_min: float
    wip_max: float


@router.put("/settings/targets")
async def update_targets(settings: TargetSettings):
    """
    KPI 목표값(임계값)을 kpi_daily 테이블 전체에 업데이트합니다.

    Args:
        settings: 새로운 목표값 (oee_min, thp_min, tat_max, wip_min, wip_max)
    """
    try:
        wip_t = round((settings.wip_min + settings.wip_max) / 2)
        result = supabase_config.client.table('kpi_daily').update({
            'oee_t': int(settings.oee_min),   # bigint 컬럼
            'thp_t': int(settings.thp_min),   # bigint 컬럼
            'tat_t': float(settings.tat_max), # numeric 컬럼 (소수점 허용)
            'wip_t': wip_t,                   # round() → int
        }).gte('date', '2000-01-01').execute()

        updated_count = len(result.data) if result.data else 0
        print(f"[system] kpi_daily 업데이트 결과: {updated_count}행 변경")

        if updated_count == 0:
            raise HTTPException(
                status_code=500,
                detail="업데이트된 행이 없습니다. Supabase RLS 정책(UPDATE 권한) 또는 테이블 데이터를 확인하세요."
            )

        return {
            "success": True,
            "message": f"kpi_daily 목표값이 업데이트되었습니다. ({updated_count}행 변경)",
            "updated_count": updated_count,
            "updated": {
                "oee_t": settings.oee_min,
                "thp_t": settings.thp_min,
                "tat_t": settings.tat_max,
                "wip_t": wip_t,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase 업데이트 실패: {str(e)}")


@router.get("/cache/stats")
async def get_cache_stats():
    """
    캐시 통계 조회
    
    알람 분석 캐시와 질문 답변 캐시의 상태를 확인합니다.
    """
    
    return {
        "analysis_cache": analysis_cache.get_stats(),
        "qa_cache": qa_cache.get_stats(),
    }


@router.post("/cache/clear")
async def clear_cache(cache_type: str = "all"):
    """
    캐시 초기화
    
    Args:
        cache_type: 'analysis', 'qa', 또는 'all'
    """
    
    if cache_type in ["analysis", "all"]:
        analysis_cache.clear()
    
    if cache_type in ["qa", "all"]:
        qa_cache.clear()
    
    return {
        "success": True,
        "message": f"{cache_type} 캐시가 초기화되었습니다.",
    }