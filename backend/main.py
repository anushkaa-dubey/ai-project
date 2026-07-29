"""
AI-Powered Grade Change Intelligence — FastAPI Backend
"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from database.db import engine
from routers import dashboard, predict, simulate, feedback, analytics, correlations, copilot
from config import settings

# ── Structured Logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

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
    title=settings.PROJECT_NAME,
    description="AI-powered decision support for paper manufacturing grade transitions",
    version=settings.VERSION,
    default_response_class=NumpyJSONResponse,   # ← applies to every route
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_origins=[settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    logger.info("Starting up Grade Change Intelligence API...")


# ── Centralized Error Handling ────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error on {request.method} {request.url}: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "message": "Invalid request parameters"}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred.", "message": str(exc)}
    )

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(dashboard.router,    tags=["Dashboard"])
app.include_router(predict.router,      tags=["Prediction"])
app.include_router(simulate.router,     tags=["Simulator"])
app.include_router(feedback.router,     tags=["Feedback"])
app.include_router(analytics.router,    tags=["Analytics"])
app.include_router(correlations.router, tags=["Correlations"])
app.include_router(copilot.router,      tags=["Decision Support"])


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.PROJECT_NAME, "environment": settings.ENVIRONMENT}

