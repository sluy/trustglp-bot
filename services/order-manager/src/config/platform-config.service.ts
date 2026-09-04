import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface BrandConfig {
  clientName: string;
  clientSlug: string;
  primaryColor: string;
  secondaryColor: string;
  supportEmail: string;
  theme: string;
  clientMode: string;
}

export interface ApiKeysConfig {
  binanceApiKey?: string;
  binanceApiSecret?: string;
  bybitApiKey?: string;
  bybitApiSecret?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  bank: string;
  type: 'bank_transfer' | 'mobile_payment' | 'digital_wallet';
  bybitCodes: string[];
  binanceCodes: string[];
  enabled: boolean;
  enabledForBuy: boolean;
  enabledForSell: boolean;
}

// Catálogo completo de métodos VES disponibles
export const VES_PAYMENT_CATALOG: Omit<PaymentMethod, 'enabled' | 'enabledForBuy' | 'enabledForSell'>[] = [
  { id: 'banesco',    name: 'Banesco',              bank: 'Banesco',              type: 'bank_transfer',   bybitCodes: ['585','14','130','137','253'], binanceCodes: ['Banesco'] },
  { id: 'mercantil',  name: 'Mercantil',             bank: 'Mercantil',            type: 'bank_transfer',   bybitCodes: ['321','316'],                  binanceCodes: ['Mercantil'] },
  { id: 'provincial', name: 'BBVA Provincial',        bank: 'BBVA Provincial',      type: 'bank_transfer',   bybitCodes: ['315'],                        binanceCodes: ['Provincial'] },
  { id: 'venezuela',  name: 'Banco de Venezuela',     bank: 'Banco de Venezuela',   type: 'bank_transfer',   bybitCodes: ['317'],                        binanceCodes: ['BanVenezuela'] },
  { id: 'bod',        name: 'BOD',                   bank: 'BOD',                  type: 'bank_transfer',   bybitCodes: ['319'],                        binanceCodes: ['BOD'] },
  { id: 'banplus',    name: 'Banplus',               bank: 'Banplus',              type: 'bank_transfer',   bybitCodes: ['322'],                        binanceCodes: ['Banplus'] },
  { id: 'bnc',        name: 'BNC',                   bank: 'BNC',                  type: 'bank_transfer',   bybitCodes: ['320'],                        binanceCodes: ['BNC'] },
  { id: 'bicentenario', name: 'Bicentenario',         bank: 'Bicentenario',         type: 'bank_transfer',   bybitCodes: ['323'],                        binanceCodes: ['Bicentenario'] },
  { id: 'sofitasa',   name: 'Sofitasa',              bank: 'Sofitasa',             type: 'bank_transfer',   bybitCodes: ['324'],                        binanceCodes: ['Sofitasa'] },
  { id: 'pagomovil',  name: 'Pago Móvil (Todos)',     bank: 'Pago Móvil',           type: 'mobile_payment',  bybitCodes: ['318','377','382','416'],       binanceCodes: ['PagoMovil'] },
  { id: 'zelle',      name: 'Zelle (USD)',            bank: 'Zelle',                type: 'digital_wallet',  bybitCodes: ['390'],                        binanceCodes: ['Zelle'] },
];

@Injectable()
export class PlatformConfigService {
  private readonly logger = new Logger(PlatformConfigService.name);
  private readonly configPath = path.join(process.cwd(), 'platform-config.json');
  private readonly encKey: string;

  constructor(private readonly configService: ConfigService) {
    this.encKey = this.configService.get<string>('ENCRYPTION_KEY') || 'telecambios-ve-default-enc-key-32chars!!';
    this.ensureConfigFile();
  }

  private ensureConfigFile() {
    if (!fs.existsSync(this.configPath)) {
      const defaults = {
        brand: {
          clientName: 'Telecambios VE',
          clientSlug: 'telecambios-ve',
          primaryColor: '#7c3aed',
          secondaryColor: '#d97706',
          supportEmail: 'soporte@telecambiosve.com',
          theme: 'telecambios-ve',
          clientMode: 'full',
        },
        apiKeys: {},
        paymentMethods: this.getDefaultPaymentMethods(),
      };
      fs.writeFileSync(this.configPath, JSON.stringify(defaults, null, 2));
    }
  }

  private getDefaultPaymentMethods(): PaymentMethod[] {
    return VES_PAYMENT_CATALOG.map(m => ({
      ...m,
      // Banesco y Mercantil activos por defecto
      enabled: ['banesco', 'mercantil'].includes(m.id),
      enabledForBuy: ['banesco', 'mercantil', 'pagomovil'].includes(m.id),
      enabledForSell: ['banesco'].includes(m.id),
    }));
  }

  private readConfig(): { brand: BrandConfig; apiKeys: Record<string, string>; paymentMethods?: PaymentMethod[] } {
    try {
      const raw = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      // Migrar configs antiguas sin paymentMethods
      if (!raw.paymentMethods) raw.paymentMethods = this.getDefaultPaymentMethods();
      return raw;
    } catch {
      this.ensureConfigFile();
      return this.readConfig();
    }
  }

  private writeConfig(data: { brand: BrandConfig; apiKeys: Record<string, string>; paymentMethods?: PaymentMethod[] }) {
    fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
  }

