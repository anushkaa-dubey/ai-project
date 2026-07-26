"""
Rule-based Decision Support Assistant
Answers operator questions using: prediction output, SHAP, anomaly scores,
recommendation results, and current process values.
"""
from typing import Dict, List, Optional
import re

FRIENDLY_NAMES = {
    "machine_speed":     "Machine Speed",
    "stock_flow":        "Stock Flow",
    "headbox_pressure":  "Headbox Pressure",
    "steam_pressure":    "Steam Pressure",
    "dryer_temperature": "Dryer Temperature",
    "moisture":          "Moisture",
    "pulp_consistency":  "Pulp Consistency",
    "bw_lag1":           "Recent BW (lag)",
    "bw_roll_mean5":     "BW Rolling Mean",
    "bw_roll_std5":      "BW Variability",
    "ms_delta":          "Machine Speed Rate-of-Change",
    "sp_delta":          "Steam Pressure Rate-of-Change",
    "sf_delta":          "Stock Flow Rate-of-Change",
    "is_transition":     "Grade Transition Flag",
    "time_since_grade_change": "Time Since Grade Change",
}

FEATURE_EFFECT_LABEL = {
    "machine_speed":     ("negative", "faster speed thins the sheet"),
    "stock_flow":        ("positive", "more stock increases grammage"),
    "headbox_pressure":  ("positive", "higher pressure increases sheet density"),
    "steam_pressure":    ("positive", "more steam increases drying and BW"),
    "dryer_temperature": ("positive", "higher temp increases drying rate"),
    "moisture":          ("negative", "higher moisture lowers measured BW"),
    "pulp_consistency":  ("positive", "more concentrated pulp raises BW"),
}


def answer(
    question: str,
    features: Dict,
    prediction: Optional[Dict] = None,
    recommendation: Optional[Dict] = None,
) -> str:
    q = question.lower().strip()

    # ─── Route to handler ───────────────────────────────────────────────────
    if _matches(q, ["why", "reason", "cause", "explain", "what is causing", "increasing", "decreasing", "drift"]):
        return _explain_deviation(features, prediction, recommendation)

    if _matches(q, ["anomaly", "abnormal", "unusual", "fault", "sensor"]):
        return _explain_anomaly(features, prediction)

    if _matches(q, ["recommend", "fix", "correct", "what should", "action", "do i"]):
        return _explain_recommendations(recommendation, prediction)

    if _matches(q, ["transition", "grade change", "grade switch", "switching"]):
        return _explain_transition(features, prediction)

    if _matches(q, ["confidence", "how sure", "accuracy", "reliable"]):
        return _explain_confidence(prediction)

    if _matches(q, ["moisture", "steam", "speed", "flow", "pressure", "temperature", "consistency"]):
        return _explain_variable(q, features, prediction)

    if _matches(q, ["status", "current", "overview", "summary", "how are we doing"]):
        return _status_summary(features, prediction, recommendation)

    return _general_response(features, prediction, recommendation)


# ─── Handlers ───────────────────────────────────────────────────────────────

