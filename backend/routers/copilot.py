from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict
from services import copilot_service

router = APIRouter()

class DecisionSupportRequest(BaseModel):
    question:       str
    features:       Optional[Dict] = None
    prediction:     Optional[Dict] = None
    recommendation: Optional[Dict] = None


@router.post("/decision-support")
@router.post("/copilot")
def decision_support(req: DecisionSupportRequest):
    answer = copilot_service.answer(
        question=req.question,
        features=req.features or {},
        prediction=req.prediction,
        recommendation=req.recommendation,
    )
    return {"answer": answer, "question": req.question}
