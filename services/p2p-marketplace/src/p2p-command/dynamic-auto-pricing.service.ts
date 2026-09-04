import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { BybitP2PService } from './bybit-p2p.service';

@Injectable()
export class DynamicAutoPricingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DynamicAutoPricingService.name);
  private subscriber: Redis;
  private redisReader: Redis;
  private readonly BYBIT_CHANNEL_NAME = 'market_updates:bybit_usdt_ves';

  constructor(
    private readonly bybitP2PService: BybitP2PService,
    private configService: ConfigService
  ) {
    this.subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.redisReader = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  onModuleInit() {
    this.subscriber.subscribe(this.BYBIT_CHANNEL_NAME, (err, count) => {
      if (err) {
        this.logger.error(`Error subscribing to Redis channel: ${err.message}`);
      } else {
        this.logger.log(`Subscribed to P2P Marketplace Auto-Pricing Engine. (${count} channels)`);
      }
    });

    this.subscriber.on('message', (channel, message) => {
      if (channel === this.BYBIT_CHANNEL_NAME) {
        this.handleBybitMarketUpdate(JSON.parse(message));
      }
    });
  }

  onModuleDestroy() {
    this.subscriber.quit();
    this.redisReader.quit();
  }

  private lastPrices: Record<string, string> = {};
  private lastUpdateTimes: Record<string, number> = {};

  private async handleBybitMarketUpdate(payload: any) {
    if (!payload?.top_strategies) return;
    const { top_strategies, bank } = payload;

    if (bank === 'Banesco') {
        // --- BANESCO AUTO-PRICING ---
        const activeStrategyStr = await this.redisReader.get('bybit_active_strategy_banesco');
        if (activeStrategyStr && top_strategies.length > 0) {
           const activeStr = JSON.parse(activeStrategyStr);
           const matchingStrategy = top_strategies.find((s: any) => s.strategy_id === activeStr.strategy_id);

           if (matchingStrategy) {
              const sellIdsRaw = this.configService.get<string>('BYBIT_MAKER_SELL_AD_ID') || '';
              const buyIdsRaw  = this.configService.get<string>('BYBIT_MAKER_BUY_AD_ID')  || '';
              const sellIds = sellIdsRaw.split(',').map(id => id.trim()).filter(Boolean);
              const buyIds  = buyIdsRaw.split(',').map(id => id.trim()).filter(Boolean);

              this.logger.log(`[BANESCO PRICER] Evaluando... Sell Target: ${matchingStrategy.our_sell_price.toFixed(2)} (${sellIds.length} ads), Buy Target: ${matchingStrategy.our_buy_price.toFixed(2)} (${buyIds.length} ads)`);
              
              for (const id of sellIds) await this.processAdUpdate(id, matchingStrategy.our_sell_price.toFixed(2), 'Banesco');
              for (const id of buyIds)  await this.processAdUpdate(id, matchingStrategy.our_buy_price.toFixed(2), 'Banesco');
           }
        }
    } else if (bank === 'Mercantil') {
        // --- MERCANTIL AUTO-PRICING (BUY ONLY) ---
        const activeStrategyStr = await this.redisReader.get('bybit_active_strategy_mercantil');
        if (activeStrategyStr && top_strategies.length > 0) {
           const activeStr = JSON.parse(activeStrategyStr);
           const matchingStrategy = top_strategies.find((s: any) => s.strategy_id === activeStr.strategy_id);

           if (matchingStrategy) {
              // Solo actualizamos los Ads de Compra Maker para Mercantil
              const buyIdsRaw = this.configService.get<string>('BYBIT_MAKER_BUY_AD_ID_MERCANTIL') || '';
              const buyIds = buyIdsRaw.split(',').map(id => id.trim()).filter(Boolean);

              this.logger.log(`[MERCANTIL PRICER] Evaluando (Buy Only)... Buy Target: ${matchingStrategy.our_buy_price.toFixed(2)} (${buyIds.length} ads)`);
              
              if (!buyIds.length) {
                  this.logger.error(`❌ CRITICAL: Falta BYBIT_MAKER_BUY_AD_ID_MERCANTIL en las variables de entorno. No se puede ejecutar Auto-Pricing para Mercantil.`);
              } else {
                  for (const id of buyIds) await this.processAdUpdate(id, matchingStrategy.our_buy_price.toFixed(2), 'Mercantil');
              }
           }
        }
    } else if (bank === 'PagoMovil') {
        // --- PAGO MOVIL AUTO-PRICING (BUY ONLY) ---
        const activeStrategyStr = await this.redisReader.get('bybit_active_strategy_pagomovil');
        if (activeStrategyStr && top_strategies.length > 0) {
           const activeStr = JSON.parse(activeStrategyStr);
           const matchingStrategy = top_strategies.find((s: any) => s.strategy_id === activeStr.strategy_id);

           if (matchingStrategy) {
              // Solo actualizamos los Ads de Compra Maker para PagoMovil
              const buyIdsRaw = this.configService.get<string>('BYBIT_MAKER_BUY_AD_ID_PAGOMOVIL') || '';
              const buyIds = buyIdsRaw.split(',').map(id => id.trim()).filter(Boolean);

              this.logger.log(`[PAGOMOVIL PRICER] Evaluando (Buy Only)... Buy Target: ${matchingStrategy.our_buy_price.toFixed(2)} (${buyIds.length} ads)`);
              
              if (!buyIds.length) {
                  this.logger.error(`❌ CRITICAL: Falta BYBIT_MAKER_BUY_AD_ID_PAGOMOVIL en las variables de entorno. No se puede ejecutar Auto-Pricing para PagoMovil.`);
              } else {
                  for (const id of buyIds) await this.processAdUpdate(id, matchingStrategy.our_buy_price.toFixed(2), 'PagoMovil');
              }
           }
        }
    }
  }

  private async processAdUpdate(adId: string | undefined, newPrice: string, bank: string = 'Banesco') {
      if (!adId) return;

      // Anti-Spam: Solo enviar si el precio es distinto (asumiendo que fue exitoso)
      if (this.lastPrices[adId] === newPrice) {
          return; 
      }

      // Rate Limit: Max 10 requests / 5 mins (300s) = 1 req / 30s. Fijamos cooldown en 35s.
      const now = Date.now();
      const timeSinceLastUpdate = now - (this.lastUpdateTimes[adId] || 0);
      
      if (timeSinceLastUpdate < 35000) {
          this.logger.debug(`[Throttled] Omitiendo update a Bybit para Ad ${adId} (Cooldown de 35s activo)`);
          return;
      }

      this.lastUpdateTimes[adId] = now; // Guardar intento para evitar spam si falla cíclicamente
      
      const success = await this.bybitP2PService.updateAdPrice(adId, newPrice, bank);
      if (success) {
          this.lastPrices[adId] = newPrice;
      } else {
          // Si Bybit falló, borramos el cooldown de tiempo para que vuelva a intentar el reporte
          this.lastUpdateTimes[adId] = 0; 
      }
  }
}