def _explain_deviation(features, prediction, recommendation):
    if not prediction:
        return "I currently have no prediction data. Please run a prediction first."

    pred_bw  = prediction.get("predicted_bw", 0)
    status   = prediction.get("status", "UNKNOWN")
    dev      = prediction.get("deviation", 0)
    grade    = int(features.get("grade", 80))
    shap     = prediction.get("shap_values", [])

    direction = "increasing above" if dev > 0 else "falling below"
    top = shap[:3] if shap else []

    lines = [
        f"**Basis Weight Analysis — {grade} GSM Grade**\n",
        f"The predicted Basis Weight is **{pred_bw:.1f} g/m²**, currently {direction} the target midpoint by **{abs(dev):.1f} g/m²** (Status: {status}).\n",
    ]

    if top:
        lines.append("**Primary contributing variables (SHAP analysis):**\n")
        total_pct = 0
        for item in top:
            fn    = item["feature"]
            val   = features.get(fn, "N/A")
            sv    = item["shap_value"]
            pct   = item.get("contribution_pct", 0)
            total_pct += pct
            dirn  = "↑ pushing BW higher" if sv > 0 else "↓ pulling BW lower"
            fname = FRIENDLY_NAMES.get(fn, fn)
            if isinstance(val, float):
                val_str = f"{val:.2f}"
            else:
                val_str = str(val)
            lines.append(f"• **{fname}** (current: {val_str}) — {dirn} by {pct:.1f}%")

        lines.append(f"\nThese factors account for approximately **{total_pct:.0f}%** of the predicted deviation.")

    # Rate-of-change context
    ms_delta = features.get("ms_delta", 0)
    sp_delta = features.get("sp_delta", 0)
    if abs(ms_delta) > 5:
        lines.append(f"\n⚠ Machine Speed changed by **{ms_delta:+.1f} m/min** in the last reading, indicating process instability.")
    if abs(sp_delta) > 0.1:
        lines.append(f"\n⚠ Steam Pressure shifted by **{sp_delta:+.2f} bar**, which may be amplifying the deviation.")

    # Recommendation hook
    if recommendation and recommendation.get("recommendations"):
        r0 = recommendation["recommendations"][0]
        lines.append(f"\n**Recommended immediate action:** {r0['label']} → {r0['recommended_value']} {r0['unit']} "
                     f"(expected BW after: {r0['expected_bw_after']:.1f} g/m²).")

    return "\n".join(lines)


def _explain_anomaly(features, prediction):
    if not prediction:
        return "No prediction data available. Please run a prediction first."

    score = prediction.get("anomaly_score", 0)
    prob  = prediction.get("anomaly_prob", 0)
    pct   = round(prob * 100, 1)

    if pct < 15:
        return (f"**Anomaly Status: NORMAL**\n\nAll sensor readings are within expected operating ranges. "
                f"Anomaly probability is low at **{pct}%**. No abnormal process behaviour detected.")

    lines = [f"**Anomaly Status: {'HIGH' if pct > 50 else 'MODERATE'}** — Probability {pct}%\n"]

    # Check which sensors look unusual
    suspects = []
    ms_delta = abs(features.get("ms_delta", 0))
    sp_delta = abs(features.get("sp_delta", 0))
    sf_delta = abs(features.get("sf_delta", 0))
    bw_std   = features.get("bw_roll_std5", 0)

    if ms_delta > 10:
        suspects.append(f"Machine Speed (rapid change: {ms_delta:.1f} m/min)")
    if sp_delta > 0.2:
        suspects.append(f"Steam Pressure (rapid change: {sp_delta:.2f} bar)")
    if sf_delta > 8:
        suspects.append(f"Stock Flow (rapid change: {sf_delta:.1f} L/min)")
    if bw_std > 3:
        suspects.append(f"Basis Weight Variability (std: {bw_std:.2f} g/m²)")

    if suspects:
        lines.append("**Sensors showing abnormal behaviour:**")
        for s in suspects:
            lines.append(f"• {s}")
    else:
        lines.append("The anomaly may be driven by a combination of small deviations across multiple sensors. "
                     "Check for sensor drift or instrument calibration.")

    lines.append("\n**Recommendation:** Verify sensor readings manually and cross-check with lab measurements.")
    return "\n".join(lines)


