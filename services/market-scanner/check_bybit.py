import httpx
import asyncio
import json

async def check():
    url = "https://api2.bybit.com/fiat/otc/item/online"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
    }
    payload = {
        "tokenId": "USDT",
        "currencyId": "VES",
        "payment": [],  
        "side": "1",
        "size": "50",
        "page": "1",
        "authMaker": False,
        "canTrade": False
    }

    async with httpx.AsyncClient() as client:
        res = await client.post(url, headers=headers, json=payload)
        data = res.json()
        items = data.get("result", {}).get("items", [])
        
        print("Total items:", len(items))
        payments_seen = set()
        for item in items:
            for p in item.get('payments', []):
                payments_seen.add(p)
        
        print("Payments vistos:", payments_seen)
        # Mostrar detalles de cada pago distinto (si sabemos el mapeo)
        
        # Guardaremos el output del JSON
        with open("/tmp/bybit_ads.json", "w") as f:
            json.dump(items, f, indent=2)

if __name__ == "__main__":
    asyncio.run(check())
