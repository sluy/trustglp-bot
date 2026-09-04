const BINANCE_P2P_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

function getBankPaymentCode(bankFilter) {
  const b = bankFilter.toLowerCase();
  if (b.includes('mercantil')) return "Mercantil";
  if (b.includes('pagomovil') || b.includes('pago movil')) return "PagoMovil";
  if (b.includes('provincial') || b.includes('bbva')) return "Provincial";
  if (b.includes('venezuela') || b.includes('bdv')) return "BancodeVenezuela";
  if (b.includes('bancamiga')) return "Bancamiga";
  return "Banesco";
}

async function fetchBinanceAds(tradeType, amount, bank) {
  const payload = {
    fiat: "VES", page: 1, rows: 100, tradeType, asset: "USDT", countries: [],
    proMerchantAds: false, shieldMerchantAds: false, publisherType: null,
    payTypes: bank ? [getBankPaymentCode(bank)] : [],
    classifies: ["mass", "profession", "user"]
  };
  if (amount) payload.transAmount = amount;

  const res = await fetch(BINANCE_P2P_URL, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.code === "000000" && data.data) ? data.data : [];
}

function filterByBank(items, bankFilter) {
  const expectedBank = getBankPaymentCode(bankFilter);
  const ourMerchantName = "telecambios-ve";
  return items.filter(item => {
    const adv = item.adv;
    const advertiser = item.advertiser;
    const merchantName = (advertiser.nickName || "").toLowerCase();
    if (merchantName.includes(ourMerchantName)) return false;
    return adv.tradeMethods && adv.tradeMethods.some(m => m.identifier === expectedBank);
  }).map(item => ({
    price: parseFloat(item.adv.price),
    merchant_name: item.advertiser.nickName,
    success_rate: parseFloat(item.advertiser.monthFinishRate || "0") * 100,
    min_limit: parseFloat(item.adv.minSingleTransAmount || "0"),
    max_limit: parseFloat(item.adv.maxSingleTransAmount || "0")
  }));
}

function getAntiSpoofedPrice(matchingAds, fallbackPrice) {
  if (matchingAds.length === 0) return fallbackPrice;
  if (matchingAds.length === 1) return matchingAds[0].price;
  const top1 = matchingAds[0];
  const top2 = matchingAds[1];
  const diffPct = Math.abs((top1.price - top2.price) / top2.price);
  if (diffPct > 0.0015) return top2.price;
  return top1.price;
}

async function POST(bank, capital = 1000, spread = 0.1) {
    const allSellAdsRaw = await fetchBinanceAds("SELL", undefined, bank);
    const filteredSellAds = filterByBank(allSellAdsRaw, bank);
    if (filteredSellAds.length === 0) return { status: 404, error: "No ads found for reference rate" };

    const referencePrice = filteredSellAds[0].price;
    const sellLimitFiat = (capital * referencePrice).toString();
    const specificSellAdsRaw = await fetchBinanceAds("SELL", sellLimitFiat, bank);
    const specificSellAds = filterByBank(specificSellAdsRaw, bank);
    const topSellPrice = specificSellAds.length > 0 ? specificSellAds[0].price : referencePrice;

    const allBuyAdsRaw = await fetchBinanceAds("BUY", undefined, bank);
    const filteredBuyAds = filterByBank(allBuyAdsRaw, bank);

    const fiatLimits = [100000, 50000, 25000];
    const top_strategies = [];
    let bestOverallSell = referencePrice;
    let bestOverallBuy = referencePrice;

    for (let i = 0; i < fiatLimits.length; i++) {
      const limitVes = fiatLimits[i];
      const capitalVes = capital * referencePrice;
      const matchingSellAds = filteredSellAds.filter(ad => capitalVes >= ad.min_limit && capitalVes <= ad.max_limit);
      const baseSellPrice = getAntiSpoofedPrice(matchingSellAds, referencePrice);
      const sellPriceForLimit = Number((baseSellPrice - 0.1).toFixed(2));

      const matchingBuyAds = filteredBuyAds.filter(ad => limitVes >= ad.min_limit && limitVes <= ad.max_limit);
      const baseBuyPrice = getAntiSpoofedPrice(matchingBuyAds, referencePrice);
      const buyPriceForLimit = Number((baseBuyPrice + 0.1).toFixed(2));

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
      
    top_strategies.sort((a, b) => b.spread_net_pct - a.spread_net_pct);
    top_strategies.forEach((strat, idx) => strat.strategy_id = (idx + 1).toString());
    if (top_strategies.length > 0) {
      bestOverallSell = top_strategies[0].our_sell_price;
      bestOverallBuy = top_strategies[0].our_buy_price;
    }
    const spreadBruto = ((bestOverallSell - bestOverallBuy) / bestOverallBuy) * 100;

    return {
      status: 200,
      data: {
        bank, sell_tier_ves: bestOverallSell, buy_tier_ves: bestOverallBuy,
        spread_gross_pct: spreadBruto, limits: fiatLimits,
        reference_price: referencePrice, timestamp: Date.now(),
        top_strategies
      }
    };
}

POST('Banesco').then(res => console.log(JSON.stringify(res, null, 2))).catch(console.error);
