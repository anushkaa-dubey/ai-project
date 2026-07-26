import pandas as pd
import numpy as np
import os
import random
import joblib
from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

DATA_DIR      = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "model_artifacts")
_live_cache   = None

GRADE_TARGETS = {45: (42, 48), 60: (57, 63), 80: (76, 84), 120: (114, 126)}
FEAT_LABELS   = {
    "machine_speed": "Mach Speed", "stock_flow": "Stock Flow",
    "headbox_pressure": "HB Pressure", "steam_pressure": "Steam Press",
    "dryer_temperature": "Dryer Temp", "moisture": "Moisture",
    "pulp_consistency": "Pulp Cons.", "bw_lag1": "BW Lag-1",
    "bw_roll_mean5": "BW Roll Mean", "ms_delta": "MS Delta",
    "sp_delta": "SP Delta",
}


def _load_live(force: bool = False):
    global _live_cache
    if _live_cache is None or force:
        p = os.path.join(DATA_DIR, "live_data.csv")
        if os.path.exists(p):
            df = pd.read_csv(p)
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            _live_cache = df
    return _live_cache


@router.get("/dashboard")
def get_dashboard():
    df = _load_live()
    if df is None:
        return {"error": "Model not trained yet. Run train_model.py first."}

    # Last reading
    last    = df.iloc[-1]
    grade   = int(last["grade"])
    cur_bw  = round(float(last["basis_weight"]), 2)
    pred_bw = round(float(last["predicted_bw"]), 2)
    lo, hi  = GRADE_TARGETS.get(grade, (grade * 0.93, grade * 1.07))
    deviation = round(pred_bw - (lo + hi) / 2, 3)
    status    = "SAFE" if lo <= pred_bw <= hi else ("WARNING" if abs(deviation) <= (hi - lo) * 0.5 else "CRITICAL")

    ms       = round(float(last["machine_speed"]), 1)
    conf     = round(max(60, 95 - abs(deviation) * 0.6), 1)
    dev_risk = round(min(100, abs(deviation) / ((hi - lo) / 2) * 100), 1)

    stab_saved      = round(max(0, abs(deviation) * 1.2), 1)
    waste_prevented = round(stab_saved * 2.4, 1)

    # BW Trend — last 60 points for the main chart
    tail60 = df.tail(60).copy()
    tail60["ts_str"] = tail60["timestamp"].dt.strftime("%H:%M")

    bw_trend = [
        {
            "timestamp":    str(row["ts_str"]),
            "basis_weight": round(float(row["basis_weight"]), 2),
            "grade":        int(row["grade"]),
            "is_transition": bool(row.get("is_transition", False)),
        }
        for _, row in tail60.iterrows()
    ]

    # Actual vs Predicted — last 60 points
    actual_vs_predicted = [
        {
            "timestamp":     row["ts_str"],
            "actual":        round(float(row["basis_weight"]), 2),
            "predicted":     round(float(row["predicted_bw"]), 2),
        }
        for _, row in tail60.iterrows()
    ]

    # Anomaly timeline
    anomaly_data = _build_anomaly_timeline(tail60)

    # Grade timeline
    grade_timeline = _build_grade_timeline(df)

    # Feature importance
    top8    = []
    metrics = {}
    try:
        model     = joblib.load(os.path.join(ARTIFACTS_DIR, "xgb_model.joblib"))
        feat_cols = joblib.load(os.path.join(ARTIFACTS_DIR, "feature_cols.joblib"))
        metrics   = joblib.load(os.path.join(ARTIFACTS_DIR, "metrics.joblib"))
        fi        = {k: float(v) for k, v in zip(feat_cols, model.feature_importances_)}
        top_feats = sorted(fi.items(), key=lambda x: x[1], reverse=True)
        total_fi  = sum(v for _, v in top_feats) + 1e-9
        top8 = [
            {
                "feature":    str(k),
                "label":      str(FEAT_LABELS.get(k, k)),
                "importance": round(float(v) / float(total_fi) * 100, 2),
            }
            for k, v in top_feats[:8]
        ]
        # Cast metrics to native Python types
        metrics = {k: float(v) if isinstance(v, (int, float)) else v for k, v in metrics.items()}
    except Exception:
        pass

    return {
        "kpis": {
            "current_basis_weight":      cur_bw,
            "predicted_basis_weight":    pred_bw,
            "prediction_confidence":     conf,
            "current_grade":             grade,
            "machine_speed":             ms,
            "machine_status":            "RUNNING",
            "deviation_risk":            dev_risk,
            "status":                    status,
            "deviation":                 deviation,
            "safe_range":                {"low": lo, "high": hi},
            "estimated_stab_time_saved": stab_saved,
            "estimated_waste_prevented": waste_prevented,
        },
        "metrics":              metrics,
        "bw_trend":             bw_trend,
        "actual_vs_predicted":  actual_vs_predicted,
        "anomaly_timeline":     anomaly_data,
        "grade_timeline":       grade_timeline,
        "feature_importance":   top8,
    }


def _build_anomaly_timeline(df: pd.DataFrame):
    rows = []
    for _, r in df.iterrows():
        is_trans = bool(r.get("is_transition", False))
        bw_std   = float(r.get("bw_roll_std5", 1.0)) if "bw_roll_std5" in r.index else 1.0
        score    = round(min(1.0, (bw_std / 6.0) + (0.35 if is_trans else 0) + random.uniform(0, 0.04)), 3)
        ts = r["timestamp"].strftime("%H:%M") if hasattr(r["timestamp"], "strftime") else str(r["timestamp"])
        rows.append({
            "timestamp":     ts,
            "anomaly_score": score,
            "is_anomaly":    bool(score > 0.5),
        })
    return rows


def _build_grade_timeline(df: pd.DataFrame):
    segments  = []
    cur_grade = None
    start_t   = None
    for _, r in df.iterrows():
        g = int(r["grade"])
        t = r["timestamp"]
        if g != cur_grade:
            if cur_grade is not None:
                segments.append({"grade": cur_grade, "start": str(start_t)[:16], "end": str(t)[:16]})
            cur_grade = g
            start_t   = t
    if cur_grade is not None:
        segments.append({"grade": cur_grade, "start": str(start_t)[:16], "end": str(df.iloc[-1]["timestamp"])[:16]})
    return segments[-12:]
