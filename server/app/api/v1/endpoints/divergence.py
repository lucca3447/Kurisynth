from fastapi import APIRouter
from app.services.divergence_service import get_worldline_divergence

router = APIRouter()

@router.get("/divergence", tags=["Worldline Divergence"])
async def get_divergence():
    """
    Returns current Worldline Divergence value from Divergence Meter (Nixie Tubes).
    """
    return await get_worldline_divergence()