def _explain_recommendations(recommendation, prediction):
    if not recommendation or not recommendation.get("recommendations"):
        bw = prediction.get("predicted_bw", 0) if prediction else 0
        return (f"Current Basis Weight prediction ({bw:.1f} g/m²) is within safe limits. "
                f"No corrective action is required at this time.")

    recs  = recommendation["recommendations"]
    conf  = recommendation.get("confidence", 80)
    stab  = recommendation.get("estimated_stabilization_time_saved_min", 0)
    waste = recommendation.get("estimated_material_waste_prevented_kg", 0)
    dev   = recommendation.get("deviation", 0)

    direction = "above" if dev > 0 else "below"
    lines = [
        f"**Corrective Action Plan** (Confidence: {conf:.0f}%)\n",
        f"Basis Weight is deviating **{abs(dev):.1f} g/m²** {direction} target. "
        f"The following setpoint adjustments are recommended:\n",
    ]

    for i, r in enumerate(recs, 1):
        delta_str = f"{r['delta']:+.2f} {r['unit']} ({r['delta_pct']:+.1f}%)"
        lines.append(f"**{i}. {r['label']}:** {r['current_value']} → **{r['recommended_value']} {r['unit']}** ({delta_str})")
        lines.append(f"   *{r['reason']}*\n")

    lines.append(f"**Expected outcome:** Basis Weight recovers to **{recs[0]['expected_bw_after']:.1f} g/m²** "
                 f"within approximately **{stab} minutes**, preventing **{waste} kg** of off-spec material.")
    return "\n".join(lines)


def _explain_transition(features, prediction):
    is_trans  = int(features.get("is_transition", 0))
    t_since   = int(features.get("time_since_grade_change", 999))
    prev_g    = int(features.get("prev_grade", features.get("grade", 80)))
    cur_g     = int(features.get("grade", 80))

    if not is_trans and t_since > 120:
        return (f"**Grade Status: STABLE** — Currently running **{cur_g} GSM** grade. "
                f"Grade change was **{t_since} minutes** ago. Machine is in steady-state operation.")

    pred_bw   = prediction.get("predicted_bw", 0) if prediction else 0
    lo, hi    = _grade_range(cur_g)

    lines = [
        f"**Grade Transition Active: {prev_g} GSM → {cur_g} GSM**\n",
        f"Transition started **{t_since} minutes** ago. During grade changes, Basis Weight typically "
        f"fluctuates ±10–20% before stabilising. Target range for {cur_g} GSM is **{lo}–{hi} g/m²**.\n",
        f"Current prediction: **{pred_bw:.1f} g/m²**.",
    ]

    if pred_bw < lo or pred_bw > hi:
        lines.append(f"\n⚠ Basis Weight has not yet settled within the target range. "
                     f"Monitor closely and apply recommended setpoint adjustments.")
    else:
        lines.append(f"\n✓ Basis Weight is recovering well. Continue current setpoints.")

    return "\n".join(lines)


def _explain_confidence(prediction):
    if not prediction:
        return "No prediction available."
    conf  = prediction.get("confidence", 0)
    anom  = round(prediction.get("anomaly_prob", 0) * 100, 1)
    rmse  = prediction.get("metrics", {}).get("rmse", "N/A")
    r2    = prediction.get("metrics", {}).get("r2", "N/A")

    quality = "High" if conf >= 85 else ("Moderate" if conf >= 70 else "Low")
    lines = [
        f"**Prediction Confidence: {conf}% ({quality})**\n",
        f"The model's overall test performance: RMSE = {rmse} g/m², R² = {r2}.\n",
        f"Current anomaly probability is **{anom}%**, which {'slightly reduces' if anom > 20 else 'does not significantly impact'} confidence.",
    ]
    if conf < 70:
        lines.append("\n⚠ Low confidence may indicate unusual process conditions or a grade transition. "
                     "Cross-validate with lab measurements before acting.")
    return "\n".join(lines)


