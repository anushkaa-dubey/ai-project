"""
Hybrid Recommendation Engine
Combines: Engineering Safety Rules + SHAP Feature Importance + Optimization Logic
"""
import numpy as np
from typing import Dict, List, Optional

# Engineering constraints (safe operating envelope)
SAFE_LIMITS = {
    "machine_speed":     {"min": 350,  "max": 1100, "label": "Machine Speed", "unit": "m/min"},
    "stock_flow":        {"min": 150,  "max": 550,  "label": "Stock Flow",    "unit": "L/min"},
    "headbox_pressure":  {"min": 0.25, "max": 0.90, "label": "Headbox Pressure","unit": "bar"},
    "steam_pressure":    {"min": 2.8,  "max": 7.5,  "label": "Steam Pressure","unit": "bar"},
    "dryer_temperature": {"min": 95,   "max": 165,  "label": "Dryer Temp",    "unit": "°C"},
    "moisture":          {"min": 2.0,  "max": 9.5,  "label": "Moisture",      "unit": "%"},
    "pulp_consistency":  {"min": 0.35, "max": 1.05, "label": "Pulp Consistency","unit": "fraction"},
}

# Physics-based feature effects on BW (positive = BW rises when feature rises)
FEATURE_EFFECT = {
    "machine_speed":     -0.04,   # faster speed → thinner sheet → lower BW
    "stock_flow":         0.18,   # more stock → heavier sheet
    "headbox_pressure":  12.0,    # higher pressure → heavier sheet
    "steam_pressure":     2.2,    # more steam → drier → slightly heavier
    "dryer_temperature":  0.3,
    "moisture":          -1.5,    # higher moisture → lower BW (wet basis)
    "pulp_consistency":  15.0,
}

GRADE_TARGETS = {45: (42, 48), 60: (57, 63), 80: (76, 84), 120: (114, 126)}
GRADE_MIDPOINTS = {g: (lo + hi) / 2 for g, (lo, hi) in GRADE_TARGETS.items()}


