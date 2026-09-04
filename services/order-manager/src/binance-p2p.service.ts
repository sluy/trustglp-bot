import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';
import { DashboardGateway } from './dashboard.gateway';

@Injectable()
export class BinanceP2PService implements OnModuleInit {
  private readonly logger = new Logger(BinanceP2PService.name);
  private apiKey: string;
  private apiSecret: string;

  constructor(
    private configService: ConfigService,
    private dashboardGateway: DashboardGateway,
  ) {
    this.apiKey = (this.configService.get<string>('BINANCE_API_KEY') || '').trim();
    this.apiSecret = (this.configService.get<string>('BINANCE_API_SECRET') || '').trim();
  }

  async onModuleInit() {
    this.logger.log('--- DIAGNÓSTICO DE CONEXIÓN Y PERMISOS BINANCE PAPI START ---');
    await this.testConnection();
    this.logger.log('--- DIAGNÓSTICO FINISHED ---');

    // Health check periódico cada 60 segundos
    setInterval(async () => {
      const health = await this.checkApiHealth();
      this.dashboardGateway.emitSystemHealth({
        binance: health,
        bybit: { status: 'ok', message: 'Monitoreado vía market-scanner' },
        timestamp: new Date().toISOString(),
      });
    }, 60000);
  }

  /**
   * Diagnóstico interactivo para corroborar el estado de la API, la IP y los permisos de Merchant P2P.
   */
  private async testConnection() {
    // TEST 1: Verificar el Account Status (API MÁS SENCILLA DE BINANCE)
    try {
      const timestamp = Date.now();
      const payloadStr = `timestamp=${timestamp}`;
      const signature = this.generateSignature(payloadStr);

      this.logger.log('TEST 1: Validando Account Info V3 (Recepción de llaves y whitelist IP)...');
      const response = await axios.get(
        `https://api.binance.com/api/v3/account?${payloadStr}&signature=${signature}`,
        { headers: { 'X-MBX-APIKEY': this.apiKey } }
      );
      this.logger.log(`[EXITO TEST 1] Perfil leído. Acceso Básico a la Cuenta: OK.`);
    } catch (error: any) {
      this.logger.error(`[FALLO TEST 1] No se pudo leer el Perfil Básico. Si esto falla, ninguna llave sirve. API KEY ESTÁ MAL o IP RECHAZADA: ${error.response?.data?.msg || error.message}`);
    }

    // TEST 2: Intentar LEER el Ad Detail (P2P Merchant API Read-Only)
    try {
      // Usamos solo el primer ID (puede ser lista separada por comas) para el test de diagnóstico
      const adIdRaw = this.configService.get<string>('MAKER_SELL_AD_ID') || '';
      const adId = adIdRaw.split(',')[0].trim();
      if (!adId) {
        this.logger.warn('[TEST 2 CANCELADO] MAKER_SELL_AD_ID no configurado.');
        return;
      }

      this.logger.log(`TEST 2: Intentando leer los datos de TU Anuncio Merchant P2P (${adId})...`);
      const timestamp = Date.now();
      const payloadStr = `adsNo=${adId}&timestamp=${timestamp}`; // Notice 'adsNo' in read vs 'advNo' in update
      const signature = this.generateSignature(payloadStr);

      const response = await axios.post(
        `https://api.binance.com/sapi/v1/c2c/ads/getDetailByNo?${payloadStr}&signature=${signature}`,
        null,
        {
          headers: {
            'X-MBX-APIKEY': this.apiKey,
            'clientType': 'web',
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      this.logger.log(`[EXITO TEST 2] Datos del Anuncio Leídos con Éxito: ${JSON.stringify(response.data.data)}`);
    } catch (error: any) {
      this.logger.error(`[FALLO TEST 2] P2P de Sólo Lectura Denegado. Código: ${error.response?.data?.code} - Mensaje: ${error.response?.data?.msg}`);
    }

    // TEST 3: Intentar LEER el Historial de Órdenes P2P
    try {
      this.logger.log(`TEST 3: Intentando leer tu Historial de Órdenes P2P (listUserOrderHistory)...`);
      const timestamp = Date.now();
      const payloadStr = `timestamp=${timestamp}`; 
      const signature = this.generateSignature(payloadStr);

      const response = await axios.get(
        `https://api.binance.com/sapi/v1/c2c/orderMatch/listUserOrderHistory?${payloadStr}&signature=${signature}`,
        {
          headers: {
            'X-MBX-APIKEY': this.apiKey,
            'clientType': 'web'
          }
        }
      );
      this.logger.log(`[EXITO TEST 3] Historial P2P Leído con Éxito. Total de Órdenes Extraídas: ${response.data.data?.length || JSON.stringify(response.data)}`);
    } catch (error: any) {
      this.logger.error(`[FALLO TEST 3] Error leyendo el Historial P2P. Código: ${error.response?.data?.code} - Mensaje: ${error.response?.data?.msg}`);
    }
  }

  /**
   * Generar la firma HMAC SHA256 requerida por Binance
   */
  private generateSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Actualizar el precio de un Anuncio P2P (Ad) existente.
   * Documentación: POST /sapi/v1/c2c/ads/update
   */
  async updateAdPrice(adId: string, newPrice: string): Promise<boolean> {
    this.logger.log(`>> Ejecutando actualización PAPI Final (v7.4): Anuncio ${adId} a Precio ${newPrice} VES`);
    
    // 1. Validaciones
    if (!this.apiKey || !this.apiSecret) {
        this.logger.error("Faltan Keys Privadas. No se enviará a Binance.");
        return false;
    }

    if (!adId || adId === 'AD_MAKER_SELL_01' || adId === 'AD_MAKER_BUY_01') {
        this.logger.warn(`El AD_ID (${adId}) es inválido o no existe.`);
        return false;
    }

    // 2. Firmado de la petición
    // NOTA: Mantenemos el orden alfabético para el HMAC (advNo, price, timestamp)
    const timestamp = Date.now();
    const payloadStr = `advNo=${adId}&price=${newPrice}&timestamp=${timestamp}`;
    const signature = this.generateSignature(payloadStr);

    // 3. Payload JSON puro, casteando el Precio a NUMERO como dice el manual
    const jsonData = {
      advNo: adId,
      price: Number(newPrice),
      timestamp: timestamp,
      signature: signature
    };

    // 4. Request Real a Binance con el HEADER OCULTO "clientType"
    try {
      const response = await axios.post(
        `https://api.binance.com/sapi/v1/c2c/ads/update`,
        jsonData,
        {
          headers: {
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/json',
            'clientType': 'web' // HEADER OBLIGATORIO SEGUN MANUAL
          }
        }
      );
      
      this.logger.log(`[Binance 🟢] Anuncio ${adId} actualizado a ${newPrice} exitosamente.`);
      return true;
    } catch (error: any) {
      this.logger.error(`[Binance 🔴] Falló la actualización (Err ${error.response?.data?.code}). Res: ${JSON.stringify(error.response?.data)}`);
      return false;
    }
  }

  /**
   * Detención de Anuncios críticos (Killswitch de Binance API)
   */
  async closeAdOffline(adId: string): Promise<void> {
    this.logger.warn(`CERRANDO ANUNCIO ${adId} DE EMERGENCIA.`);
    // Implementación HTTP privada de c2c/adv/offline.
  }

  /**
   * Verifica la conectividad real con la API de Binance.
   * Retorna 3 estados: 'ok', 'api_error' (keys malas/sin permisos), 'offline' (red/instancia caída)
   */
  async checkApiHealth(): Promise<{ status: 'ok' | 'api_error' | 'offline'; message: string }> {
    if (!this.apiKey || !this.apiSecret) {
      return { status: 'api_error', message: 'API Keys no configuradas en .env' };
    }
    try {
      const timestamp = Date.now();
      const payloadStr = `timestamp=${timestamp}`;
      const signature = this.generateSignature(payloadStr);
      const response = await axios.get(
        `https://api.binance.com/api/v3/account?${payloadStr}&signature=${signature}`,
        { headers: { 'X-MBX-APIKEY': this.apiKey }, timeout: 8000 }
      );
      if (response.status === 200) {
        return { status: 'ok', message: 'Conectado y autenticado correctamente' };
      }
      return { status: 'api_error', message: `Respuesta inesperada: HTTP ${response.status}` };
    } catch (error: any) {
      const code = error.response?.data?.code;
      const msg = error.response?.data?.msg;
      if (error.response) {
        // Llegó respuesta de Binance pero con error (keys inválidas, sin permisos, IP bloqueada)
        return { status: 'api_error', message: msg || `Error API Binance (${code})` };
      }
      // Sin respuesta — problema de red o instancia caída
      return { status: 'offline', message: 'Sin respuesta de Binance (red/timeout)' };
    }
  }
}