def _explain_variable(q, features, prediction):
    shap = prediction.get("shap_values", []) if prediction else []
    shap_map = {item["feature"]: item for item in shap}

    feat_map = {
        "moisture":     "moisture",
        "steam":        "steam_pressure",
        "speed":        "machine_speed",
        "flow":         "stock_flow",
        "pressure":     "headbox_pressure",
        "temperature":  "dryer_temperature",
        "consistency":  "pulp_consistency",
    }

    matched = None
    for keyword, feat in feat_map.items():
        if keyword in q:
            matched = feat
            break

    if not matched:
        return _general_response(features, prediction, None)

    val     = features.get(matched, "N/A")
    fname   = FRIENDLY_NAMES.get(matched, matched)
    effect, effect_desc = FEATURE_EFFECT_LABEL.get(matched, ("unknown", "unknown effect"))
    shap_item = shap_map.get(matched)

    lines = [f"**{fname} Analysis**\n"]
    if isinstance(val, float):
        lines.append(f"Current value: **{val:.3f}**")
    else:
        lines.append(f"Current value: **{val}**")

    lines.append(f"Engineering relationship: {effect_desc} (effect on BW is {effect}).")

    if shap_item:
        sv  = shap_item["shap_value"]
        pct = shap_item.get("contribution_pct", 0)
        dirn = "increasing" if sv > 0 else "decreasing"
        lines.append(f"SHAP analysis shows this variable is currently **{dirn} Basis Weight** "
                     f"by approximately **{pct:.1f}%** of total influence.")

    delta_key = f"{matched[:2]}_delta"
    delta = features.get(delta_key, features.get("ms_delta" if matched == "machine_speed" else "sp_delta", 0))
    if abs(delta) > 0.01:
        lines.append(f"Rate of change: **{delta:+.3f}** units per minute — {'increasing' if delta > 0 else 'decreasing'} rapidly.")

    return "\n".join(lines)


def _status_summary(features, prediction, recommendation):
    if not prediction:
        return "No prediction available. Please submit current process readings to get a status overview."

    grade    = int(features.get("grade", 80))
    pred_bw  = prediction.get("predicted_bw", 0)
    status   = prediction.get("status", "UNKNOWN")
    conf     = prediction.get("confidence", 0)
    anom_pct = round(prediction.get("anomaly_prob", 0) * 100, 1)
    is_trans = int(features.get("is_transition", 0))
    lo, hi   = _grade_range(grade)

    status_icon = "🟢" if status == "SAFE" else ("🟡" if status == "WARNING" else "🔴")
    lines = [
        f"**Process Status Overview — {grade} GSM Grade**\n",
        f"{status_icon} **Status:** {status}",
        f"📊 **Predicted BW:** {pred_bw:.1f} g/m²  (Target: {lo}–{hi} g/m²)",
        f"🎯 **Confidence:** {conf}%",
        f"⚡ **Anomaly Probability:** {anom_pct}%",
        f"🔄 **Grade Transition:** {'Active' if is_trans else 'Stable'}",
    ]

    if recommendation and recommendation.get("recommendations"):
        lines.append(f"\n**Corrective actions available.** Top recommendation: "
                     f"{recommendation['recommendations'][0]['label']} adjustment.")

    return "\n".join(lines)


def _general_response(features, prediction, recommendation):
    grade   = int(features.get("grade", 80))
    pred_bw = prediction.get("predicted_bw", 0) if prediction else 0
    conf    = prediction.get("confidence", 0) if prediction else 0
    lo, hi  = _grade_range(grade)

    return (
        f"**Decision Support Summary — {grade} GSM**\n\n"
        f"I can help you with:\n"
        f"• **Root cause analysis** — 'Why is Basis Weight increasing?'\n"
        f"• **Anomaly investigation** — 'Is anything abnormal?'\n"
        f"• **Corrective actions** — 'What should I do?'\n"
        f"• **Grade transition** — 'How is the grade change progressing?'\n"
        f"• **Variable deep-dive** — 'Explain steam pressure impact'\n"
        f"• **Confidence** — 'How reliable is the prediction?'\n\n"
        f"Current prediction: **{pred_bw:.1f} g/m²** (Target: {lo}–{hi} g/m², Confidence: {conf}%)"
    )


def _matches(q: str, keywords: List[str]) -> bool:
    return any(kw in q for kw in keywords)


def _grade_range(grade: int):
    mapping = {45: (42, 48), 60: (57, 63), 80: (76, 84), 120: (114, 126)}
    return mapping.get(grade, (grade * 0.95, grade * 1.05))
