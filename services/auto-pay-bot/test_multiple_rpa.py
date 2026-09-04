import asyncio
import time
from dotenv import load_dotenv
load_dotenv('.env') # Cargar .env falso local
from banesco_rpa import ejecutar_pago_banesco

# Definimos las 4 ordenes simultáneas
pagos_a_procesar = [
    {"id": "ORDEN_1", "cuenta": "01340352043521032811", "cedula": "V30240673", "monto": 500.00},
    {"id": "ORDEN_2", "cuenta": "01340352043521032811", "cedula": "V30240673", "monto": 850.00},
    {"id": "ORDEN_3", "cuenta": "01340206082061031805", "cedula": "V22030800", "monto": 1200.00},
    {"id": "ORDEN_4", "cuenta": "01340206082061031805", "cedula": "V22030800", "monto": 1000.00},
]

async def simular_orden(orden):
    print(f"\n[ORQUESTADOR] 🚨 Ha llegado la orden simulada {orden['id']} por {orden['monto']} VES")
    # Pasamos un numero generico
    telefono_generico = "04140000000"
    
    inicio = time.time()
    
    # Esto es exactamente lo que hace el orchestrator.py
    success = await ejecutar_pago_banesco(
        cedula_destino=orden["cedula"], 
        telefono_destino=telefono_generico, 
        cuenta_destino=orden["cuenta"], 
        monto_ves=orden["monto"]
    )
    
    fin = time.time()
    duracion = fin - inicio
    
    if success:
        print(f"\n[ORQUESTADOR] ✅ {orden['id']} completada con exito en {duracion:.2f} segundos!")
        print(f"[ORQUESTADOR] Simulando subida de debug_recibo.png al servidor Next.js...")
        # Aca el orquestador subiria el comprobante y marcaria como pagado en binance
    else:
        print(f"\n[ORQUESTADOR] ❌ {orden['id']} fallo. Abortando subir comprobante.")


async def main():
    print("=== INICIANDO PRUEBA DE ESTRÉS DE ALTA FRECUENCIA ===")
    print("Vamos a disparar 4 operaciones P2P *exactamente al mismo tiempo*")
    print("para validar el candado (Lock) y el reuso de la sesión.\n")
    
    # Creamos las tareas para dispararlas simultaneamente
    tareas = []
    for pago in pagos_a_procesar:
        tareas.append(asyncio.create_task(simular_orden(pago)))
        
    # Las ejecutamos todas de golpe (Simulando 4 usuarios comprando a la vez)
    await asyncio.gather(*tareas)
    
    print("\n[TEST] Cola de prueba vacía. Cerrando sesión...")
    from banesco_rpa import cerrar_sesion_banesco
    await cerrar_sesion_banesco()
    
    print("\n=== PRUEBA MULTIPLE FINALIZADA ===")

if __name__ == "__main__":
    asyncio.run(main())
