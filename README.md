# AI-Powered Grade Change Intelligence
### Paper Manufacturing Decision Support System

> An AI-powered industrial decision support system that predicts Basis Weight deviations during paper grade transitions, explains root causes, detects anomalies, recommends optimal machine setpoints under engineering constraints, and continuously improves using operator feedback.

---

## System Architecture

```
Synthetic Historical Data (50,000 rows)
              │
              ▼
    Feature Engineering
    ┌─────────────────────────────────┐
    │ Lag features (t-1 to t-5)       │
    │ Rolling Mean & Std (window=5)   │
    │ Rate of Change (Δ) per feature  │
    │ Grade transition flags          │
    │ Time since grade change         │
    └─────────────────────────────────┘
              │
              ▼
    XGBoost Prediction Model
    (Predicts BW 3 min ahead)
              │
     ┌────────┴────────┐
     ▼                 ▼
SHAP Explainability  Isolation Forest
(Top feature drivers) (Anomaly detection)
     │                 │
     └────────┬────────┘
              ▼
  Hybrid Recommendation Engine
  (Engineering rules + SHAP + Optimisation)
              │
              ▼
      FastAPI Backend (Port 8000)
              │
     ┌────────┼────────┐
     ▼        ▼        ▼
 Dashboard  Simulator Decision Support
              │
              ▼
      Operator Feedback
              │
              ▼
       SQLite Database
```

---

## Tech Stack

| Layer     | Technology                                   |
|-----------|----------------------------------------------|
| Frontend  | Vanilla HTML/CSS/JS + Chart.js CDN           |
| Backend   | FastAPI (Python 3.10+)                        |
| ML        | XGBoost, SHAP, Scikit-learn (Isolation Forest)|
| Database  | SQLite via SQLAlchemy                         |
| Theme     | Honeywell Industrial Dark UI                 |

---

## Quick Start

### Prerequisites
- Python 3.10 or higher
- pip

### Step 1 — Run Setup (First Time)
```bash
# Double-click or run:
setup_and_run.bat
```
This will:
1. Create a Python virtual environment
2. Install all dependencies
3. Generate 50,000 rows of synthetic paper manufacturing data
4. Train the XGBoost model (~2-4 minutes)
5. Start the FastAPI backend at `http://127.0.0.1:8000`

### Step 2 — Start Frontend (New Terminal)
```bash
start_frontend.bat
# OR manually:
cd frontend && python -m http.server 3000
```
Open your browser at: **http://localhost:3000**

### Manual Steps (Advanced)
```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python models/train_model.py  # generates data + trains model
python -m uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
python -m http.server 3000
```

---

## API Endpoints

| Method | Endpoint        | Description                                      |
|--------|----------------|--------------------------------------------------|
| GET    | /dashboard      | KPIs, trend data, anomaly timeline, grade timeline|
| POST   | /predict        | Full prediction + SHAP + recommendations         |
| POST   | /simulate       | What-if simulator (fast, no SHAP)                |
| GET    | /correlations   | Pearson/Spearman matrices, interaction table     |
| POST   | /feedback       | Submit operator accept/reject feedback           |
| GET    | /feedback       | Retrieve feedback history                        |
| GET    | /analytics      | Aggregated metrics, model performance            |
| POST   | /decision-support | Structured decision-support responses        |
| GET    | /docs           | Swagger UI (interactive API docs)                |

---

## Dataset

**50,000 rows** of realistic synthetic paper manufacturing data.

| Feature             | Description                        |
|---------------------|------------------------------------|
| timestamp           | 1-minute interval readings         |
| grade               | 45 / 60 / 80 / 120 GSM             |
| machine_speed       | Line speed (m/min)                 |
| stock_flow          | Fibre slurry flow (L/min)          |
| headbox_pressure    | Jet pressure (bar)                 |
| steam_pressure      | Dryer steam (bar)                  |
| dryer_temperature   | Dryer section temp (°C)            |
| moisture            | Sheet moisture content (%)         |
| pulp_consistency    | Fibre concentration (fraction)     |
| basis_weight        | Target variable — grammage (g/m²)  |

