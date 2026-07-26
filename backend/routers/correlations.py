from fastapi import APIRouter
from services.correlation_service import get_correlations

router = APIRouter()

@router.get("/correlations")
def correlations(grade: int = None):
    return get_correlations(grade)
