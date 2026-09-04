import { Controller, Get, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { PlatformConfigService, BrandConfig, ApiKeysConfig, PaymentMethod } from './platform-config.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('config')
export class PlatformConfigController {
  private readonly logger = new Logger(PlatformConfigController.name);

  constructor(private readonly configService: PlatformConfigService) {}

  /** Público — usado por el frontend al iniciar para cargar brand config */
  @Get('public')
  getPublicConfig() {
    const brand = this.configService.getBrandConfig();
    return {
      clientName:    brand.clientName,
      clientSlug:    brand.clientSlug,
      primaryColor:  brand.primaryColor,
      secondaryColor: brand.secondaryColor,
      supportEmail:  brand.supportEmail,
      theme:         brand.theme,
      clientMode:    brand.clientMode,
    };
  }

  /** Admin — actualiza identidad de marca */
  @Post('brand')
  @UseGuards(AuthGuard)
  updateBrand(@Body() dto: Partial<BrandConfig>) {
    const updated = this.configService.updateBrandConfig(dto);
    return { success: true, config: updated };
  }

  /** Admin — guarda API keys cifradas */
  @Post('api-keys')
  @UseGuards(AuthGuard)
  saveApiKeys(@Body() dto: ApiKeysConfig) {
    this.configService.saveApiKeys(dto);
    return { success: true, message: 'API keys guardadas y cifradas exitosamente.' };
  }

  /** Admin — retorna API keys maskeadas (para mostrar en el panel) */
  @Get('api-keys')
  @UseGuards(AuthGuard)
  getMaskedKeys() {
    return this.configService.getMaskedApiKeys();
  }

  /** Público — lista todos los métodos de pago VES con su estado */
  @Get('payment-methods')
  getPaymentMethods() {
    return this.configService.getPaymentMethods();
  }

  /** Admin — actualiza qué métodos de pago están activos */
  @Post('payment-methods')
  @UseGuards(AuthGuard)
  savePaymentMethods(@Body() dto: { methods: Partial<PaymentMethod>[] }) {
    const updated = this.configService.savePaymentMethods(dto.methods);
    return { success: true, active: updated.filter(m => m.enabled).map(m => m.name) };
  }

  /** Público — devuelve los códigos activos para usar en los bots directamente */
  @Get('payment-methods/active-codes')
  getActivePaymentCodes() {
    return this.configService.getActivePaymentCodes();
  }
}
