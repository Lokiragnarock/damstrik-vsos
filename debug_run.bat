@echo off
echo ==========================================
echo   DAMSTRIK V-OS - DEBUG MODE
echo ==========================================

echo [INFO] Checking Python Version...
python --version
if %errorlevel% neq 0 (
    echo [ERROR] Python not found! Please install Python 3.9+ and add to PATH.
    pause
    exit /b
)

echo [INFO] Installing Dependencies...
pip install fastapi uvicorn websockets pydantic

echo [INFO] Starting Server...
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

if %errorlevel% neq 0 (
    echo [CRITICAL] Server crashed! See error above.
    pause
)
pause
