@echo off
echo ==============================================
echo Iniciando Servidor API del Auto-Pay (Python)
echo ==============================================
cd services\auto-pay-bot
echo Instalando nuevas librerias...
pip install -r requirements.txt
echo.
echo Iniciando FastAPI...
python -m uvicorn api:app --host 0.0.0.0 --port 8000
pause
