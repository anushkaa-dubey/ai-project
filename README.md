# AI-Powered Grade Change Intelligence
### Paper Manufacturing Decision Support System

> An AI-powered industrial decision support system that predicts Basis Weight deviations during paper grade transitions, explains root causes, detects anomalies, recommends optimal machine setpoints under engineering constraints, and continuously improves using operator feedback.

**Live Demo**:
- Frontend (Vercel): [https://grade-change-ai.vercel.app](https://grade-change-ai.vercel.app)
- Backend API (Render): [https://grade-change-ai-api.onrender.com/docs](https://grade-change-ai-api.onrender.com/docs)

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
    PostgreSQL Database (Neon)
```

---

## Tech Stack

| Layer     | Technology                                   |
|-----------|----------------------------------------------|
| Frontend  | Vanilla HTML/CSS/JS + Chart.js CDN           |
| Backend   | FastAPI (Python 3.11)                        |
| ML        | XGBoost, SHAP, Scikit-learn (Isolation Forest)|
| Database  | PostgreSQL (via Neon), SQLAlchemy, Alembic    |
| Deploy    | Docker Compose, Vercel, Render/Railway       |
| Theme     | Honeywell Industrial Dark UI                 |

---

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Or: Python 3.11 and PostgreSQL

### Local Development via Docker (Recommended)
The easiest way to run the full stack locally is with Docker Compose.

```bash
# 1. Build and start the containers
docker-compose up --build
```
This will automatically:
1. Start a PostgreSQL 15 database on port 5432
2. Run Alembic migrations to set up the schema
3. Start the FastAPI backend on port 8000
4. Serve the frontend via Nginx on port 3000

Access the app at: **http://localhost:3000**
Access API Docs at: **http://localhost:8000/docs**

### Local Development (Manual Setup)

1. Start a local PostgreSQL instance and create a database named `grade_change_db`.
2. Update the `DATABASE_URL` in `backend/.env`.

```bash
# Backend
cd backend
python -m venv venv
# Activate venv: venv\Scripts\activate (Windows) / source venv/bin/activate (Mac/Linux)
pip install -r requirements.txt
python models/train_model.py  # Generate synthetic data & train ML models
alembic upgrade head          # Run database migrations
python -m uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
python -m http.server 3000
```

---

---

## Deployment Architecture

The application is fully containerised and uses environment variables for simple deployment.

- **Frontend**: Hosted on Vercel.
- **Backend API**: Hosted on Render (or Railway).
- **Database**: Managed PostgreSQL hosted on Neon.

### 1. Database (Neon)
1. Create a free account at [Neon.tech](https://neon.tech).
2. Create a new PostgreSQL project.
3. Copy the Connection String (e.g., `postgresql://...`).

### 2. Backend (Render / Railway)
1. Link your GitHub repository to Render/Railway.
2. Select the `backend` folder as the root directory (or use Dockerfile).
3. Set the following Environment Variables:
   - `ENVIRONMENT=production`
   - `DATABASE_URL=<your-neon-postgres-connection-string>`
   - `BACKEND_CORS_ORIGINS=https://your-frontend-domain.vercel.app`
4. Define the build/start command to run migrations before starting:
   - `alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`

### 3. Frontend (Vercel)
1. Import your GitHub repository to Vercel.
2. Set the "Framework Preset" to "Other".
3. Set the "Root Directory" to `frontend`.
4. Ensure your JS `api.js` points to the deployed Render backend URL.

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
│   ├── database/
│   │   └── db.py              ← SQLAlchemy + PostgreSQL config
│   ├── alembic/               ← Database migrations
│   ├── config.py              ← Pydantic environment configuration
│   └── Dockerfile             ← Backend container definition
├── docker-compose.yml         ← Full-stack local orchestration
└── frontend/
    ├── Dockerfile             ← Nginx frontend container
    ├── index.html
    ├── css/style.css          ← Honeywell industrial theme
    └── js/
        ├── api.js             ← API client
        ├── app.js             ← Router + Copilot
        └── pages/             ← 6 page modules
```
