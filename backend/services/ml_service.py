import numpy as np
import pandas as pd
import joblib
import shap
import os
from typing import Dict, List, Optional

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "model_artifacts")

_model       = None
_iso_forest  = None
_feature_cols= None
_metrics     = None
_explainer   = None

GRADE_TARGETS = {45: (42, 48), 60: (57, 63), 80: (76, 84), 120: (114, 126)}
ISO_FEATURES  = ["machine_speed","stock_flow","headbox_pressure","steam_pressure",
                  "dryer_temperature","moisture","pulp_consistency","basis_weight",
                  "ms_delta","sp_delta","sf_delta"]

def _load_artifacts():
    global _model, _iso_forest, _feature_cols, _metrics, _explainer
    if _model is None:
        _model        = joblib.load(os.path.join(ARTIFACTS_DIR, "xgb_model.joblib"))
        _iso_forest   = joblib.load(os.path.join(ARTIFACTS_DIR, "iso_forest.joblib"))
        _feature_cols = joblib.load(os.path.join(ARTIFACTS_DIR, "feature_cols.joblib"))
        _metrics      = joblib.load(os.path.join(ARTIFACTS_DIR, "metrics.joblib"))
        _explainer    = shap.TreeExplainer(_model)


def predict(features: Dict) -> Dict:
    """Run XGBoost prediction and SHAP explanation."""
    _load_artifacts()

    row = _build_feature_row(features)
    X   = pd.DataFrame([row], columns=_feature_cols)
    predicted_bw = float(_model.predict(X.to_numpy())[0])

    # SHAP — use numpy to avoid pandas 3.x issues
    shap_values = _explainer.shap_values(X.to_numpy())
    shap_row    = shap_values[0]
    shap_dict   = {col: float(shap_row[i]) for i, col in enumerate(_feature_cols)}

    # Sorted top contributors
    sorted_shap = sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True)
    top_shap    = [{"feature": k, "shap_value": round(v, 4)} for k, v in sorted_shap[:8]]

    # Percentage contribution
    total_abs  = sum(abs(v) for _, v in sorted_shap[:8]) + 1e-9
    for item in top_shap:
        item["contribution_pct"] = round(abs(item["shap_value"]) / total_abs * 100, 1)

    # Anomaly score
    grade     = int(features.get("grade", 80))
    iso_row   = _build_iso_row(features, predicted_bw)
    iso_X     = pd.DataFrame([iso_row], columns=ISO_FEATURES)
    anomaly_score = float(-_iso_forest.score_samples(iso_X.to_numpy())[0])  # higher = more anomalous
    anomaly_prob  = float(np.clip((anomaly_score - 0.3) / 0.5, 0, 1))   # normalise 0-1

    # Safe range
    lo, hi = GRADE_TARGETS.get(grade, (60, 90))
    deviation = predicted_bw - ((lo + hi) / 2)
    status    = "SAFE" if lo <= predicted_bw <= hi else \
                ("WARNING" if abs(deviation) <= (hi - lo) * 0.5 else "CRITICAL")

    # Confidence (degrades with anomaly)
    confidence = round(max(55, 97 - anomaly_prob * 30 - abs(deviation) * 0.4), 1)

    return {
        "predicted_bw":  round(predicted_bw, 3),
        "status":        status,
        "deviation":     round(deviation, 3),
        "confidence":    confidence,
        "safe_range":    {"low": lo, "high": hi},
        "shap_values":   top_shap,
        "anomaly_score": round(anomaly_score, 4),
        "anomaly_prob":  round(anomaly_prob, 3),
        "metrics":       _metrics,
    }


def simulate(features: Dict) -> Dict:
    """Lightweight predict for what-if simulator (no SHAP for speed)."""
    _load_artifacts()
    row  = _build_feature_row(features)
    X    = pd.DataFrame([row], columns=_feature_cols)
    predicted_bw = float(_model.predict(X.to_numpy())[0])
    grade = int(features.get("grade", 80))
    lo, hi = GRADE_TARGETS.get(grade, (60, 90))
    deviation = predicted_bw - ((lo + hi) / 2)
    status = "SAFE" if lo <= predicted_bw <= hi else \
             ("WARNING" if abs(deviation) <= (hi - lo) * 0.5 else "CRITICAL")
    return {"predicted_bw": round(predicted_bw, 3), "status": status,
            "deviation": round(deviation, 3), "safe_range": {"low": lo, "high": hi}}


def get_metrics() -> Dict:
    _load_artifacts()
    return _metrics


def _build_feature_row(f: Dict) -> List:
    """Build a feature vector from a dict of raw process values."""
    bw = float(f.get("basis_weight", 70))
    ms = float(f.get("machine_speed", 700))
    sp = float(f.get("steam_pressure", 4.5))
    sf = float(f.get("stock_flow", 300))

    # Defaults for engineered features if not provided
    row = {
        "machine_speed":        ms,
        "stock_flow":           sf,
        "headbox_pressure":     float(f.get("headbox_pressure", 0.45)),
        "steam_pressure":       sp,
        "dryer_temperature":    float(f.get("dryer_temperature", 120)),
        "moisture":             float(f.get("moisture", 5.0)),
        "pulp_consistency":     float(f.get("pulp_consistency", 0.70)),
        "grade":                float(f.get("grade", 80)),
        "bw_lag1":              float(f.get("bw_lag1", bw)),
        "bw_lag2":              float(f.get("bw_lag2", bw)),
        "bw_lag3":              float(f.get("bw_lag3", bw)),
        "bw_lag4":              float(f.get("bw_lag4", bw)),
        "bw_lag5":              float(f.get("bw_lag5", bw)),
        "ms_lag1":              float(f.get("ms_lag1", ms)),
        "sp_lag1":              float(f.get("sp_lag1", sp)),
        "bw_roll_mean5":        float(f.get("bw_roll_mean5", bw)),
        "bw_roll_std5":         float(f.get("bw_roll_std5", 1.5)),
        "ms_roll_mean5":        float(f.get("ms_roll_mean5", ms)),
        "ms_roll_std5":         float(f.get("ms_roll_std5", 5.0)),
        "sp_roll_mean5":        float(f.get("sp_roll_mean5", sp)),
        "ms_delta":             float(f.get("ms_delta", 0.0)),
        "sp_delta":             float(f.get("sp_delta", 0.0)),
        "sf_delta":             float(f.get("sf_delta", 0.0)),
        "prev_grade":           float(f.get("prev_grade", f.get("grade", 80))),
        "next_grade":           float(f.get("next_grade", f.get("grade", 80))),
        "time_since_grade_change": float(f.get("time_since_grade_change", 120)),
        "is_transition":        float(f.get("is_transition", 0)),
    }
    return [row[c] for c in _feature_cols]


def _build_iso_row(f: Dict, predicted_bw: float) -> List:
    bw = float(f.get("basis_weight", predicted_bw))
    ms = float(f.get("machine_speed", 700))
    sp = float(f.get("steam_pressure", 4.5))
    sf = float(f.get("stock_flow", 300))
    return [ms, sf,
            float(f.get("headbox_pressure", 0.45)),
            sp,
            float(f.get("dryer_temperature", 120)),
            float(f.get("moisture", 5.0)),
            float(f.get("pulp_consistency", 0.70)),
            bw,
            float(f.get("ms_delta", 0.0)),
            float(f.get("sp_delta", 0.0)),
            float(f.get("sf_delta", 0.0))]
