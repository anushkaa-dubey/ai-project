from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from services import ml_service, recommendation_service

router = APIRouter()

class PredictRequest(BaseModel):
    machine_speed:     float = 700.0
    stock_flow:        float = 300.0
    headbox_pressure:  float = 0.45
    steam_pressure:    float = 4.5
    dryer_temperature: float = 120.0
    moisture:          float = 5.0
    pulp_consistency:  float = 0.70
    grade:             int   = 80
    basis_weight:      float = 80.0
    # Engineered features (optional — will use defaults)
    bw_lag1:           Optional[float] = None
    bw_lag2:           Optional[float] = None
    bw_lag3:           Optional[float] = None
    bw_lag4:           Optional[float] = None
    bw_lag5:           Optional[float] = None
    ms_lag1:           Optional[float] = None
    sp_lag1:           Optional[float] = None
    bw_roll_mean5:     Optional[float] = None
    bw_roll_std5:      Optional[float] = None
    ms_roll_mean5:     Optional[float] = None
    ms_roll_std5:      Optional[float] = None
    sp_roll_mean5:     Optional[float] = None
    ms_delta:          Optional[float] = 0.0
    sp_delta:          Optional[float] = 0.0
    sf_delta:          Optional[float] = 0.0
    prev_grade:        Optional[int]   = None
    next_grade:        Optional[int]   = None
    time_since_grade_change: Optional[float] = 120.0
    is_transition:     Optional[int]   = 0


@router.post("/predict")
def predict(req: PredictRequest):
    features = req.model_dump()
    # Fill optional lags with current BW
    bw = features["basis_weight"]
    ms = features["machine_speed"]
    sp = features["steam_pressure"]
    for key, default in [("bw_lag1", bw), ("bw_lag2", bw), ("bw_lag3", bw),
                         ("bw_lag4", bw), ("bw_lag5", bw),
                         ("ms_lag1", ms), ("sp_lag1", sp),
                         ("bw_roll_mean5", bw), ("bw_roll_std5", 1.5),
                         ("ms_roll_mean5", ms), ("ms_roll_std5", 5.0),
                         ("sp_roll_mean5", sp)]:
        if features.get(key) is None:
            features[key] = default
    if features.get("prev_grade") is None:
        features["prev_grade"] = features["grade"]
    if features.get("next_grade") is None:
        features["next_grade"] = features["grade"]

    prediction = ml_service.predict(features)

    # Attach recommendations
    recs = recommendation_service.generate_recommendations(features, prediction, prediction.get("shap_values"))

    return {**prediction, "recommendation": recs}
