import { Module } from '@nestjs/common';
import { P2pCommandController } from './p2p-command/p2p-command.controller';
import { P2pCommandService } from './p2p-command/p2p-command.service';
import { PrismaService } from './prisma.service';
import { ConfigModule } from '@nestjs/config';
import { DynamicAutoPricingService } from './p2p-command/dynamic-auto-pricing.service';
import { BybitP2PService } from './p2p-command/bybit-p2p.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [P2pCommandController],
  providers: [
    P2pCommandService, 
    PrismaService,
    DynamicAutoPricingService,
    BybitP2PService
  ],
})
export class AppModule {}
