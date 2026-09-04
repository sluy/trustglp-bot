import { Test, TestingModule } from '@nestjs/testing';
import { CapitalService } from './capital.service';

describe('CapitalService (Financial Suite QA)', () => {
  let service: CapitalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CapitalService],
    }).compile();

    service = module.get<CapitalService>(CapitalService);
  });

  describe('checkSufficientInventory', () => {
    it('Debería retornar true si hay capital suficiente y no se sobre-vende', async () => {
      // Simulado: Disponibilidad 5000 USDT. Pedimos vender 100 USDT.
      const isSafe = await service.checkSufficientInventory('USDT', 100);
      expect(isSafe).toBe(true);
    });

    it('Debería BLOQUEAR la transacción (false) ante peligro de sobre-venta de USDT', async () => {
      // Simulado: Disponibilidad 5000 USDT. Pedimos vender 10.000 (Catástrofe de coma flotante)
      // QA Tester Estricto inyectando anomalía
      const isSafe = await service.checkSufficientInventory('USDT', 10000);
      expect(isSafe).toBe(false);
    });

    it('Debería manejar correctamente cálculos de coma flotante (Precision Test)', async () => {
      // Forzando el clásico error de coma flotante 0.1 + 0.2 = 0.30000000000000004
      // El saldo disponible simulado es 5000. Pediremos vender 5000.000000000001
      const isSafe = await service.checkSufficientInventory('USDT', 5000.000000000001);
      
      // Debe ser false porque estricto(5000) NO es mayor o igual a 5000.000000000001
      expect(isSafe).toBe(false);
    });
  });
});
