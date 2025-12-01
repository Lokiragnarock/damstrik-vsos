@echo off
echo ==========================================
echo   DAMSTRIK V-OS SIMULATOR - STARTUP
echo ==========================================

echo [1/3] Checking Python...
python --version
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH.
    pause
    exit /b
)

echo [2/3] Installing Dependencies...
pip install fastapi uvicorn websockets pydantic

echo [3/3] Starting V-OS Logic Engine...
echo.
echo   -> Dashboard: http://localhost:8000
echo   -> API Docs:  http://localhost:8000/docs
echo.
echo Press CTRL+C to stop the server.
echo.

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