def generate_recommendations(
    features: Dict,
    prediction_result: Dict,
    shap_values: Optional[List[Dict]] = None,
) -> Dict:
    """
    Hybrid recommendation engine.
    1. Identify deviation direction and magnitude.
    2. Rank correctable features by SHAP magnitude × engineering effect alignment.
    3. Compute safe adjustment sizes via linearised sensitivity.
    4. Return top-3 actions with expected post-action BW and confidence.
    """
    grade        = int(features.get("grade", 80))
    predicted_bw = prediction_result["predicted_bw"]
    lo, hi       = GRADE_TARGETS.get(grade, (70, 90))
    midpoint     = (lo + hi) / 2
    deviation    = predicted_bw - midpoint
    half_band    = (hi - lo) / 2

    status = prediction_result.get("status", "SAFE")
    if status == "SAFE" and abs(deviation) < half_band * 0.4:
        return {
            "status":          "SAFE",
            "deviation":       round(deviation, 3),
            "grade":           grade,
            "predicted_bw":    predicted_bw,
            "recommendations": [],
            "message":         "Basis Weight is within safe operating range. No corrective action required.",
            "confidence":      95.0,
            "estimated_stabilization_time_saved_min":  0,
            "estimated_material_waste_prevented_kg":   0,
        }

    # --- Build ranked action list ---
    # Score each feature by: |shap_value| (if available) + alignment with correction direction
    shap_map = {}
    if shap_values:
        for item in shap_values:
            fn = item["feature"]
            if fn in FEATURE_EFFECT:
                shap_map[fn] = item["shap_value"]

    actions = []
    for feat, effect in FEATURE_EFFECT.items():
        cur_val  = float(features.get(feat, _default(feat)))
        limits   = SAFE_LIMITS[feat]

        # We want BW to move toward midpoint → deviation > 0 means BW too high → need neg effect
        correction_direction = -1 if deviation > 0 else 1
        aligned = (effect * correction_direction) > 0  # feature movement helps correction

        if not aligned:
            continue

        # SHAP magnitude weight
        shap_weight = abs(shap_map.get(feat, 0))
        # Engineering sensitivity: how much BW change per unit feature change
        sensitivity = abs(effect)

        # Score = sensitivity × (1 + shap_weight)
        score = sensitivity * (1 + shap_weight)

        # Required BW correction
        required_delta_bw = -deviation   # bring back to midpoint
        # Feature delta needed (linearised)
        raw_delta = required_delta_bw / effect
        # Limit to 5% of current value or 10% of range
        feat_range   = limits["max"] - limits["min"]
        max_delta    = min(abs(raw_delta), feat_range * 0.08)
        actual_delta = np.sign(raw_delta) * max_delta

        new_val = np.clip(cur_val + actual_delta, limits["min"], limits["max"])
        achieved_bw_change = (new_val - cur_val) * effect
        expected_bw = predicted_bw + achieved_bw_change

        actions.append({
            "feature":            feat,
            "label":              limits["label"],
            "unit":               limits["unit"],
            "current_value":      round(cur_val, 3),
            "recommended_value":  round(float(new_val), 3),
            "delta":              round(float(new_val - cur_val), 3),
            "delta_pct":          round(float((new_val - cur_val) / (cur_val + 1e-9) * 100), 2),
            "expected_bw_after":  round(float(expected_bw), 3),
            "score":              score,
            "shap_weight":        round(shap_weight, 4),
            "reason":             _build_reason(feat, deviation, shap_weight, effect),
        })

    # Sort by score descending, take top 3
    actions.sort(key=lambda x: x["score"], reverse=True)
    top3 = actions[:3]

    # Confidence: based on SHAP availability, deviation magnitude, in-range check
    conf_base = 88 if shap_values else 72
    conf = max(50, conf_base - abs(deviation) * 0.6)

    # Estimated stabilisation time (heuristic: larger deviation → more time saved)
    stab_time_saved = round(min(35, max(5, abs(deviation) * 1.2 + 5)), 1)

    for a in top3:
        a.pop("score", None)
        a.pop("shap_weight", None)

    return {
        "status":          status,
        "deviation":       round(deviation, 3),
        "grade":           grade,
        "predicted_bw":    predicted_bw,
        "midpoint":        midpoint,
        "recommendations": top3,
        "confidence":      round(conf, 1),
        "estimated_stabilization_time_saved_min": stab_time_saved,
        "estimated_material_waste_prevented_kg":  round(stab_time_saved * 2.4, 1),
    }


def _build_reason(feature: str, deviation: float, shap_weight: float, effect: float) -> str:
    direction = "high" if deviation > 0 else "low"
    action_word = "Reduce" if (effect > 0) == (deviation > 0) else "Increase"
    shap_str = f" (SHAP contribution: {round(shap_weight * 100, 1)}%)" if shap_weight > 0.01 else ""
    reasons = {
        "machine_speed":     f"Machine speed strongly influences sheet formation rate. {action_word}ing speed adjusts fibre laydown, correcting {direction} Basis Weight{shap_str}.",
        "stock_flow":        f"Stock flow directly controls fibre mass per unit area. {action_word}ing flow corrects {direction} Basis Weight{shap_str}.",
        "headbox_pressure":  f"Headbox pressure affects jet-to-wire ratio and sheet density. Adjustment corrects {direction} Basis Weight deviation{shap_str}.",
        "steam_pressure":    f"Steam pressure controls drying rate and fibre bonding. Adjustment stabilises moisture-basis weight balance{shap_str}.",
        "dryer_temperature": f"Dryer temperature affects final sheet moisture and weight. Correction reduces {direction} deviation{shap_str}.",
        "moisture":          f"Moisture has a negative correlation with Basis Weight. Controlling moisture corrects {direction} BW drift{shap_str}.",
        "pulp_consistency":  f"Pulp consistency directly scales fibre content. Adjustment corrects {direction} Basis Weight{shap_str}.",
    }
    return reasons.get(feature, f"{action_word} {feature} to correct {direction} Basis Weight deviation.")


def _default(feat: str) -> float:
    defaults = {
        "machine_speed": 700, "stock_flow": 300, "headbox_pressure": 0.45,
        "steam_pressure": 4.5, "dryer_temperature": 120, "moisture": 5.0,
        "pulp_consistency": 0.70,
    }
    return defaults.get(feat, 0.0)
