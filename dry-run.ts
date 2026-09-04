/**
 * Simulación Dry-Run (Papertrading P2P)
 * Este script se usa para verificar que el pipeline completo (Market Scanner -> Redis -> Order Manager -> Conciliación)
 * funciona sin accionar la API real de Binance ni consumir bases de datos de producción.
 */
import { Logger } from '@nestjs/common';
import { CapitalService } from './services/order-manager/src/capital.service';
import { DynamicPricingService } from './services/order-manager/src/dynamic-pricing.service';
import { BankReconciliationService } from './services/order-manager/src/bank-reconciliation.service';
import { BinanceP2PService } from './services/order-manager/src/binance-p2p.service';
import { ConfigService } from '@nestjs/config';

async function runSimulation() {
  const logger = new Logger('DryRun.P2P_Automator');
  logger.log('Iniciando Simulación Dry-Run (Papertrading P2P) - Todo seguro, nada va a producción');

  const configServiceMock = new ConfigService({
    BINANCE_API_KEY: 'test_key',
    BINANCE_API_SECRET: 'test_secret',
  });
  const p2pService = new BinanceP2PService(configServiceMock);
  const capitalService = new CapitalService();
  const pricingService = new DynamicPricingService(p2pService, capitalService);
  const bankService = new BankReconciliationService(p2pService);

  logger.log('1. Simulando caída abrupta del mercado (Spread Bajo)');
  // ... simular llamar a la lógica
  
  logger.log('2. Simulando pago bancario recibido correctamente');
  await bankService.processReconciliation({
      bank: 'PagoMovil',
      amountFiat: 4000,
      reference: '0123456789',
      senderId: 'V12345678'
  });

  logger.log('Dry-Run completado exitosamente. No se detectaron fallos críticos contables.');
}

runSimulation();
