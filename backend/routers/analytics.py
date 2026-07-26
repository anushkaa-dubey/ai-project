from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.db import get_db, FeedbackRecord
import os, pandas as pd

router = APIRouter()
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    records = db.query(FeedbackRecord).all()
    total     = len(records)
    accepted  = sum(1 for r in records if r.action == "accept")
    rejected  = sum(1 for r in records if r.action == "reject")
    acc_rate  = round(accepted / total * 100, 1) if total else 0

    # Average confidence
    confs    = [r.confidence for r in records if r.confidence]
    avg_conf = round(sum(confs) / len(confs), 1) if confs else 0

    # Grade breakdown
    grade_counts = {}
    for r in records:
        grade_counts[r.grade] = grade_counts.get(r.grade, 0) + 1

    # Trend from live data
    stab_time_saved  = 0.0
    waste_prevented  = 0.0
    try:
        df = pd.read_csv(os.path.join(DATA_DIR, "live_data.csv"))
        last = df.tail(1).iloc[0]
        bw_dev = abs(float(last["basis_weight"]) - float(last["predicted_bw"]))
        stab_time_saved = round(bw_dev * 1.2 + 5, 1)
        waste_prevented = round(stab_time_saved * 2.4, 1)
    except Exception:
        pass

    # Most influential variables (from model feature importance)
    top_features = []
    try:
        import joblib
        model     = joblib.load(os.path.join(DATA_DIR, "..", "models", "model_artifacts", "xgb_model.joblib"))
        feat_cols = joblib.load(os.path.join(DATA_DIR, "..", "models", "model_artifacts", "feature_cols.joblib"))
        fi        = dict(zip(feat_cols, model.feature_importances_))
        sorted_fi = sorted(fi.items(), key=lambda x: x[1], reverse=True)[:8]
        top_features = [{"feature": k, "importance": round(float(v)*100, 2)} for k, v in sorted_fi]
        metrics   = joblib.load(os.path.join(DATA_DIR, "..", "models", "model_artifacts", "metrics.joblib"))
    except Exception:
        metrics = {}

    return {
        "feedback_summary": {
            "total":        total,
            "accepted":     accepted,
            "rejected":     rejected,
            "acceptance_rate": acc_rate,
            "avg_confidence":  avg_conf,
        },
        "grade_breakdown":     grade_counts,
        "model_metrics":       metrics,
        "top_features":        top_features,
        "estimated_stab_time_saved": stab_time_saved,
        "estimated_waste_prevented": waste_prevented,
        "operator_activity": [
            {"operator": r.operator_id, "action": r.action, "timestamp": str(r.timestamp),
             "grade": r.grade, "predicted_bw": r.predicted_bw}
            for r in records[-20:]
        ],
    }
