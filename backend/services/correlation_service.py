"""
Correlation Analysis Service
Computes Pearson, Spearman correlations and feature interaction matrix.
"""
import pandas as pd
import numpy as np
from scipy import stats
import os
from typing import Dict, List

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

NUMERIC_COLS = [
    "machine_speed", "stock_flow", "headbox_pressure", "steam_pressure",
    "dryer_temperature", "moisture", "pulp_consistency", "basis_weight"
]

COL_LABELS = {
    "machine_speed":     "Mach Speed",
    "stock_flow":        "Stock Flow",
    "headbox_pressure":  "HB Pressure",
    "steam_pressure":    "Steam Press",
    "dryer_temperature": "Dryer Temp",
    "moisture":          "Moisture",
    "pulp_consistency":  "Pulp Cons.",
    "basis_weight":      "Basis Wt",
}

_cache: Dict = {}


def _load_data() -> pd.DataFrame:
    if "df" in _cache:
        return _cache["df"]
    csv_path = os.path.join(DATA_DIR, "paper_manufacturing_data.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError("Dataset not found. Run train_model.py first.")
    df = pd.read_csv(csv_path, usecols=NUMERIC_COLS + ["grade", "timestamp"])
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    _cache["df"] = df
    return df


def get_correlations(grade: int = None) -> Dict:
    df = _load_data()
    if grade:
        df = df[df["grade"] == grade]
    sub = df[NUMERIC_COLS].dropna()

    # Pearson
    pearson = sub.corr(method="pearson")
    # Spearman
    spearman = sub.corr(method="spearman")

    # Pearson p-values (feature vs basis_weight)
    bw = sub["basis_weight"]
    pvals = {}
    for col in NUMERIC_COLS:
        if col == "basis_weight":
            continue
        r, p = stats.pearsonr(sub[col], bw)
        pvals[col] = {"r": round(float(r), 4), "p": round(float(p), 6),
                      "significant": bool(p < 0.05),
                      "label": COL_LABELS.get(col, col)}

    # Format heatmap matrices
    labels = [COL_LABELS.get(c, c) for c in NUMERIC_COLS]

    pearson_matrix  = _matrix_to_list(pearson,  NUMERIC_COLS, labels)
    spearman_matrix = _matrix_to_list(spearman, NUMERIC_COLS, labels)

    # Feature interaction: top correlated pairs (excluding diagonal)
    interactions = []
    seen = set()
    for i, c1 in enumerate(NUMERIC_COLS):
        for j, c2 in enumerate(NUMERIC_COLS):
            if i >= j:
                continue
            key = tuple(sorted([c1, c2]))
            if key in seen:
                continue
            seen.add(key)
            r = float(pearson.loc[c1, c2])
            interactions.append({
                "feature_a": COL_LABELS.get(c1, c1),
                "feature_b": COL_LABELS.get(c2, c2),
                "pearson_r": round(r, 4),
                "strength":  "Strong" if abs(r) > 0.7 else ("Moderate" if abs(r) > 0.4 else "Weak"),
                "direction": "Positive" if r > 0 else "Negative",
            })
    interactions.sort(key=lambda x: abs(x["pearson_r"]), reverse=True)

    return {
        "labels":         labels,
        "pearson_matrix": pearson_matrix,
        "spearman_matrix": spearman_matrix,
        "bw_correlations": pvals,
        "top_interactions": interactions[:20],
        "sample_size":    len(sub),
        "grade_filter":   grade,
    }


def _matrix_to_list(corr_df: pd.DataFrame, cols: List[str], labels: List[str]) -> List[List]:
    rows = []
    for i, c in enumerate(cols):
        row = []
        for j, d in enumerate(cols):
            row.append(round(float(corr_df.loc[c, d]), 4))
        rows.append(row)
    return rows
