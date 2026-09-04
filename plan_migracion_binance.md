# Plan de Migración: Lógica de Auto-Pricing (Bybit -> Binance)

## Objetivo
Actualizar el sistema de auto-pricing de Binance (`dynamic-pricing.service.ts` en `order-manager`) para que tenga el mismo nivel tecnológico, protecciones y capacidades que el servicio homólogo de Bybit (`dynamic-auto-pricing.service.ts` en `p2p-marketplace`).

## Contexto Actual
- **Bybit (El Cerebro):** Soporta múltiples bancos (Banesco, Mercantil, PagoMovil), lee la "estrategia activa" seleccionada por el usuario desde Redis, extrae los precios exactos calculados por Python (`our_sell_price`, `our_buy_price`), y tiene protección anti-spam y rate-limiting (35s de cooldown) para evitar bloqueos de API.
- **Binance (Básico):** Solo soporta Banesco (hardcodeado), calcula el precio "a lo bruto" restando 0.01 al precio de mercado sin tomar en cuenta las estrategias avanzadas, y carece de protecciones contra rate-limit.

## Acciones a Realizar

### 1. Refactorización de `services/order-manager/src/dynamic-pricing.service.ts`
Se debe reescribir la lógica de `handleMarketUpdate(payload: any)` para que funcione de la siguiente manera:
- Identificar el `bank` proveniente del payload de Python.
- Soportar flujos separados para `Banesco`, `Mercantil` y `PagoMovil`.
- Leer desde Redis las estrategias seleccionadas en el frontend (ej. `binance_active_strategy_banesco`).
- Extraer los objetivos de precio (`our_sell_price` y `our_buy_price`) directamente del array `payload.top_strategies` que envía el scanner.

### 2. Implementar Función de Ejecución Segura (`processAdUpdate`)
Crear una réplica del método `processAdUpdate` de Bybit para Binance que incluya:
- **Anti-Spam:** `if (lastPrices[adId] === newPrice) return;`
- **Rate Limiting:** Cooldown estricto de 35 segundos entre actualizaciones del mismo anuncio para proteger la API Key de Binance.

### 3. Actualizar Variables de Entorno (`.env`)
Se requerirá que la plataforma en Easypanel (y el entorno local) configure las siguientes variables para identificar los anuncios P2P de Binance que el bot debe manipular:
- `BINANCE_MAKER_SELL_AD_ID` (Banesco)
- `BINANCE_MAKER_BUY_AD_ID` (Banesco)
- `BINANCE_MAKER_BUY_AD_ID_MERCANTIL`
- `BINANCE_MAKER_BUY_AD_ID_PAGOMOVIL`

## ⚠️ Dependencia Crítica (Para revisar antes de iniciar)
Antes de programar el servicio en TypeScript, se debe verificar el script de Python escaneador de Binance (`services/market-scanner/binance_p2p.py`). Hay que asegurar que dicho script ya esté calculando y enviando el array `top_strategies` en su payload hacia Redis, exactamente igual a como lo hace `bybit_p2p.py`. Si no lo hace, habrá que actualizar el Python primero.
