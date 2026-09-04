/**
 * Demo Data — JarvisP2P
 * ─────────────────────
 * Dummy data in the exact format used by the admin-dashboard.
 * Used when NEXT_PUBLIC_DEMO_MODE=true to replace real API calls.
 */

const now = new Date();
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000).toISOString();

// ── Orders (same format as /api/bybit/orders and /api/binance/orders) ──
export const demoOrders = [
  {
    bybitOrderId: 'BY-93847261',
    exchange: 'bybit',
    side: 'SELL',
    statusRaw: '10',        // Bybit: 10=buyer_not_paid (pending)
    quantity: '150.00',
    price: '37,500.00',
    amount: '5,625,000.00',
    fiat: 'VES',
    paymentMethod: 'Banesco',
    counterparty: 'crypto_king_vzla',
    createdAt: minutesAgo(3),
    assignedUser: null,
  },
  {
    bybitOrderId: 'BY-93847260',
    exchange: 'bybit',
    side: 'SELL',
    statusRaw: '20',        // Bybit: 20=buyer_paid
    quantity: '300.00',
    price: '37,400.00',
    amount: '11,220,000.00',
    fiat: 'VES',
    paymentMethod: 'Mercantil',
    counterparty: 'usdt_master_co',
    createdAt: minutesAgo(8),
    assignedUser: { alias: 'Carlos R.', operatorId: 'op-1' },
  },
  {
    binanceOrderId: 'BN-20240613001',
    exchange: 'binance',
    side: 'BUY',
    statusRaw: 'COMPLETED',
    quantity: '500.00',
    price: '37,250.00',
    amount: '18,625,000.00',
    fiat: 'VES',
    paymentMethod: 'Banesco',
    counterparty: 'p2p_venezuela_24h',
    createdAt: minutesAgo(25),
    assignedUser: { alias: 'Ana M.', operatorId: 'op-2' },
  },
  {
    bybitOrderId: 'BY-93847258',
    exchange: 'bybit',
    side: 'SELL',
    statusRaw: '10',
    quantity: '200.00',
    price: '37,500.00',
    amount: '7,500,000.00',
    fiat: 'VES',
    paymentMethod: 'Pago Móvil',
    counterparty: 'btc_angel',
    createdAt: minutesAgo(5),
    assignedUser: { alias: 'Luis P.', operatorId: 'op-3' },
  },
  {
    binanceOrderId: 'BN-20240613002',
    exchange: 'binance',
    side: 'SELL',
    statusRaw: 'BUYER_PAYED',
    quantity: '100.00',
    price: '37,400.00',
    amount: '3,740,000.00',
    fiat: 'VES',
    paymentMethod: 'Provincial',
    counterparty: 'fast_trade_cr',
    createdAt: minutesAgo(12),
    assignedUser: null,
  },
  {
    binanceOrderId: 'BN-20240613003',
    exchange: 'binance',
    side: 'BUY',
    statusRaw: 'CANCELLED',
    quantity: '75.00',
    price: '37,375.00',
    amount: '2,803,125.00',
    fiat: 'VES',
    paymentMethod: 'Banesco',
    counterparty: 'noob_trader_01',
    createdAt: minutesAgo(40),
    assignedUser: { alias: 'Carlos R.', operatorId: 'op-1' },
  },
  {
    bybitOrderId: 'BY-93847255',
    exchange: 'bybit',
    side: 'SELL',
    statusRaw: '30',        // Bybit: 30=completed
    quantity: '1000.00',
    price: '37,400.00',
    amount: '37,400,000.00',
    fiat: 'VES',
    paymentMethod: 'Mercantil',
    counterparty: 'otc_desk_arg',
    createdAt: minutesAgo(55),
    assignedUser: { alias: 'Ana M.', operatorId: 'op-2' },
  },
  {
    binanceOrderId: 'BN-20240613004',
    exchange: 'binance',
    side: 'SELL',
    statusRaw: 'TRADING',
    quantity: '250.00',
    price: '37,400.00',
    amount: '9,350,000.00',
    fiat: 'VES',
    paymentMethod: 'Banesco',
    counterparty: 'cambio_seguro',
    createdAt: minutesAgo(2),
    assignedUser: null,
  },
  {
    bybitOrderId: 'BY-93847253',
    exchange: 'bybit',
    side: 'BUY',
    statusRaw: '10',
    quantity: '180.00',
    price: '37,250.00',
    amount: '6,705,000.00',
    fiat: 'VES',
    paymentMethod: 'Pago Móvil',
    counterparty: 'crypto_vzla_24',
    createdAt: minutesAgo(1),
    assignedUser: null,
  },
  {
    binanceOrderId: 'BN-20240613005',
    exchange: 'binance',
    side: 'SELL',
    statusRaw: 'COMPLETED',
    quantity: '420.00',
    price: '37,400.00',
    amount: '15,708,000.00',
    fiat: 'VES',
    paymentMethod: 'BOD',
    counterparty: 'mega_exchange',
    createdAt: minutesAgo(120),
    assignedUser: { alias: 'Carlos R.', operatorId: 'op-1' },
  },
];

// ── Operators ──
export const demoOperators = [
  { alias: 'Carlos R.', operatorId: 'op-1', status: 'ACTIVE', ordersToday: 12, avgTime: 45 },
  { alias: 'Ana M.',    operatorId: 'op-2', status: 'ACTIVE', ordersToday: 8,  avgTime: 32 },
  { alias: 'Luis P.',   operatorId: 'op-3', status: 'ACTIVE', ordersToday: 15, avgTime: 55 },
  { alias: 'María G.',  operatorId: 'op-4', status: 'OFFLINE', ordersToday: 0,  avgTime: 0  },
];

