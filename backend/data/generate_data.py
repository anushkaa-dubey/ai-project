import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

random.seed(42)
np.random.seed(42)

GRADES = [45, 60, 80, 120]
GRADE_PARAMS = {
    45: {"machine_speed": (800, 1000), "stock_flow": (200, 250), "headbox_pressure": (0.30, 0.40),
         "steam_pressure": (3.5, 4.0), "dryer_temperature": (110, 120), "moisture": (5.0, 6.5),
         "pulp_consistency": (0.55, 0.65), "basis_weight_target": 45},
    60: {"machine_speed": (700, 900), "stock_flow": (250, 310), "headbox_pressure": (0.38, 0.50),
         "steam_pressure": (4.0, 4.8), "dryer_temperature": (115, 128), "moisture": (4.5, 6.0),
         "pulp_consistency": (0.62, 0.72), "basis_weight_target": 60},
    80: {"machine_speed": (580, 760), "stock_flow": (310, 385), "headbox_pressure": (0.48, 0.62),
         "steam_pressure": (4.6, 5.5), "dryer_temperature": (120, 135), "moisture": (4.0, 5.5),
         "pulp_consistency": (0.70, 0.82), "basis_weight_target": 80},
    120: {"machine_speed": (420, 580), "stock_flow": (400, 490), "headbox_pressure": (0.60, 0.78),
          "steam_pressure": (5.2, 6.2), "dryer_temperature": (128, 145), "moisture": (3.5, 5.0),
          "pulp_consistency": (0.80, 0.95), "basis_weight_target": 120},
}

def generate_stable_segment(grade, n_rows, noise_scale=1.0):
    p = GRADE_PARAMS[grade]
    bw_target = p["basis_weight_target"]

    machine_speed    = np.random.uniform(*p["machine_speed"], n_rows) + np.random.normal(0, 5 * noise_scale, n_rows)
    stock_flow       = np.random.uniform(*p["stock_flow"], n_rows) + np.random.normal(0, 3 * noise_scale, n_rows)
    headbox_pressure = np.random.uniform(*p["headbox_pressure"], n_rows) + np.random.normal(0, 0.01 * noise_scale, n_rows)
    steam_pressure   = np.random.uniform(*p["steam_pressure"], n_rows) + np.random.normal(0, 0.05 * noise_scale, n_rows)
    dryer_temperature= np.random.uniform(*p["dryer_temperature"], n_rows) + np.random.normal(0, 1.0 * noise_scale, n_rows)
    moisture         = np.random.uniform(*p["moisture"], n_rows) + np.random.normal(0, 0.2 * noise_scale, n_rows)
    pulp_consistency = np.random.uniform(*p["pulp_consistency"], n_rows) + np.random.normal(0, 0.01 * noise_scale, n_rows)

    machine_speed     = np.clip(machine_speed, p["machine_speed"][0]*0.85, p["machine_speed"][1]*1.15)
    stock_flow        = np.clip(stock_flow, p["stock_flow"][0]*0.85, p["stock_flow"][1]*1.15)
    headbox_pressure  = np.clip(headbox_pressure, 0.25, 0.90)
    steam_pressure    = np.clip(steam_pressure, 3.0, 7.0)
    dryer_temperature = np.clip(dryer_temperature, 100, 160)
    moisture          = np.clip(moisture, 2.0, 9.0)
    pulp_consistency  = np.clip(pulp_consistency, 0.40, 1.05)

    # Physics-inspired BW formula
    basis_weight = (
        bw_target
        + (stock_flow - np.mean(p["stock_flow"])) * 0.18
        - (machine_speed - np.mean(p["machine_speed"])) * 0.04
        + (headbox_pressure - np.mean(p["headbox_pressure"])) * 12.0
        + (steam_pressure - np.mean(p["steam_pressure"])) * 2.2
        - (moisture - np.mean(p["moisture"])) * 1.5
        + (pulp_consistency - np.mean(p["pulp_consistency"])) * 15.0
        + np.random.normal(0, 1.2 * noise_scale, n_rows)
    )

    return pd.DataFrame({
        "grade": grade,
        "machine_speed": machine_speed,
        "stock_flow": stock_flow,
        "headbox_pressure": headbox_pressure,
        "steam_pressure": steam_pressure,
        "dryer_temperature": dryer_temperature,
        "moisture": moisture,
        "pulp_consistency": pulp_consistency,
        "basis_weight": basis_weight,
        "is_transition": False,
    })


