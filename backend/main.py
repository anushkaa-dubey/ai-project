"""
AI-Powered Grade Change Intelligence — FastAPI Backend
"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database.db import init_db
from routers import dashboard, predict, simulate, feedback, analytics, correlations, copilot


# ── Custom JSON encoder that converts numpy types to native Python ──────────
class _NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


class NumpyJSONResponse(JSONResponse):
    """Drop-in JSONResponse that handles numpy scalars transparently."""
    def render(self, content) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
            cls=_NumpyEncoder,
        ).encode("utf-8")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Grade Change Intelligence API",
    description="AI-powered decision support for paper manufacturing grade transitions",
    version="1.0.0",
    default_response_class=NumpyJSONResponse,   # ← applies to every route
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(dashboard.router,    tags=["Dashboard"])
app.include_router(predict.router,      tags=["Prediction"])
app.include_router(simulate.router,     tags=["Simulator"])
app.include_router(feedback.router,     tags=["Feedback"])
app.include_router(analytics.router,    tags=["Analytics"])
app.include_router(correlations.router, tags=["Correlations"])
app.include_router(copilot.router,      tags=["Copilot"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "Grade Change Intelligence API"}