// ── Market Data (same format as bybitMarketUpdate socket event) ──
export const demoMarketData: Record<string, any> = {
  Banesco: {
    bank: 'Banesco',
    top_strategies: [
      {
        strategy_id: 'beat_top1_banesco',
        label: '🥇 Superar al Top 1',
        position: 1,
        our_sell_price: 37500,
        our_buy_price: 37250,
        sell_tier_ves: 5625000,
        buy_tier_ves: 5587500,
        spread_pct: 0.67,
        spread_net_pct: 0.52,
        top_competitor: { nickname: 'fast_trade_vzla', price: 37520 },
      },
      {
        strategy_id: 'match_top3_banesco',
        label: '🥉 Igualar Top 3',
        position: 3,
        our_sell_price: 37480,
        our_buy_price: 37280,
        sell_tier_ves: 5622000,
        buy_tier_ves: 5592000,
        spread_pct: 0.54,
        spread_net_pct: 0.39,
        top_competitor: { nickname: 'cripto_express', price: 37500 },
      },
    ],
    competitors: [
      { nickname: 'fast_trade_vzla', price: 37520, orders: 1245, rate: 97.3 },
      { nickname: 'cripto_express',  price: 37500, orders: 892,  rate: 98.1 },
      { nickname: 'cambio_rapido',   price: 37480, orders: 567,  rate: 96.5 },
      { nickname: 'usdt_venezuela',  price: 37450, orders: 2103, rate: 99.0 },
      { nickname: 'mega_p2p',        price: 37420, orders: 334,  rate: 95.8 },
    ],
    timestamp: new Date().toISOString(),
  },
  Mercantil: {
    bank: 'Mercantil',
    top_strategies: [
      {
        strategy_id: 'beat_top1_mercantil',
        label: '🥇 Superar al Top 1',
        position: 1,
        our_sell_price: 37480,
        our_buy_price: 37230,
        sell_tier_ves: 5622000,
        buy_tier_ves: 5584500,
        spread_pct: 0.67,
        spread_net_pct: 0.48,
        top_competitor: { nickname: 'trading_pro_24', price: 37500 },
      },
    ],
    competitors: [
      { nickname: 'trading_pro_24', price: 37500, orders: 1678, rate: 97.7 },
      { nickname: 'bolivar_digital', price: 37480, orders: 445,  rate: 94.2 },
      { nickname: 'remesas_ya',     price: 37440, orders: 890,  rate: 96.1 },
    ],
    timestamp: new Date().toISOString(),
  },
};

// ── Ad Updates (same format as adUpdate socket event) ──
export const demoAdUpdates: Record<string, any> = {
  'ad-sell-banesco': { adId: 'ad-sell-banesco', adType: 'SELL', price: '37,500.00', exchange: 'bybit', bank: 'Banesco', success: true, timestamp: minutesAgo(0.5) },
  'ad-buy-banesco':  { adId: 'ad-buy-banesco',  adType: 'BUY',  price: '37,250.00', exchange: 'bybit', bank: 'Banesco', success: true, timestamp: minutesAgo(0.3) },
  'ad-sell-mercantil': { adId: 'ad-sell-mercantil', adType: 'SELL', price: '37,480.00', exchange: 'binance', bank: 'Mercantil', success: true, timestamp: minutesAgo(1) },
};

// ── Autopay Demo Data ──
export const demoAutopayAccounts = [
  { username: 'banesco_main', enabled: true, min: 100000, max: 50000000 },
  { username: 'mercantil_ops', enabled: true, min: 500000, max: 30000000 },
  { username: 'provincial_02', enabled: false, min: 200000, max: 20000000 },
];

export const demoAutopayOrders = [
  {
    bybitOrderId: 'BY-93847260',
    exchange: 'bybit',
    side: 'SELL',
    statusRaw: '20',
    quantity: '300.00',
    price: '37,400.00',
    amount: '11,220,000.00',
    paymentMethod: 'Mercantil',
    counterparty: 'usdt_master_co',
    createdAt: minutesAgo(8),
    assignedUser: { alias: 'BOT', operatorId: 'BOT' },
    autopayStatus: 'Pago detectado — Liberando cripto...',
  },
  {
    binanceOrderId: 'BN-20240613002',
    exchange: 'binance',
    side: 'SELL',
    statusRaw: 'BUYER_PAYED',
    quantity: '100.00',
    price: '37,400.00',
    amount: '3,740,000.00',
    paymentMethod: 'Provincial',
    counterparty: 'fast_trade_cr',
    createdAt: minutesAgo(12),
    assignedUser: { alias: 'BOT', operatorId: 'BOT' },
    autopayStatus: 'Esperando pago bancario...',
  },
];

// ── Radar Demo Configs ──
export const demoRadarConfigs = [
  {
    id: 'radar-1',
    exchange: 'bybit' as const,
    bank: '137',
    bankLabel: 'Banesco (137)',
    capitalUsdt: 1000,
    spreadPct: 1.5,
    sellAdId: 'BYBIT-SELL-001',
    buyAdId: 'BYBIT-BUY-001',
    pricingMode: 'agresivo' as const,
    enabled: true,
    createdAt: minutesAgo(1440),
  },
  {
    id: 'radar-2',
    exchange: 'binance' as const,
    bank: 'Banesco',
    bankLabel: 'Banesco',
    capitalUsdt: 2000,
    spreadPct: 1.0,
    sellAdId: 'BINANCE-SELL-001',
    buyAdId: 'BINANCE-BUY-001',
    pricingMode: 'neutro' as const,
    enabled: true,
    createdAt: minutesAgo(2880),
  },
];
