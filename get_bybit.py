import asyncio
from httpx import AsyncClient

BYBIT_P2P_URL = 'https://api2.bybit.com/fiat/otc/item/online'
HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}
payload = {
    'tokenId': 'USDT',
    'currencyId': 'VES',
    'payment': [],  
    'side': '0',
    'size': '10',
    'page': '1',
    'authMaker': True,
    'canTrade': False,
    'amount': '80000'
}

async def fetch():
    async with AsyncClient() as client:
        resp = await client.post(BYBIT_P2P_URL, headers=HEADERS, json=payload)
        data = resp.json()
        for item in data['result']['items']:
            print(f"{item['nickName']}: price {item['price']}, payments {item['payments']}")

asyncio.run(fetch())
