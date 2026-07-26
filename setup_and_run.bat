@echo off
echo ============================================================
echo   AI-Powered Grade Change Intelligence
echo   Paper Manufacturing Decision Support System
echo ============================================================
echo.

cd /d "%~dp0backend"

echo [1/3] Installing backend dependencies (may take 3-5 min first time)...
python -m pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies. Check internet connection.
    pause
    exit /b 1
)

echo [2/3] Generating synthetic data and training ML model...
echo      (This takes 2-4 minutes - XGBoost training on 40,000 samples)
python models\train_model.py
if errorlevel 1 (
    echo ERROR: Model training failed. Check Python packages.
    pause
    exit /b 1
)

echo [3/3] Starting FastAPI backend server...
echo.
echo ============================================================
echo   Backend API:  http://127.0.0.1:8000
echo   Swagger Docs: http://127.0.0.1:8000/docs
echo.
echo   Open a NEW terminal window and run:
echo     start_frontend.bat
echo   Then open:
echo     http://localhost:3000
echo ============================================================
echo.
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
