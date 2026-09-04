import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { BinanceP2PService } from './binance-p2p.service';
import { CapitalService } from './capital.service';
import { DashboardGateway } from './dashboard.gateway';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DynamicPricingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DynamicPricingService.name);
  private subscriber: Redis;
  private redisReader: Redis;
  private readonly CHANNEL_NAME = 'market_updates:usdt_ves';
  private readonly BYBIT_CHANNEL_NAME = 'market_updates:bybit_usdt_ves';

  // Margen de ganancia mínimo aceptable Maker
  private readonly MIN_PROFIT_MARGIN_PCT = 0.0; // Cambiado a 0.0% temporalmente para tests en vivo
  private readonly SPREAD_UNDERCUT = 0.01; // Bs (VES) para ponernos de primeros

  private readonly CAPITAL_BASE_USDT = 1000;
  private readonly STRATEGY_BANK = 'Banesco';

  constructor(
    private readonly p2pService: BinanceP2PService,
    private readonly capitalService: CapitalService,
    private readonly dashboardGateway: DashboardGateway,
    private configService: ConfigService
  ) {
    this.subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.redisReader = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  onModuleInit() {
    this.subscriber.subscribe(this.CHANNEL_NAME, this.BYBIT_CHANNEL_NAME, (err, count) => {
      if (err) {
        this.logger.error('Error suscribiéndose a Redis', err);
        return;
      }
      this.logger.log(`Suscrito a ${count} canal(es) de Redis. Escuchando ${this.CHANNEL_NAME} y ${this.BYBIT_CHANNEL_NAME}...`);
    });

    this.subscriber.on('message', (channel, message) => {
      if (channel === this.CHANNEL_NAME) {
        this.handleMarketUpdate(JSON.parse(message));
      } else if (channel === this.BYBIT_CHANNEL_NAME) {
        this.handleBybitMarketUpdate(JSON.parse(message));
      }
    });
  }

  onModuleDestroy() {
    this.subscriber.quit();
    this.redisReader.quit();
  }

  private async handleBybitMarketUpdate(payload: any) {
    const { asset, fiat, metrics, top_strategies } = payload;
    
    // El 'market-scanner' envió la rentabilidad actual MAKER para Bybit (Arreglos top_competitor_buy, etc):
    const rentabilidad = metrics.spread_pct;
    const bybitData = {
      bank: payload.bank, // ¡Se incluye el banco (Banesco/Mercantil) para que el frontend lo reconozca!
      spread: rentabilidad,
      spread_gross_pct: metrics.spread_gross_pct,
      topVentaBanesco: metrics.top_competitor_sell, // Venderíamos a (Nuestra Venta, Compradores Verdes)
      topCompraBanesco: metrics.top_competitor_buy, // Compraríamos a (Nuestra Compra, Vendedores Rojos)
      top_strategies: top_strategies,               // Estrategias multi-tier completas de Python
      competitivo: rentabilidad >= this.MIN_PROFIT_MARGIN_PCT
    };

    // Emitir telemetría de Bybit P2P Command Center
    this.dashboardGateway.emitBybitMarketUpdate(bybitData); // Pura emisión (El Bot de Execution ahora vive en p2p-marketplace)
  }

  private async handleMarketUpdate(payload: any) {
    const { asset, fiat, metrics } = payload;
    
    // El 'market-scanner' envió la rentabilidad actual MAKER:
    const rentabilidad = metrics.spread_pct;
    
    // Como Maker, nuestro precio para vender (alto) viene en top_competitor_sell, y para comprar (bajo) en top_competitor_buy
    const makerSellPrice = Number(metrics.top_competitor_sell); 
    const makerBuyPrice = Number(metrics.top_competitor_buy);

    this.logger.log(`[Estrategia Maker ${this.STRATEGY_BANK}] Capital: ${this.CAPITAL_BASE_USDT} USDT`);
    this.logger.log(`[Market Update] Spread Retorno: ${rentabilidad.toFixed(2)}% | Venderíamos a: ${makerSellPrice.toFixed(2)} | Compraríamos a: ${makerBuyPrice.toFixed(2)}`);

    // Emitir telemetría vía WebSocket al Dashboard en vivo
    this.dashboardGateway.emitMarketUpdate({
      spread: rentabilidad,
      spread_gross_pct: metrics.spread_gross_pct || (rentabilidad + 0.25),
      precioCompraMaker: makerBuyPrice,  // El precio bajo (al que le quitamos crypto a los vendedores)
      precioVentaMaker: makerSellPrice,   // El precio alto (al que le damos crypto a los compradores)
      volumen_usdt: this.CAPITAL_BASE_USDT,
      competitivo: rentabilidad >= this.MIN_PROFIT_MARGIN_PCT
    });

    if (rentabilidad < this.MIN_PROFIT_MARGIN_PCT) {
      this.logger.warn(`Retorno de la operación inferior al Target Maker (${rentabilidad.toFixed(2)}% < ${this.MIN_PROFIT_MARGIN_PCT}%). KillSwitch temporal sugerido.`);
      return;
    }

    // Calcular nuestro nuevo intento de precio agresivo para dominar Banesco:
    // Maker Sell (Vender nuestro USDT): Tenemos que ponernos un poco MÁS BARATOS que el comprador #1 (para que nos elijan a nosotros)
    // Maker Buy (Comprar USDT): Tenemos que ponernos un poco MÁS CAROS que el vendedor #1
    const targetMakerSellPrice = makerSellPrice - this.SPREAD_UNDERCUT;
    const targetMakerBuyPrice = makerBuyPrice + this.SPREAD_UNDERCUT;

    this.logger.log(`[Automated Execution] Retasando Anuncios | Target SELL: ${targetMakerSellPrice.toFixed(4)} | Target BUY: ${targetMakerBuyPrice.toFixed(4)}`);

    // Validar Capital Completo de la Estrategia Institucional
    const isSafeToSell = await this.capitalService.checkSufficientInventory(asset, this.CAPITAL_BASE_USDT); 
    
    if (isSafeToSell) {
       // Obtener Números de Anuncios P2P del .env (soporte multi-ID separado por comas)
       const sellIdsRaw = this.configService.get<string>('MAKER_SELL_AD_ID') || '';
       const buyIdsRaw  = this.configService.get<string>('MAKER_BUY_AD_ID')  || '';
       const sellIds = sellIdsRaw.split(',').map(id => id.trim()).filter(Boolean);
       const buyIds  = buyIdsRaw.split(',').map(id => id.trim()).filter(Boolean);

       if (sellIds.length) {
          for (const id of sellIds) {
            const ok = await this.p2pService.updateAdPrice(id, targetMakerSellPrice.toFixed(2).toString());
            this.dashboardGateway.emitAdUpdate({ adId: id, adType: 'SELL', price: targetMakerSellPrice.toFixed(2), exchange: 'Binance', bank: this.STRATEGY_BANK, success: ok, timestamp: new Date().toISOString() });
          }
       } else {
          this.logger.warn('MAKER_SELL_AD_ID no definido en las variables de entorno (.env). Omite actualización comercial.');
       }

       if (buyIds.length) {
          for (const id of buyIds) {
            const ok = await this.p2pService.updateAdPrice(id, targetMakerBuyPrice.toFixed(2).toString());
            this.dashboardGateway.emitAdUpdate({ adId: id, adType: 'BUY', price: targetMakerBuyPrice.toFixed(2), exchange: 'Binance', bank: this.STRATEGY_BANK, success: ok, timestamp: new Date().toISOString() });
          }
       } else {
          this.logger.warn('MAKER_BUY_AD_ID no definido en las variables de entorno (.env). Omite actualización comercial.');
       }
    }
  }
}
