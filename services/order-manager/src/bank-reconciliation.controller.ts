import { Controller, Post, Body, HttpCode, HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import { BankReconciliationService } from './bank-reconciliation.service';

@Controller('webhooks/bank')
export class BankReconciliationController {
  private readonly logger = new Logger(BankReconciliationController.name);

  constructor(private readonly bankService: BankReconciliationService) {}

  @Post('payment-received')
  @HttpCode(HttpStatus.OK)
  async handleBankWebhook(@Body() payload: any) {
    this.logger.log(`[Webhook] Recibo bancario simulado entrante: Ref ${payload.referencia}`);
    
    // Auth simple por token (en un entorno real sería firmado o por IP whitelist del scraper bancario)
    if (payload.secret !== process.env.BANK_WEBHOOK_SECRET) {
      throw new UnauthorizedException('Token de scraper bancario inválido');
    }

    const { bancoDestino, montoVES, referencia, cedulaEmisor } = payload;

    // Disparar flujo asíncrono de conciliación y posible liberación
    await this.bankService.processReconciliation({
      bank: bancoDestino,
      amountFiat: Number(montoVES),
      reference: referencia,
      senderId: cedulaEmisor
    });

    return { received: true, status: 'Processing' };
  }
}
