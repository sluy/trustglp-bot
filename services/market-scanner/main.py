from fastapi import FastAPI
import os
import json
from pydantic import BaseModel
import redis.asyncio as aioredis
from contextlib import asynccontextmanager
import asyncio
import uvicorn
from scanner import market_scanner_worker, bybit_market_scanner_worker
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))
from sentinel_nlp import analyze_crypto_news

# Variables de entorno simuladas para conexión
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Estado global
app_state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Conectar a Redis
    try:
        redis_client = await aioredis.from_url(REDIS_URL, decode_responses=True)
        app_state["redis"] = redis_client
        print("Conectado a Redis exitosamente.")
        
        # Lanzar los workers asíncronos P2P
        app_state["scanner_task"] = asyncio.create_task(market_scanner_worker(redis_client))
        app_state["bybit_scanner_task"] = asyncio.create_task(bybit_market_scanner_worker(redis_client))
    except Exception as e:
        print(f"Error conectando a Redis o lanzando worker: {e}")
    yield
    # Shutdown: Cerrar conexión a Redis y cancelar tareas
    if "scanner_task" in app_state:
        app_state["scanner_task"].cancel()
    if "bybit_scanner_task" in app_state:
        app_state["bybit_scanner_task"].cancel()
    if "redis" in app_state:
        await app_state["redis"].close()

app = FastAPI(
    title="P2P Market Scanner",
    description="Servicio de extracción de datos P2P de Binance",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/health")
async def health_check():
    redis_status = "connected" if "redis" in app_state else "disconnected"
    return {
        "status": "ok", 
        "service": "market-scanner",
        "redis": redis_status
    }

class WebhookPayload(BaseModel):
    text: str
    source: str = "external"

import httpx

async def send_telegram_alert(text: str):
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "8204244360:AAEhBziF0jBMBcI91eVhreQd7uQ_IRi60-8")
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "-1004472055488")
    if not bot_token or not chat_id:
        return
        
    # Auto-format chat ID to include -100 prefix if missing
    chat_id = str(chat_id).strip()
    if chat_id.startswith("-") and not chat_id.startswith("-100"):
        chat_id = f"-100{chat_id[1:]}"
        
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, timeout=5.0)
            if res.status_code != 200:
                print(f"Error enviando Telegram desde Sentinel: status={res.status_code}, response={res.text}")
    except Exception as e:
        print(f"Error enviando Telegram desde Sentinel: {e}")

@app.post("/api/webhooks/sentinel")
async def webhook_sentinel(payload: WebhookPayload):
    result = analyze_crypto_news(payload.text)
    
    redis_status = "not_saved"
    if "redis" in app_state:
        redis_client = app_state["redis"]
        # Guardar con un timeout de 4 horas (14400 segundos)
        await redis_client.setex("sentinel:latest_sentiment", 14400, json.dumps({
            "score": result.score,
            "action": result.action,
            "timestamp": result.timestamp,
            "source": payload.source,
            "prompt": payload.text
        }))
        redis_status = "saved_with_expiry_4h"

    if result.action != "NEUTRAL":
        icon = "🚨" if result.action == "PANIC_KILL_SWITCH" else "🚀"
        msg = f"{icon} <b>SENTINEL NLP ALERT</b> {icon}\n\n<b>Source:</b> {payload.source}\n<b>Score:</b> {result.score:.2f} ({result.action})\n\n<b>News:</b> <i>{payload.text}</i>"
        await send_telegram_alert(msg)
        
    return {"status": "processed", "result": result.dict(), "redis": redis_status}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
