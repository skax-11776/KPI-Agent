"""
시스템 관리 API 엔드포인트
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.utils.cache import analysis_cache, qa_cache
from backend.config.rds_config import rds_config

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
    KPI 목표값(임계값)을 kpi_daily 테이블 전체에 업데이트합니다. (Amazon RDS)

    Args:
        settings: 새로운 목표값 (oee_min, thp_min, tat_max, wip_min, wip_max)
    """
    try:
        wip_t = round((settings.wip_min + settings.wip_max) / 2)
        updated_count = rds_config.update_kpi_targets(
            oee_t=float(settings.oee_min),
            thp_t=float(settings.thp_min),
            tat_t=float(settings.tat_max),
            wip_t=float(wip_t),
        )
        print(f"[system] kpi_daily RDS 업데이트 결과: {updated_count}행 변경")

        if updated_count == 0:
            raise HTTPException(
                status_code=500,
                detail="업데이트된 행이 없습니다. kpi_daily 테이블 데이터를 확인하세요."
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
        raise HTTPException(status_code=500, detail=f"RDS 업데이트 실패: {str(e)}")


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