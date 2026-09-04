import httpx
import json
from typing import Dict, Any, List, Optional

BINANCE_P2P_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search"

HEADERS = {
    "Accept": "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "es-ES,es;q=0.9",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Content-Type": "application/json",
    "Host": "p2p.binance.com",
    "Origin": "https://p2p.binance.com",
    "Pragma": "no-cache",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

PAY_TYPES_VES = ["Banesco"] # Estrategia Operativa centrada únicamente en Banesco

async def fetch_p2p_ads(trade_type: str = "BUY", asset: str = "USDT", fiat: str = "VES", rows: int = 15, trans_amount: Optional[float] = None) -> List[Dict[Any, Any]]:
    """
    Realiza una solicitud a la API pública de Binance P2P para extraer anuncios de compra o venta.
    
    :param trade_type: "BUY" (Comprar USDT con VES) o "SELL" (Vender USDT por VES)
    :param asset: Criptomoneda (Ej. USDT)
    :param fiat: Moneda fiduciaria (Ej. VES)
    :param rows: Cantidad de resultados tope a extraer.
    :param trans_amount: Monto fiat de la transacción (Ej. Bolivares). Si se envía, Binance P2P omitirá los anuncios que no tengan esa liquidez mínima.
    :return: Lista de anuncios con precios y detalles.
    """
    payload = {
        "fiat": fiat,
        "page": 1,
        "rows": rows,
        "tradeType": trade_type,
        "asset": asset,
        "countries": [],
        "proMerchantAds": False,
        "shieldMerchantAds": False,
        "filterType": "all",
        "periods": [],
        "additionalKycVerifyFilter": 0,
        "publisherType": None,
        "payTypes": PAY_TYPES_VES if fiat == "VES" else [],
        "classifies": ["mass", "profession", "user"]
    }

    if trans_amount is not None:
        payload["transAmount"] = str(trans_amount)

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(BINANCE_P2P_URL, headers=HEADERS, json=payload, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            if data.get("code") == "000000" and data.get("data"):
                return data.get("data")
            return []
        except Exception as e:
            print(f"Error fetching P2P ads for {trade_type}: {e}")
            return []

def parse_ad_data(raw_data: List[Dict[Any, Any]]) -> List[Dict[str, Any]]:
    """
    Simplifica y extrae solo la información crítica que nos importa para el análisis estadístico.
    """
    parsed = []
    for entry in raw_data:
        adv = entry.get("adv", {})
        advertiser = entry.get("advertiser", {})
        
        parsed.append({
            "ad_id": adv.get("advNo"),
            "price": float(adv.get("price", 0)),
            "min_limit": float(adv.get("minSingleTransAmount", 0)),
            "max_limit": float(adv.get("maxSingleTransAmount", 0)),
            "available_asset": float(adv.get("surplusAmount", 0)),
            "trade_methods": [m.get("tradeMethodName") for m in adv.get("tradeMethods", [])],
            "merchant_name": advertiser.get("nickName"),
            "merchant_id": advertiser.get("userNo"),
            "success_rate": float(advertiser.get("monthOrderFinishRate", 0) * 100),
            "trade_type": adv.get("tradeType")
        })
    return parsed
