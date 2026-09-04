import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CapitalService {
  private readonly logger = new Logger(CapitalService.name);

  // Prisma sería inyectado aquí en producción real.
  // constructor(private prisma: PrismaService) {}

  /**
   * Verifica que haya suficiente saldo real (y no bloqueado)
   * antes de publicar un anuncio de VENTA.
   */
  async checkSufficientInventory(asset: string, requiredAmount: number): Promise<boolean> {
    this.logger.log(`Verificando inventario para ${asset}: ${requiredAmount}`);
    
    // Simulación contable basada en Prisma
    // const inventario = await this.prisma.inventarioCapital.findFirst({ where: { asset } });
    const simInventoryAvailable = 5000; // 5000 USDT disponibles simulados

    if (simInventoryAvailable >= requiredAmount) {
        return true;
    }
    
    this.logger.warn(`¡Peligro! Fondos insuficientes. Evitando sobre-venta de ${asset}.`);
    return false;
  }

  /**
   * Registra asientos contables cuando una transacción se ejecuta o bloquea por P2P
   */
  async lockFounds(asset: string, amountToLock: number): Promise<void> {
      this.logger.log(`Bloqueando contablemente ${amountToLock} de ${asset}`);
      // Lógica ACID en PSQL para mover de balanceAvailable -> balanceLocked.
  }
}
