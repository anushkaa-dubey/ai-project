from fastapi import APIRouter
from pydantic import BaseModel
from services import ml_service

router = APIRouter()

class SimulateRequest(BaseModel):
    machine_speed:     float = 700.0
    stock_flow:        float = 300.0
    headbox_pressure:  float = 0.45
    steam_pressure:    float = 4.5
    dryer_temperature: float = 120.0
    moisture:          float = 5.0
    pulp_consistency:  float = 0.70
    grade:             int   = 80
    basis_weight:      float = 80.0


@router.post("/simulate")
def simulate(req: SimulateRequest):
    features = req.model_dump()
    bw = features["basis_weight"]
    ms = features["machine_speed"]
    sp = features["steam_pressure"]
    features.update({
        "bw_lag1": bw, "bw_lag2": bw, "bw_lag3": bw, "bw_lag4": bw, "bw_lag5": bw,
        "ms_lag1": ms, "sp_lag1": sp,
        "bw_roll_mean5": bw, "bw_roll_std5": 1.5,
        "ms_roll_mean5": ms, "ms_roll_std5": 5.0,
        "sp_roll_mean5": sp,
        "ms_delta": 0.0, "sp_delta": 0.0, "sf_delta": 0.0,
        "prev_grade": features["grade"], "next_grade": features["grade"],
        "time_since_grade_change": 120.0, "is_transition": 0,
    })
    return ml_service.simulate(features)
