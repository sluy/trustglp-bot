import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaClient } from '@prisma/client';

async function runMigrations() {
  const prisma = new PrismaClient();
  try {
    // Auto-migración: añade columnas BNB si no existen (seguro de re-ejecutar)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE p2p.community_user
        ADD COLUMN IF NOT EXISTS bnb_capital_allocated DECIMAL(18,8) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS bnb_offset DECIMAL(18,8) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS bnb_enabled BOOLEAN DEFAULT false
    `);
    console.log('✅ Migración BNB completada (o ya existía)');

    // ── Migración: Tesoro BTC (DCA Semanal + Earn) ──────────────────────────
    await prisma.$executeRawUnsafe(`
      ALTER TABLE p2p.community_user
        ADD COLUMN IF NOT EXISTS dca_enabled         BOOLEAN        DEFAULT false,
        ADD COLUMN IF NOT EXISTS dca_pct             DECIMAL(5,2)   DEFAULT 20.00,
        ADD COLUMN IF NOT EXISTS dca_pending_usdt    DECIMAL(18,8)  DEFAULT 0,
        ADD COLUMN IF NOT EXISTS dca_last_execution  TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS dca_btc_accumulated DECIMAL(18,8)  DEFAULT 0
    `);
    console.log('✅ Migración DCA Tesoro BTC completada (o ya existía)');

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS p2p.dca_purchase (
        id              SERIAL PRIMARY KEY,
        user_id         INT           NOT NULL,
        usdt_spent      DECIMAL(18,8) NOT NULL,
        btc_bought      DECIMAL(18,8) NOT NULL,
        btc_price       DECIMAL(18,2) NOT NULL,
        week_profit     DECIMAL(18,8) NOT NULL DEFAULT 0,
        earn_staked     BOOLEAN       DEFAULT false,
        executed_at     TIMESTAMPTZ   DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla dca_purchase creada (o ya existía)');

  } catch (e) {
    console.error('⚠️  Error en auto-migración:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function bootstrap() {
  await runMigrations();
  const app = await NestFactory.create(AppModule);
  // El Order Manager servirá endpoints internos para conectarse con la UI NextJS
  app.enableCors();
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Order Manager is running on: ${await app.getUrl()}`);
}
bootstrap();
