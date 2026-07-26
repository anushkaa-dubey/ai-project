# GCI — Grade Change Intelligence

## What this project does

GCI is an industrial AI decision-support application for paper manufacturing. It helps operators and engineers monitor grade changes, predict Basis Weight deviations before they become severe, detect abnormal process behavior, explain the likely root causes, and recommend corrective machine setpoints that stay within safe operating limits.

The system is designed as a demo-ready dashboard that combines machine learning, explainable AI, and a lightweight operator feedback loop in one workflow.

---

## Core purpose

During paper grade transitions, process conditions can shift quickly and cause unstable quality outcomes. GCI is intended to answer four key questions:

1. What will Basis Weight look like in the near future?
2. Is the current process behaving abnormally?
3. Which variables are driving the change?
4. What corrective action should be taken next?

---

## Main user experience

The app is structured as a multi-page industrial dashboard with the following sections:

- Dashboard: high-level monitoring with KPIs, trend visualization, anomaly history, and process context
- Prediction: live prediction workflow with model output, SHAP explanation, and anomaly status
- Correlation: feature relationship analysis for process understanding
- Recommendations: hybrid action suggestions with what-if simulation
- Operator Feedback: feedback capture and historical review
- Analytics: aggregated operational and model performance insights

A floating decision support panel is also available for structured process guidance questions.

---

## How the system works

### 1. Data generation and training

The backend includes synthetic manufacturing data generation and model training logic. The project uses a large synthetic dataset that mimics realistic paper mill behavior with grade transitions, sensor fluctuations, and quality shifts.

The main machine learning workflow is:

- generate synthetic process data
- engineer features such as lags, rolling statistics, deltas, and transition indicators
- train an XGBoost regression model to predict future Basis Weight
- train an Isolation Forest model to identify anomalies
- use SHAP to explain which features influenced the prediction

### 2. Prediction and anomaly detection

At prediction time, the system takes recent process readings and predicts the Basis Weight several minutes ahead. It also evaluates whether the current state appears abnormal and calculates which features contributed most to the prediction.

### 3. Recommendation engine

The recommendation service combines:

- engineering safety rules
- SHAP-based feature influence
- sensitivity-style reasoning for likely impact

This creates practical operator recommendations such as changes to machine speed, pressure, or flow setpoints.

### 4. Feedback loop

Operator feedback is stored in SQLite so the system can capture whether a recommendation was accepted, rejected, or commented on. This keeps the experience interactive and makes the demo feel closer to a real industrial control environment.

---

## Key technical stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript, Chart.js |
| Backend | FastAPI (Python) |
| ML | XGBoost, SHAP, scikit-learn |
| Data | Pandas, NumPy |
| Persistence | SQLite with SQLAlchemy |

---

## Project structure

- backend/main.py: FastAPI app entry point and router registration
- backend/routers/: API endpoints for dashboard, prediction, recommendations, feedback, analytics, decision support, and correlation
- backend/services/: business logic for ML inference, recommendations, correlations, and decision support responses
- backend/models/: model training and artifact storage
- backend/data/: synthetic data generation
- frontend/: static dashboard UI and page-specific JavaScript modules

---

## API overview

The backend exposes REST endpoints for:

- dashboard metrics and charts
- prediction requests
- simulation requests
- correlation analysis
- recommendation generation
- operator feedback submission and retrieval
- analytics summaries
- Structured decision-support guidance

---

## Demo flow

A typical demo path is:

1. Open the dashboard to view live KPIs and trend context
2. Move to Prediction to see the next-step Basis Weight estimate
3. Review the SHAP explanation to understand which process variables matter most
4. Open Recommendations to see recommended adjustments
5. Submit feedback based on the recommendation quality
6. Use the decision support panel for follow-up guidance questions

---

## Why this project is useful

This project demonstrates how AI can support industrial operations in a practical way:

- reduces guesswork during grade transitions
- highlights unusual operating conditions early
- makes model outputs understandable for operators
- provides actionable recommendations instead of raw scores alone
- creates a realistic decision-support experience for demos and presentations

---

## Summary

GCI combines machine learning, explainability, recommendation logic, and operator feedback into a single industrial dashboard experience. It is meant to feel like a realistic decision-support tool for paper manufacturing teams, while remaining simple enough to run and demo locally.