def generate_transition_segment(from_grade, to_grade, n_rows=80):
    """Transition period with heavy instability."""
    p_from = GRADE_PARAMS[from_grade]
    p_to   = GRADE_PARAMS[to_grade]

    segments = []
    for i in range(n_rows):
        alpha = i / n_rows
        interp = lambda key: p_from[key][0] * (1 - alpha) + p_to[key][0] * alpha + \
                              (p_from[key][1] - p_from[key][0]) * 0.5 * (1 - alpha) + \
                              (p_to[key][1]   - p_to[key][0])   * 0.5 * alpha
        machine_speed     = interp("machine_speed")    + np.random.normal(0, 35)
        stock_flow        = interp("stock_flow")       + np.random.normal(0, 18)
        headbox_pressure  = interp("headbox_pressure") + np.random.normal(0, 0.05)
        steam_pressure    = interp("steam_pressure")   + np.random.normal(0, 0.25)
        dryer_temperature = interp("dryer_temperature")+ np.random.normal(0, 5)
        moisture          = interp("moisture")         + np.random.normal(0, 0.8)
        pulp_consistency  = interp("pulp_consistency") + np.random.normal(0, 0.05)

        bw_from = p_from["basis_weight_target"]
        bw_to   = p_to["basis_weight_target"]
        bw_interp = bw_from * (1 - alpha) + bw_to * alpha
        instability_amp = 8 * np.sin(np.pi * alpha) + abs(bw_to - bw_from) * 0.12
        basis_weight = bw_interp + np.random.normal(0, instability_amp)

        segments.append({
            "grade": to_grade,
            "machine_speed": machine_speed,
            "stock_flow": stock_flow,
            "headbox_pressure": headbox_pressure,
            "steam_pressure": steam_pressure,
            "dryer_temperature": dryer_temperature,
            "moisture": moisture,
            "pulp_consistency": pulp_consistency,
            "basis_weight": basis_weight,
            "is_transition": True,
        })

    return pd.DataFrame(segments)


def generate_dataset(total_rows=50000):
    print(f"Generating {total_rows} rows of synthetic paper manufacturing data...")
    
    start_time = datetime(2024, 1, 1, 6, 0, 0)
    rows_per_min = 1  # 1 reading per minute

    segments = []
    current_rows = 0
    prev_grade = None
    grade_cycle = [45, 60, 80, 120, 80, 60, 45, 120, 60, 80, 45, 120]
    cycle_idx = 0

    while current_rows < total_rows:
        grade = grade_cycle[cycle_idx % len(grade_cycle)]
        cycle_idx += 1

        # Transition
        if prev_grade is not None and prev_grade != grade:
            trans_n = np.random.randint(60, 120)
            trans_df = generate_transition_segment(prev_grade, grade, trans_n)
            segments.append(trans_df)
            current_rows += len(trans_df)

        # Stable
        stable_n = np.random.randint(1500, 3500)
        remaining = total_rows - current_rows
        stable_n = min(stable_n, remaining)
        if stable_n <= 0:
            break
        stable_df = generate_stable_segment(grade, stable_n)
        segments.append(stable_df)
        current_rows += stable_n
        prev_grade = grade

    df = pd.concat(segments, ignore_index=True)
    df = df.head(total_rows)

    # Timestamps
    timestamps = [start_time + timedelta(minutes=i) for i in range(len(df))]
    df.insert(0, "timestamp", timestamps)

    # Clip physically unreasonable values
    df["machine_speed"]     = df["machine_speed"].clip(350, 1100)
    df["stock_flow"]        = df["stock_flow"].clip(150, 550)
    df["headbox_pressure"]  = df["headbox_pressure"].clip(0.20, 0.95)
    df["steam_pressure"]    = df["steam_pressure"].clip(2.8, 7.5)
    df["dryer_temperature"] = df["dryer_temperature"].clip(95, 165)
    df["moisture"]          = df["moisture"].clip(1.8, 10.0)
    df["pulp_consistency"]  = df["pulp_consistency"].clip(0.35, 1.10)
    df["basis_weight"]      = df["basis_weight"].clip(30, 150)

    print(f"Dataset shape: {df.shape}")
    print(df.dtypes)
    print(df.head())
    return df


if __name__ == "__main__":
    import os
    os.makedirs("data", exist_ok=True)
    df = generate_dataset(50000)
    df.to_csv("data/paper_manufacturing_data.csv", index=False)
    print("Saved to data/paper_manufacturing_data.csv")
