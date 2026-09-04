import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function logDebug(msg: string) {
  try {
    fs.appendFileSync(path.join(process.cwd(), 'debug_binance_scan.txt'), new Date().toISOString() + ': ' + msg + '\n');
  } catch(e) {}
}

const BINANCE_P2P_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

function getBankPaymentCode(bankFilter: string): string {
  const b = bankFilter.toLowerCase();
  if (b.includes('mercantil')) {
    return "Mercantil";
  } else if (b.includes('pagomovil') || b.includes('pago movil')) {
    return "PagoMovil";
  } else if (b.includes('provincial') || b.includes('bbva')) {
    return "Provincial";
  } else if (b.includes('venezuela') || b.includes('bdv')) {
    return "BancodeVenezuela";
  } else if (b.includes('bancamiga')) {
    return "Bancamiga";
  } else {
    return "Banesco";
  }
}

async function fetchBinanceAds(tradeType: "BUY" | "SELL", amount?: string, bank?: string) {
  const payload: any = {
    fiat: "VES",
    page: 1,
    rows: 20,
    tradeType: tradeType,
    asset: "USDT",
    countries: [],
    proMerchantAds: false,
    shieldMerchantAds: false,
    publisherType: "merchant",
    payTypes: bank ? [getBankPaymentCode(bank)] : [],
    classifies: ["mass", "profession", "user"]
  };

  if (amount) {
    payload.transAmount = amount;
  }

  const res = await fetch(BINANCE_P2P_URL, {
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
  if (data.code === "000000" && data.data) {
    return data.data;
  }
  return [];
}

function filterByBank(items: any[], bankFilter: string) {
  const expectedBank = getBankPaymentCode(bankFilter);
  const ourMerchantName = "telecambios-ve"; // Reemplazar con el alias real en Binance si es diferente

  return items.filter(item => {
    const adv = item.adv;
    const advertiser = item.advertiser;
    const merchantName = (advertiser.nickName || "").toLowerCase();
    if (merchantName.includes(ourMerchantName)) return false;

    // Verificar si alguno de los métodos de pago incluye el banco esperado
    return adv.tradeMethods && adv.tradeMethods.some((m: any) => m.identifier === expectedBank);
  }).map(item => ({
    price: parseFloat(item.adv.price),
    merchant_name: item.advertiser.nickName,
    success_rate: parseFloat(item.advertiser.monthFinishRate || "0") * 100,
    min_limit: parseFloat(item.adv.minSingleTransAmount || "0"),
    max_limit: parseFloat(item.adv.maxSingleTransAmount || "0")
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
    logDebug("Scan POST started");
    const body = await request.json();
    logDebug("Body parsed: " + JSON.stringify(body));
    const { bank, capital = 1000, spread = 0.1, customLimits, pricingMode } = body;
    const priceOffset = pricingMode === 'neutro' ? 0.01 : 0.1;

    // 1. Tasa referencia (Nosotros compramos USDT -> Anuncios VENTA rojas -> tradeType = BUY en Binance API porque buscamos gente comprando crypto? No.
    // En Binance:
    // tradeType = "SELL" significa "I want to SELL USDT", so the ads shown are from people BUYING USDT with Fiat (Nuestros competidores en VENTA de USDT).
    // wait, if WE want to SELL USDT, we look at what others are buying for, so we look at "BUY" ads? 
    // In Bybit: side "1" (Sell) means ads from people selling USDT. We compete with them to SELL our USDT.
    // In Binance: tradeType="SELL" in search returns ads where advertisers are SELLING USDT. So we compete with them to SELL our USDT.
    // Let's use tradeType="SELL" for our Sell competitors, and tradeType="BUY" for our Buy competitors.
    
    // Competencia de VENTA (quién más vende USDT):
    // Usamos "BUY" para buscar a otros vendedores (que aparecen en la pestaña Buy de Binance)
    const allSellAdsRaw = await fetchBinanceAds("BUY", undefined, bank);
    const filteredSellAds = filterByBank(allSellAdsRaw, bank);
    
    logDebug("filteredSellAds length: " + filteredSellAds.length);
    if (filteredSellAds.length === 0) {
      logDebug("Error: No ads found for reference rate");
      return NextResponse.json({ error: "No ads found for reference rate" }, { status: 404 });
    }

    const referencePrice = filteredSellAds[0].price;

    // 2. Venta nuestra (Competencia con Anuncios VENTA rojas -> tradeType="BUY")
    const sellLimitFiat = (capital * referencePrice).toString();
    const specificSellAdsRaw = await fetchBinanceAds("BUY", sellLimitFiat, bank);
    const specificSellAds = filterByBank(specificSellAdsRaw, bank);
    logDebug("specificSellAds length: " + specificSellAds.length);
    const topSellPrice = specificSellAds.length > 0 ? specificSellAds[0].price : referencePrice;

    // Competencia de COMPRA (quién más compra USDT):
    // Se consultará dentro del loop para cada límite fiduciario.

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
      
      // Venta nuestra (Competencia con Anuncios VENTA rojas -> tradeType="BUY")
      // Siempre operamos el capital máximo (100% de la caja fuerte)
      const matchingSellAds = specificSellAds.filter(ad => capitalVes >= ad.min_limit && capitalVes <= ad.max_limit);
      const baseSellPrice = getAntiSpoofedPrice(matchingSellAds, referencePrice);
      const sellPriceForLimit = Number((baseSellPrice - priceOffset).toFixed(2));

      // Compra nuestra (Competencia con Anuncios COMPRA verdes -> tradeType="SELL")
      const specificBuyAdsRaw = await fetchBinanceAds("SELL", limitVes.toString(), bank);
      const specificBuyAds = filterByBank(specificBuyAdsRaw, bank);
      
      const matchingBuyAds = specificBuyAds.filter(ad => limitVes >= ad.min_limit && limitVes <= ad.max_limit);
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
    logDebug("Successfully computed top_strategies");

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
    logDebug("Caught Exception: " + error.message + "\n" + error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
