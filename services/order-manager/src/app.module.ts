import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CommunityUsersModule } from './community-users/community-users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { CapitalService } from './capital.service';
import { DynamicPricingService } from './dynamic-pricing.service';
import { BinanceP2PService } from './binance-p2p.service';
import { BankReconciliationController } from './bank-reconciliation.controller';
import { BankReconciliationService } from './bank-reconciliation.service';
import { DashboardGateway } from './dashboard.gateway';
import { PlatformConfigModule } from './config/platform-config.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    CommunityUsersModule,
    AuthModule,
    PlatformConfigModule,
  ],
  controllers: [
    BankReconciliationController,
  ],
  providers: [
    CapitalService,
    DynamicPricingService,
    BinanceP2PService,
    BankReconciliationService,
    DashboardGateway,
  ],
})
export class AppModule {}
