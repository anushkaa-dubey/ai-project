from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database.db import get_db, FeedbackRecord
from datetime import datetime

router = APIRouter()

class FeedbackRequest(BaseModel):
    grade:           int
    predicted_bw:    float
    actual_bw:       Optional[float] = None
    recommendation:  str
    action:          str   # "accept" | "reject"
    comment:         Optional[str] = None
    operator_id:     Optional[str] = "OP-001"
    confidence:      Optional[float] = None
    status:          Optional[str] = None


@router.post("/feedback")
def submit_feedback(req: FeedbackRequest, db: Session = Depends(get_db)):
    record = FeedbackRecord(
        timestamp=datetime.utcnow(),
        grade=req.grade,
        predicted_bw=req.predicted_bw,
        actual_bw=req.actual_bw,
        recommendation=req.recommendation,
        action=req.action,
        comment=req.comment,
        operator_id=req.operator_id or "OP-001",
        confidence=req.confidence,
        status=req.status,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"success": True, "id": record.id, "message": f"Feedback recorded (ID: {record.id})"}


@router.get("/feedback")
def get_feedback(limit: int = 50, db: Session = Depends(get_db)):
    records = db.query(FeedbackRecord).order_by(FeedbackRecord.timestamp.desc()).limit(limit).all()
    return {
        "count": len(records),
        "records": [
            {
                "id":            r.id,
                "timestamp":     str(r.timestamp),
                "grade":         r.grade,
                "predicted_bw":  r.predicted_bw,
                "actual_bw":     r.actual_bw,
                "recommendation": r.recommendation,
                "action":        r.action,
                "comment":       r.comment,
                "operator_id":   r.operator_id,
                "confidence":    r.confidence,
                "status":        r.status,
            }
            for r in records
        ],
    }
