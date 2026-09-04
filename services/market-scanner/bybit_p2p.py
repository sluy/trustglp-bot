import httpx
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

BYBIT_P2P_URL = "https://api2.bybit.com/fiat/otc/item/online"

HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# TODO: Fill this once we discover Bybit's exact payment code for Banesco (VES)
# Common Bybit IDs: 585 = Banesco, usually. We will fetch and filter by name as fallback.
PAY_TYPES_VES = ["585", "Banesco"] 

async def fetch_bybit_p2p_ads(
    trade_type: str = "BUY", 
    asset: str = "USDT", 
    fiat: str = "VES", 
    rows: int = 20, 
    trans_amount: Optional[float] = None
) -> List[Dict[Any, Any]]:
    """
    Realiza una solicitud a la API pública de ByBit P2P para extraer anuncios de compra o venta.
    
    :param trade_type: "BUY" o "SELL". En Bybit: side="1" es BUY (el usuario quiere comprar USDT), side="0" es SELL.
    :param asset: Criptomoneda (Ej. USDT)
    :param fiat: Moneda fiduciaria (Ej. VES)
    :param rows: Cantidad de resultados tope a extraer.
    :param trans_amount: Monto fiat de la transacción (Ej. Bolivares).
    """

    # En Bybit API, 'side' se comporta así:
    # side: "1" = Anuncios de venta (ROJOS) -> Permiten al Taker COMPRAR.
    # side: "0" = Anuncios de compra (VERDES) -> Permiten al Taker VENDER.
    # Aligning with Binance logic: "BUY" means user buys (so side=1), "SELL" means user sells (so side=0).
    side = "1" if trade_type == "BUY" else "0"

    payload = {
        "tokenId": asset,
        "currencyId": fiat,
        # Dejamos payment vacío para que no falle si la API trata arrays múltiples como 'AND'. 
        "payment": [],  
        "side": side,
        # Aumentamos size a 100 para extraer TODOS los bancos y filtrar a Banesco localmente, sin perder posiciones.
        "size": "100",
        "page": "1",
        "authMaker": True,
        "canTrade": False
    }

    if trans_amount:
        payload["amount"] = str(int(trans_amount))

    async with httpx.AsyncClient() as client:
        try:
            logger.info(f"Bybit Payload {trade_type}: {payload}")
            response = await client.post(BYBIT_P2P_URL, headers=HEADERS, json=payload, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            items = data.get("result", {}).get("items", [])
            logger.info(f"Bybit API {trade_type} returned {len(items)} items. ret_code: {data.get('ret_code')}, ret_msg: {data.get('ret_msg')}")
            
            if len(items) > 0:
                # Log first item exactly as it is for debugging purposes
                logger.info(f"First item payload ({trade_type}): {json.dumps(items[0])}")
            
            if str(data.get("ret_code")) == "0" and items:
                return items
            return []
        except Exception as e:
            logger.error(f"Error fetching Bybit P2P ads for {trade_type}: {e}")
            return []


def parse_bybit_ad_data(raw_data: List[Dict[Any, Any]], bank_filter: str = 'banesco') -> List[Dict[str, Any]]:
    """
    Simplifica y extrae solo la información crítica para el análisis estadístico,
    aplicando un filtro local robusto para el banco especificado (Banesco o Mercantil).
    """
    parsed = []
    
    import os
    our_merchant_name = os.getenv("BYBIT_MERCHANT_NAME", "telecambios-ve").strip().lower()
    
    for item in raw_data:
        payments = item.get("payments", [])
        merchant_name = str(item.get("nickName", "")).strip().lower()
        
        # Ignorarnos a nosotros mismos para no entrar en un bucle infinito de sobrepuja (+0.01)
        if our_merchant_name == merchant_name or merchant_name in ["telecambios-ve", "k. telecambios-ve"]:
            continue
            
        # Filtro estricto local según el banco objetivo:
        has_bank = False
        if bank_filter.lower() == 'mercantil':
            # 321 = Mercantil, 316 = Variante Mercantil (se remueve de Banesco)
            ALLOWED_PAYMENTS_MERCANTIL = ["321", "316"]
            has_bank = any(str(p).strip() in ALLOWED_PAYMENTS_MERCANTIL for p in payments)
        elif bank_filter.lower() == 'pagomovil':
            # 64 = Binance Pago Movil. Bybit utiliza otros IDs para Pago Movil (usualmente 377, 416 o 318 Mobile Payment).
            ALLOWED_PAYMENTS_PAGOMOVIL = ["64", "318", "377", "382", "416"]
            has_bank = any(str(p).strip() in ALLOWED_PAYMENTS_PAGOMOVIL for p in payments)
        else:
            # 14=Transfer, 585=Banesco. 130/137/253/318 son variantes modernas.
            ALLOWED_PAYMENTS_BANESCO = ["14", "585", "130", "137", "253", "318"]
            has_bank = any(str(p).strip() in ALLOWED_PAYMENTS_BANESCO for p in payments)
        
        if not has_bank and payments:
            continue
        
        parsed.append({
            "ad_id": item.get("id"),
            "price": float(item.get("price", 0)),
            "min_limit": float(item.get("minAmount", 0)),
            "max_limit": float(item.get("maxAmount", 0)),
            "available_asset": float(item.get("lastQuantity", 0)),
            "trade_methods": payments, # Es una lista de strings ['14', '64']
            "merchant_name": item.get("nickName"),
            "merchant_id": item.get("userId"),
            "success_rate": float(item.get("recentExecuteRate", 0)),
            "trade_type": "BUY" if str(item.get("side")) == "1" else "SELL"
        })
    return parsed