  // ── Encrypt / Decrypt ──────────────────────────────────────────────
  private encrypt(text: string): string {
    const iv  = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encKey, 'telecambios-ve-salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let enc = cipher.update(text, 'utf8', 'hex');
    enc += cipher.final('hex');
    return iv.toString('hex') + ':' + enc;
  }

  private decrypt(text: string): string {
    try {
      const [ivHex, enc] = text.split(':');
      const iv  = Buffer.from(ivHex, 'hex');
      const key = crypto.scryptSync(this.encKey, 'telecambios-ve-salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let dec = decipher.update(enc, 'hex', 'utf8');
      dec += decipher.final('utf8');
      return dec;
    } catch {
      return '';
    }
  }

  private mask(value: string): string {
    if (!value || value.length < 8) return '****';
    return value.substring(0, 4) + '****' + value.substring(value.length - 4);
  }

  // ── Brand ──────────────────────────────────────────────────────────
  getBrandConfig(): BrandConfig {
    return this.readConfig().brand;
  }

  updateBrandConfig(brand: Partial<BrandConfig>): BrandConfig {
    const config = this.readConfig();
    config.brand = { ...config.brand, ...brand };
    this.writeConfig(config);
    this.logger.log(`Brand config updated: ${brand.clientName}`);
    return config.brand;
  }

  // ── API Keys ───────────────────────────────────────────────────────
  saveApiKeys(keys: ApiKeysConfig): void {
    const config = this.readConfig();
    const stored = config.apiKeys || {};

    if (keys.binanceApiKey)    stored.binanceApiKey    = this.encrypt(keys.binanceApiKey);
    if (keys.binanceApiSecret) stored.binanceApiSecret = this.encrypt(keys.binanceApiSecret);
    if (keys.bybitApiKey)      stored.bybitApiKey      = this.encrypt(keys.bybitApiKey);
    if (keys.bybitApiSecret)   stored.bybitApiSecret   = this.encrypt(keys.bybitApiSecret);
    if (keys.telegramBotToken) stored.telegramBotToken = this.encrypt(keys.telegramBotToken);
    if (keys.telegramChatId)   stored.telegramChatId   = this.encrypt(keys.telegramChatId);

    config.apiKeys = stored;
    this.writeConfig(config);
    this.logger.log('API keys updated (encrypted)');
  }

  getMaskedApiKeys(): Record<string, string> {
    const stored = this.readConfig().apiKeys;
    const masked: Record<string, string> = {};
    for (const [k, v] of Object.entries(stored)) {
      try { masked[k] = this.mask(this.decrypt(v)); } catch { masked[k] = '****'; }
    }
    return masked;
  }

  getDecryptedApiKeys(): ApiKeysConfig {
    const stored = this.readConfig().apiKeys;
    return {
      binanceApiKey:    stored.binanceApiKey    ? this.decrypt(stored.binanceApiKey)    : undefined,
      binanceApiSecret: stored.binanceApiSecret ? this.decrypt(stored.binanceApiSecret) : undefined,
      bybitApiKey:      stored.bybitApiKey      ? this.decrypt(stored.bybitApiKey)      : undefined,
      bybitApiSecret:   stored.bybitApiSecret   ? this.decrypt(stored.bybitApiSecret)   : undefined,
      telegramBotToken: stored.telegramBotToken ? this.decrypt(stored.telegramBotToken) : undefined,
      telegramChatId:   stored.telegramChatId   ? this.decrypt(stored.telegramChatId)   : undefined,
    };
  }

  // ── Payment Methods ─────────────────────────────────────────────────
  getPaymentMethods(): PaymentMethod[] {
    const config = this.readConfig();
    // Merge catalog con estado guardado (por si se añaden nuevos bancos al catálogo)
    const saved = config.paymentMethods || [];
    return VES_PAYMENT_CATALOG.map(catalogItem => {
      const savedItem = saved.find(s => s.id === catalogItem.id);
      return savedItem
        ? { ...catalogItem, ...savedItem }
        : { ...catalogItem, enabled: false, enabledForBuy: false, enabledForSell: false };
    });
  }

  savePaymentMethods(methods: Partial<PaymentMethod>[]): PaymentMethod[] {
    const config = this.readConfig();
    const current = this.getPaymentMethods();
    const updated = current.map(m => {
      const change = methods.find(c => c.id === m.id);
      return change ? { ...m, ...change } : m;
    });
    config.paymentMethods = updated;
    this.writeConfig(config);
    this.logger.log(`Payment methods updated: ${updated.filter(m => m.enabled).map(m => m.name).join(', ')}`);
    return updated;
  }

  /** Devuelve solo los métodos activos con sus códigos para los bots */
  getActivePaymentCodes(): { bybit: { buy: string[]; sell: string[] }; binance: { buy: string[]; sell: string[] } } {
    const methods = this.getPaymentMethods().filter(m => m.enabled);
    return {
      bybit: {
        buy:  methods.filter(m => m.enabledForBuy).flatMap(m => m.bybitCodes),
        sell: methods.filter(m => m.enabledForSell).flatMap(m => m.bybitCodes),
      },
      binance: {
        buy:  methods.filter(m => m.enabledForBuy).flatMap(m => m.binanceCodes),
        sell: methods.filter(m => m.enabledForSell).flatMap(m => m.binanceCodes),
      },
    };
  }
}
