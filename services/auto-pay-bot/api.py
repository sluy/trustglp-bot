import os
import base64
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from banesco_rpa import ejecutar_pago_banesco
from orchestrator import run_orchestrator_loop, engine_state

app = FastAPI(title="Auto-Pay RPA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(run_orchestrator_loop())

@app.get("/api/engine/status")
def get_engine_status():
    return {
        "ok": True, 
        "isRunning": engine_state["is_running"],
        "last_error": engine_state.get("last_error")
    }

from pydantic import BaseModel

class TestRpaRequest(BaseModel):
    cedula: str
    cuenta: str
    monto: float

from banesco_rpa import cerrar_sesion_banesco

async def run_test_and_close(cedula, cuenta, monto, cuenta_asignada=None):
    if cuenta_asignada:
        await ejecutar_pago_banesco(cedula, "", cuenta, monto, cuenta_asignada=cuenta_asignada, is_test=True)
    else:
        await ejecutar_pago_banesco(cedula, "", cuenta, monto, is_test=True)
    
    # Cerrar específicamente esta sesión para no afectar las otras concurrentes
    await asyncio.sleep(5)
    if cuenta_asignada:
        from banesco_rpa import session_managers
        manager = session_managers.get(cuenta_asignada['user'])
        if manager:
            await manager.close_session()
            del session_managers[cuenta_asignada['user']]

@app.post("/api/engine/test-rpa")
async def test_rpa(req: TestRpaRequest):
    # Corre el RPA en background para no bloquear el request
    asyncio.create_task(run_test_and_close(req.cedula, req.cuenta, req.monto))
    return {"ok": True, "message": "Prueba RPA Banesco iniciada."}

class TestPagoMovilRequest(BaseModel):
    banco: str
    beneficiario: str
    cedula: str
    telefono: str
    monto: float

async def run_test_pago_movil_and_close(cedula, telefono, monto, banco, beneficiario):
    await ejecutar_pago_banesco(cedula, telefono, telefono, monto, banco_destino=banco, nombre_beneficiario=beneficiario, is_test=True)
    
    await asyncio.sleep(5)
    # Could optionally close sessions here if needed, but test logic can just let it idle or we can add a specific close

@app.post("/api/engine/test-pago-movil")
async def test_pago_movil(req: TestPagoMovilRequest):
    asyncio.create_task(run_test_pago_movil_and_close(req.cedula, req.telefono, req.monto, req.banco, req.beneficiario))
    return {"ok": True, "message": "Prueba RPA Pago Móvil iniciada."}

class TestMultipleRpaRequest(BaseModel):
    monto: float

@app.post("/api/engine/test-multiple-rpa")
async def api_test_multiple_rpa(req: TestMultipleRpaRequest):
    # Cuenta test por defecto
    cedula_test = "21130158"
    cuenta_test = "01340330993301045172"
    
    from banesco_rpa import cargar_cuentas_banesco
    cuentas = cargar_cuentas_banesco()
    
    if len(cuentas) < 2:
        return {"ok": False, "error": f"Se necesitan al menos 2 cuentas Banesco configuradas para la prueba concurrente. Tienes {len(cuentas)}."}
        
    print(f"[API] Iniciando prueba MÚLTIPLE con {len(cuentas)} cuentas simultáneas...")
    
    # Lanzar 2 tareas concurrentes forzando las dos primeras cuentas Banesco
    asyncio.create_task(run_test_and_close(cedula_test, cuenta_test, req.monto, cuentas[0]))
    asyncio.create_task(run_test_and_close(cedula_test, cuenta_test, req.monto, cuentas[1]))
    
    return {"ok": True, "message": f"Prueba de 2 pagos simultáneos de {req.monto} VES iniciada usando {cuentas[0]['user']} y {cuentas[1]['user']}."}

@app.post("/api/engine/start")
def start_engine():
    engine_state["is_running"] = True
    return {"ok": True, "message": "Motor iniciado"}

@app.post("/api/engine/stop")
def stop_engine():
    engine_state["is_running"] = False
    return {"ok": True, "message": "Motor detenido"}

from banesco_rpa import get_all_configured_accounts, get_accounts_state, save_accounts_state

@app.get("/api/engine/accounts")
def api_get_accounts():
    todas = get_all_configured_accounts()
    estado = get_accounts_state()
    
    result = []
    for cuenta in todas:
        user = cuenta["user"]
        val = estado.get(user, True)
        if isinstance(val, bool):
            is_enabled = val
            min_val = 0
            max_val = 9999999
        else:
            is_enabled = val.get("enabled", True)
            min_val = val.get("min", 0)
            max_val = val.get("max", 9999999)
            
        result.append({
            "username": user,
            "enabled": is_enabled,
            "min": min_val,
            "max": max_val
        })
    return {"ok": True, "accounts": result}

class AccountConfigRequest(BaseModel):
    username: str
    enabled: bool
    min: float
    max: float

@app.post("/api/engine/accounts/config")
def api_config_account(req: AccountConfigRequest):
    estado = get_accounts_state()
    estado[req.username] = {
        "enabled": req.enabled,
        "min": req.min,
        "max": req.max
    }
    save_accounts_state(estado)
    return {"ok": True, "message": f"Configuración guardada para {req.username}."}

class PaymentRequest(BaseModel):
    order_id: str
    cedula: str
    telefono: str
    cuenta: str
    monto_ves: float

@app.post("/api/pay")
def pay_order(req: PaymentRequest):
    return {"ok": False, "error": "Deprecated. Use UI directly or orchestrator."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