Grade transitions include **intentionally unstable periods** with ±15% BW fluctuation.

---

## ML Pipeline

### Prediction Model — XGBoost
- **Target**: Basis Weight 3 minutes ahead (3-step forward shift)
- **Features**: 28 engineered features (raw + lag + rolling + delta + transition)
- **Split**: 80/20 time-based split (no shuffling)
- **Hyperparameters**: n_estimators=400, max_depth=7, lr=0.05, subsample=0.8

### Anomaly Detection — Isolation Forest
- Contamination: 5%
- Features: raw sensor readings + delta values
- Score normalised to 0–1 probability

### Explainability — SHAP TreeExplainer
- Per-prediction feature attribution
- Top 8 contributors with %, direction (positive/negative)

---

## Feature Engineering

| Feature Type      | Features Generated                                   |
|-------------------|------------------------------------------------------|
| Lag               | bw_lag1 to bw_lag5, ms_lag1, sp_lag1               |
| Rolling (w=5)     | bw_roll_mean5, bw_roll_std5, ms_roll_mean5/std5, sp_roll_mean5 |
| Rate of Change    | ms_delta, sp_delta, sf_delta                        |
| Grade Transition  | prev_grade, next_grade, time_since_grade_change, is_transition |

---

## Hybrid Recommendation Engine

Recommendations combine three layers:
1. **Engineering Safety Rules** — constraints within safe operating envelope
2. **SHAP Feature Importance** — weight corrections by actual model attribution
3. **Linearised Sensitivity** — how much BW changes per unit feature change

Each recommendation includes:
- Recommended setpoint value with delta %
- Root cause reasoning
- Expected BW after adjustment
- Estimated stabilisation time saved
- Confidence score

---

## UI Pages

| Page              | Key Features                                         |
|-------------------|------------------------------------------------------|
| Dashboard         | 8 KPI cards, BW trend, Actual vs Predicted, Anomaly timeline, Feature Importance, Grade Timeline |
| Prediction        | Input form, SHAP bar chart, Anomaly gauge, Full results |
| Correlation       | Pearson/Spearman heatmap, BW correlation bars, Feature interaction table |
| Recommendations   | Hybrid engine output + What-If slider simulator      |
| Operator Feedback | Submit accept/reject/comment, full history table     |
| Analytics         | Feedback donut, Feature importance, Operator activity, Value KPIs |

### Decision Support Panel
- Floating panel (toggle button or **Ctrl+K**)
- Answers using: prediction output, SHAP, anomaly scores, recommendations
- Example queries:
  - "Why is Basis Weight increasing?"
  - "What should I do?"
  - "Is anything abnormal?"
  - "Explain steam pressure impact"

---

## Project Structure

```
aiproject/
├── setup_and_run.bat          ← Run this first!
├── start_frontend.bat
├── backend/
│   ├── main.py                ← FastAPI app
│   ├── requirements.txt
│   ├── data/
│   │   └── generate_data.py   ← 50k row synthetic generator
│   ├── models/
│   │   └── train_model.py     ← XGBoost + IsolationForest training
│   ├── routers/               ← API route handlers
│   ├── services/
│   │   ├── ml_service.py      ← Prediction + SHAP
│   │   ├── recommendation_service.py ← Hybrid engine
│   │   ├── correlation_service.py    ← Pearson/Spearman
│   │   └── copilot_service.py ← NL decision support
│   └── database/
│       └── db.py              ← SQLAlchemy + SQLite
└── frontend/
    ├── index.html
    ├── css/style.css          ← Honeywell industrial theme
    └── js/
        ├── api.js             ← API client
        ├── app.js             ← Router + Copilot
        └── pages/             ← 6 page modules
```
