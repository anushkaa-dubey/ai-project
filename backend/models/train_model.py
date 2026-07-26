import pandas as pd
import numpy as np
import joblib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data.generate_data import generate_dataset
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.ensemble import IsolationForest
from xgboost import XGBRegressor

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "model_artifacts")
DATA_DIR      = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

FEATURE_COLS = [
    "machine_speed", "stock_flow", "headbox_pressure", "steam_pressure",
    "dryer_temperature", "moisture", "pulp_consistency", "grade",
    # Lag features
    "bw_lag1", "bw_lag2", "bw_lag3", "bw_lag4", "bw_lag5",
    "ms_lag1", "sp_lag1",
    # Rolling features
    "bw_roll_mean5", "bw_roll_std5",
    "ms_roll_mean5", "ms_roll_std5",
    "sp_roll_mean5",
    # Rate of change (delta)
    "ms_delta", "sp_delta", "sf_delta",
    # Grade transition features
    "prev_grade", "next_grade", "time_since_grade_change", "is_transition",
]

TARGET_COL = "basis_weight"


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = df.sort_values("timestamp").reset_index(drop=True)

    # Lag features
    for lag in range(1, 6):
        df[f"bw_lag{lag}"] = df["basis_weight"].shift(lag)
    df["ms_lag1"] = df["machine_speed"].shift(1)
    df["sp_lag1"] = df["steam_pressure"].shift(1)

    # Rolling features (window=5)
    df["bw_roll_mean5"] = df["basis_weight"].rolling(5, min_periods=1).mean()
    df["bw_roll_std5"]  = df["basis_weight"].rolling(5, min_periods=1).std().fillna(0)
    df["ms_roll_mean5"] = df["machine_speed"].rolling(5, min_periods=1).mean()
    df["ms_roll_std5"]  = df["machine_speed"].rolling(5, min_periods=1).std().fillna(0)
    df["sp_roll_mean5"] = df["steam_pressure"].rolling(5, min_periods=1).mean()

    # Rate of change (delta)
    df["ms_delta"] = df["machine_speed"].diff().fillna(0)
    df["sp_delta"] = df["steam_pressure"].diff().fillna(0)
    df["sf_delta"] = df["stock_flow"].diff().fillna(0)

    # Grade transition features
    df["prev_grade"] = df["grade"].shift(1).fillna(df["grade"].iloc[0])
    df["next_grade"] = df["grade"].shift(-1).fillna(df["grade"].iloc[-1])

    # Time since grade change (minutes)
    grade_changed = (df["grade"] != df["grade"].shift(1)).astype(int)
    time_since = []
    counter = 0
    for g in grade_changed:
        if g == 1:
            counter = 0
        time_since.append(counter)
        counter += 1
    df["time_since_grade_change"] = time_since

    # is_transition already in df; convert bool->int
    df["is_transition"] = df["is_transition"].astype(int)

    return df


def train():
    csv_path = os.path.join(DATA_DIR, "paper_manufacturing_data.csv")
    if os.path.exists(csv_path):
        print("Loading existing dataset...")
        df = pd.read_csv(csv_path)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
    else:
        print("Generating dataset...")
        df = generate_dataset(50000)
        df.to_csv(csv_path, index=False)

    print("Engineering features...")
    df = engineer_features(df)

    # Forward target by 3 rows (~3 minutes ahead)
    df["target_bw"] = df["basis_weight"].shift(-3)
    df = df.dropna(subset=["target_bw"] + FEATURE_COLS)

    X = df[FEATURE_COLS].astype(float)
    y = df["target_bw"].astype(float)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

    print(f"Training XGBoost on {len(X_train)} samples...")
    model = XGBRegressor(
        n_estimators=400,
        max_depth=7,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        reg_alpha=0.1,
        reg_lambda=1.0,
        n_jobs=-1,
        random_state=42,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=50)

    y_pred = model.predict(X_test)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae  = mean_absolute_error(y_test, y_pred)
    r2   = r2_score(y_test, y_pred)
    print("\n=== Model Metrics ===")
    print(f"RMSE : {rmse:.4f} g/m2")
    print(f"MAE  : {mae:.4f} g/m2")
    print(f"R2   : {r2:.4f}")

    # Isolation Forest on raw sensor features
    print("\nTraining Isolation Forest...")
    iso_features = ["machine_speed","stock_flow","headbox_pressure","steam_pressure",
                    "dryer_temperature","moisture","pulp_consistency","basis_weight",
                    "ms_delta","sp_delta","sf_delta"]
    iso_df = df[iso_features].dropna()
    iso_forest = IsolationForest(contamination=0.05, n_estimators=200, random_state=42)
    iso_forest.fit(iso_df)

    # Save artifacts
    joblib.dump(model,      os.path.join(ARTIFACTS_DIR, "xgb_model.joblib"))
    joblib.dump(iso_forest, os.path.join(ARTIFACTS_DIR, "iso_forest.joblib"))
    joblib.dump(FEATURE_COLS, os.path.join(ARTIFACTS_DIR, "feature_cols.joblib"))

    # Save last 500 rows as "live" data for the dashboard
    display_cols = ["timestamp", "grade", "machine_speed", "stock_flow",
                    "headbox_pressure", "steam_pressure", "dryer_temperature",
                    "moisture", "pulp_consistency", "basis_weight", "is_transition"]
    live_display = df.tail(500)[display_cols].copy()
    # Predict using only the model feature columns (numpy to avoid pandas 3.x issue)
    live_X = df.tail(500)[FEATURE_COLS].astype(float)
    import xgboost as xgb
    dmatrix = xgb.DMatrix(live_X)
    live_display["predicted_bw"] = model.get_booster().predict(dmatrix)
    # Also save rolling std for anomaly display
    live_display["bw_roll_std5"] = df.tail(500)["bw_roll_std5"].values
    live_display.to_csv(os.path.join(DATA_DIR, "live_data.csv"), index=False)

    # Save metrics
    metrics = {"rmse": round(rmse, 4), "mae": round(mae, 4), "r2": round(r2, 4)}
    joblib.dump(metrics, os.path.join(ARTIFACTS_DIR, "metrics.joblib"))
    print(f"\nArtifacts saved to {ARTIFACTS_DIR}")
    return model, iso_forest, metrics


if __name__ == "__main__":
    train()
