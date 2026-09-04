import { NextResponse } from 'next/server';

const BYBIT_P2P_URL = "https://api2.bybit.com/fiat/otc/item/online";

function getBankPaymentCodes(bankFilter: string): string[] {
  const b = bankFilter.toLowerCase();
  if (b.includes('mercantil') || b === '316') {
    return ["316"]; // Mercantil
  } else if (b.includes('pagomovil') || b.includes('pago movil') || b === '130' || b === '318' || b === '64' || b === '377' || b === '382' || b === '416') {
    return ["130", "318", "64", "377", "382", "416"]; // Pago Movil
  } else if (b.includes('provincial') || b === '315') {
    return ["315"]; // Provincial
  } else if (b.includes('venezuela') || b.includes('bdv') || b === '317') {
    return ["317"]; // BDV
  } else if (b.includes('bancamiga') || b === '321') {
    return ["321"]; // Bancamiga
  } else {
    // Default Banesco is ONLY 137. We remove 130, 14, 253, 585 which correspond to other banks/methods.
    return ["137"];
  }
}

async function fetchBybitAds(side: string, amount?: string, bank?: string) {
  const payload: any = {
    tokenId: "USDT",
    currencyId: "VES",
    payment: bank ? getBankPaymentCodes(bank) : [],
    side: side,
    size: "100",
    page: "1",
    authMaker: true,
    canTrade: false
  };

  if (amount) {
    payload.amount = Math.floor(Number(amount)).toString();
  }

  const res = await fetch(BYBIT_P2P_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    body: JSON.stringify(payload),
    cache: 'no-store'
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  if (data.ret_code === 0 && data.result?.items) {
    return data.result.items;
  }
  return [];
}

function filterByBank(items: any[], bankFilter: string) {
  let allowedPayments: string[] = [];
  const b = bankFilter.toLowerCase();
  
  if (b.includes('mercantil') || b === '316') {
    allowedPayments = ["316"];
  } else if (b.includes('pagomovil') || b.includes('pago movil') || b === '130' || b === '318' || b === '64' || b === '377' || b === '382' || b === '416') {
    allowedPayments = ["130", "318", "64", "377", "382", "416"];
  } else if (b.includes('provincial') || b === '315') {
    allowedPayments = ["315"];
  } else if (b.includes('venezuela') || b.includes('bdv') || b === '317') {
    allowedPayments = ["317"];
  } else if (b.includes('bancamiga') || b === '321') {
    allowedPayments = ["321"];
  } else {
    // Default Banesco
    allowedPayments = ["137"];
  }

  const ourMerchantName = "telecambios-ve";

  return items.filter(item => {
    const merchantName = (item.nickName || "").toLowerCase();
    if (merchantName.includes(ourMerchantName)) return false;

    return item.payments && item.payments.some((p: any) => allowedPayments.includes(p.id || p));
  }).map(item => ({
    price: parseFloat(item.price),
    merchant_name: item.nickName,
    success_rate: parseFloat(item.recentExecuteRate || "0"),
    min_limit: parseFloat(item.minAmount || "0"),
    max_limit: parseFloat(item.maxAmount || "0")
  }));
}

function getAntiSpoofedPrice(matchingAds: any[], fallbackPrice: number): number {
  if (matchingAds.length === 0) return fallbackPrice;
  if (matchingAds.length === 1) return matchingAds[0].price;

  const top1 = matchingAds[0];
  const top2 = matchingAds[1];
  
  // Brecha porcentual absoluta
  const diffPct = Math.abs((top1.price - top2.price) / top2.price);
  const MANIPULATION_THRESHOLD_PCT = 0.0015; // 0.15%

  if (diffPct > MANIPULATION_THRESHOLD_PCT) {
    // Manipulación detectada. Anclamos al Top 2.
    return top2.price;
  }
  
  // Mercado sano, usamos Top 1
  return top1.price;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bank, capital = 1000, spread = 0.1, customLimits, pricingMode } = body;
    const priceOffset = pricingMode === 'neutro' ? 0.01 : 0.1;

    // 1. Tasa referencia (Nosotros compramos USDT -> Anuncios VENTA rojas -> side 1)
    const allSellAdsRaw = await fetchBybitAds("1", undefined, bank);
    const filteredSellAds = filterByBank(allSellAdsRaw, bank);
    
    if (filteredSellAds.length === 0) {
      return NextResponse.json({ error: "No ads found for reference rate" }, { status: 404 });
    }

    const referencePrice = filteredSellAds[0].price;

    // 2. Venta nuestra (Competencia con Anuncios VENTA rojas -> side 1)
    const sellLimitFiat = (capital * referencePrice).toString();
    const specificSellAdsRaw = await fetchBybitAds("1", sellLimitFiat, bank);
    const specificSellAds = filterByBank(specificSellAdsRaw, bank);
    const topSellPrice = specificSellAds.length > 0 ? specificSellAds[0].price : referencePrice;

    const allBuyAdsRaw = await fetchBybitAds("0", undefined, bank);
    const filteredBuyAds = filterByBank(allBuyAdsRaw, bank);

    // Nuevos limites fiduciarios exactos requeridos por el usuario
    let fiatLimits = [100000, 50000, 25000];
    if (customLimits && Array.isArray(customLimits) && customLimits.length > 0) {
      fiatLimits = customLimits;
    }
    const top_strategies = [];
    
    let bestOverallSell = referencePrice;
    let bestOverallBuy = referencePrice;

    for (let i = 0; i < fiatLimits.length; i++) {
      const limitVes = fiatLimits[i];
      
      const capitalVes = capital * referencePrice;
      
      // Venta nuestra (Competencia con Anuncios VENTA rojas -> side 1)
      // Siempre operamos el capital máximo (100% de la caja fuerte)
      const matchingSellAds = filteredSellAds.filter(ad => capitalVes >= ad.min_limit && capitalVes <= ad.max_limit);
      const baseSellPrice = getAntiSpoofedPrice(matchingSellAds, referencePrice);
      const sellPriceForLimit = Number((baseSellPrice - priceOffset).toFixed(2));

      // Compra nuestra (Competencia con Anuncios COMPRA verdes -> side 0)
      const matchingBuyAds = filteredBuyAds.filter(ad => limitVes >= ad.min_limit && limitVes <= ad.max_limit);
      const baseBuyPrice = getAntiSpoofedPrice(matchingBuyAds, referencePrice);
      const buyPriceForLimit = Number((baseBuyPrice + priceOffset).toFixed(2));

      const spreadNetPct = ((sellPriceForLimit - buyPriceForLimit) / buyPriceForLimit) * 100;

      top_strategies.push({
        strategy_id: (i + 1).toString(),
        sell_tier_ves: Math.floor(capitalVes),
        buy_tier_ves: limitVes,
        our_sell_price: sellPriceForLimit,
        our_buy_price: buyPriceForLimit,
        spread_net_pct: spreadNetPct
      });
    }
      
    // Ordenar las estrategias por spread_net_pct descendente (mayor rentabilidad primero)
    top_strategies.sort((a, b) => b.spread_net_pct - a.spread_net_pct);

    // Reasignar IDs para que la más rentable sea siempre la #1 (Óptima)
    top_strategies.forEach((strat, idx) => {
      strat.strategy_id = (idx + 1).toString();
    });

    // Actualizar bestOverall con la Óptima
    if (top_strategies.length > 0) {
      bestOverallSell = top_strategies[0].our_sell_price;
      bestOverallBuy = top_strategies[0].our_buy_price;
    }

    const spreadBruto = ((bestOverallSell - bestOverallBuy) / bestOverallBuy) * 100;

    return NextResponse.json({
      bank: bank,
      sell_tier_ves: bestOverallSell,
      buy_tier_ves: bestOverallBuy,
      spread_gross_pct: spreadBruto,
      limits: fiatLimits,
      reference_price: referencePrice,
      timestamp: Date.now(),
      top_strategies: top_strategies
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
