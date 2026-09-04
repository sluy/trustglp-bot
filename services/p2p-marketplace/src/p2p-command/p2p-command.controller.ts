declare var process: any;
import { Controller, Get, Post, Body, Param, Logger, Req, Res, Query } from '@nestjs/common';
import { Request, Response } from 'express';
import { P2pCommandService } from './p2p-command.service';
import { BybitP2PService } from './bybit-p2p.service';
import Redis from 'ioredis';

@Controller('p2p-command')
export class P2pCommandController {
  private readonly logger = new Logger(P2pCommandController.name);
  private redis: Redis;

  constructor(
    private readonly p2pService: P2pCommandService,
    private readonly bybitP2PService: BybitP2PService
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  @Get('/')
  healthCheck() {
    return { status: 'ok', service: 'p2p-marketplace', version: '1.0' };
  }

  @Get('sync')
  async syncBybitOrders() {
    return this.p2pService.syncIncomingOrders();
  }

  @Get('payments')
  async getPaymentIds() {
    // This is a temporary bypass to expose internal payment IDs without compromising keys
    if (this.bybitP2PService) {
         return this.bybitP2PService.getUserPayments();
    }
    return { error: "bybitP2PService not injected directly" };
  }

  @Get('orders/pending')
  async getPendingAssignments() {
    // Sincroniza desde Bybit en demanda antes de listar las órdenes al Dashboard
    await this.p2pService.syncIncomingOrders();
    return this.p2pService.getPendingOrders();
  }

  @Get('orders/assigned/:userId')
  async getAssignedOrders(@Param('userId') userId: string) {
    return this.p2pService.getAssignedOrders(Number(userId));
  }

  @Post('orders/:orderId/payment-sent')
  async markPaymentSent(@Param('orderId') orderId: string) {
    return this.p2pService.markOrderAsPaid(orderId);
  }

  @Get('debug/orders')
  async debugRawOrders() {
    return this.bybitP2PService.getPendingOrdersFromBybit();
  }

  @Get('debug/payments')
  async debugPayments() {
    return this.bybitP2PService.getUserPayments();
  }

  @Get('orders/:orderId/counterparty')
  async getOrderCounterparty(@Param('orderId') orderId: string) {
    const details = await this.bybitP2PService.getOrderDetails(orderId);
    
    // Auto-extraer Cédula del Chat si no está presente o está vacía en los detalles de Bybit
    if (details && details.result) {
       try {
           const chatResponse = await this.bybitP2PService.getChatMessages(orderId);
           const messages = chatResponse?.result?.result || chatResponse?.result?.items || chatResponse?.result?.list; // Handle Bybit nesting madness
           
           if (chatResponse && (chatResponse.retCode === 0 || chatResponse.ret_code === 0) && Array.isArray(messages)) {
                // Inspeccionar mensajes de más reciente a más viejo
                for (const msg of messages) {
                     const text = msg.message || msg.content || "";
                     // Regex para CI venezolana (Ej: V-20123456, 20.123.456, 12345678)
                     // Ignoramos mensajes del bot buscando texto característico
                     if (text.toLowerCase().includes("indícanos tu número de") || text.toLowerCase().includes("indicanos") || text.toLowerCase().includes("seguridad")) {
                         continue;
                     }
                     const matchIdentity = text.match(/\b(?:V|v|E|e)?-?\s*([0-9]{1,2}(?:\.?[0-9]{3}){2}|[0-9]{6,8})\b/);
                     if (matchIdentity) {
                         // Evitar sobre-escribir si ya existe uno válido, excepto si el bot lo encontró en el chat o si viene enmascarado con asteriscos
                         if (!details.result.identityNo || details.result.identityNo.trim() === '' || details.result.identityNo.includes('*')) {
                             details.result.identityNo = matchIdentity[0].toUpperCase();
                         }
                     }

                     // Regex para Cuenta Bancaria (20 dígitos con posibles guiones o espacios)
                     const matchAccount = text.match(/\b(?:\d[\s-]*){20}\b/);
                     if (matchAccount) {
                         if (!details.result.chatDetectedAccount) {
                             details.result.chatDetectedAccount = matchAccount[0].replace(/[\s-]/g, '');
                         }
                     }

                     // Regex para Teléfono Venezolano (Ej: 04141234567, 0424-123-4567)
                     const matchPhone = text.match(/\b(?:0414|0424|0412|0416|0426|0212|0415|0422|0413|0423)[\s-]*\d{7}\b/i);
                     if (matchPhone) {
                         if (!details.result.chatDetectedPhone) {
                             details.result.chatDetectedPhone = matchPhone[0].replace(/[\s-]/g, '');
                         }
                     }

                     // Regex para Bancos Venezolanos comunes (nombres abreviados o códigos de 4 dígitos)
                     const bankRegex = /\b(0102|0104|0105|0108|0114|0115|0116|0128|0134|0138|0151|0156|0157|0171|0172|0174|0175|0177|0191|venezuela|vzla|bdv|mercantil|provincial|banesco|bancaribe|exterior|caroni|bfc|fondo comun|tesoro|agricola|bicentenario|banamigo|banplus|plaza|100%|cien por ciento|nacional de credito|bnc|activo|bancamiga)\b/i;
                     const matchBank = text.match(bankRegex);
                     if (matchBank) {
                         if (!details.result.chatDetectedBank) {
                             details.result.chatDetectedBank = matchBank[0].toUpperCase();
                         }
                     }
                     
                     if (matchIdentity && matchAccount && details.result.chatDetectedPhone && details.result.chatDetectedBank) break;
                }
           }
       } catch (e) {
           this.logger.error(`Error auto-reading chat for ${orderId}: ${e.message}`);
       }
    }
    
    return details;
  }

  @Post('orders/:orderId/chat')
  async sendChatMessage(@Param('orderId') orderId: string, @Body('message') message: string) {
    if (!message) return { success: false, error: 'Mensaje vacío' };
    return this.bybitP2PService.sendChatMessage(orderId, message);
  }

  @Post('orders/:orderId/assign')
  async assignOrder(@Param('orderId') orderId: string, @Body('userId') userId: number) {
    return this.p2pService.assignOrder(orderId, userId);
  }

  @Post('orders/:orderId/release')
  async releaseOrder(@Param('orderId') orderId: string) {
    // Agency approves release (can be automatic post-bank reconciliation)
    return this.p2pService.releaseOrderInBybit(orderId);
  }

  @Post('operative-capital')
  async setOperativeCapital(@Body() payload: any) {
    try {
      const usdt = payload.target_usdt;
      if (!usdt || isNaN(usdt)) {
        return { success: false, error: 'Target USDT inválido' };
      }
      
      await this.redis.set('bybit_p2p_operative_capital_usdt', usdt.toString());
      this.logger.log(`Capital Automático P2P configurado a: ${usdt} USDT.`);
      
      return { success: true, target_usdt: usdt };
    } catch (e) {
      this.logger.error(`Error guardando capital operativo: ${e}`);
      return { success: false, error: e.message };
    }
  }

  @Post('vital-spread')
  async setVitalSpread(@Body() payload: any) {
    try {
      const spread = payload.spread_pct;
      if (spread === undefined || isNaN(spread)) {
        return { success: false, error: 'Spread inválido' };
      }
      
      await this.redis.set('bybit_p2p_min_vital_spread_pct', spread.toString());
      this.logger.log(`Spread Mínimo Vital configurado a: ${spread}%.`);
      
      return { success: true, spread_pct: spread };
    } catch (e) {
      this.logger.error(`Error guardando spread vital: ${e}`);
      return { success: false, error: e.message };
    }
  }

  @Get('vital-spread')
  async getVitalSpread() {
    try {
      const data = await this.redis.get('bybit_p2p_min_vital_spread_pct');
      return { spread_pct: data ? parseFloat(data) : 1.0 };
    } catch (e) {
      return { spread_pct: 1.0, error: 'Error leyendo de redis' };
    }
  }

  @Get('active-strategy')
  async getActiveStrategy(@Query('bank') bank: string = 'Banesco') {
    try {
      let redisKey = 'bybit_active_strategy_banesco';
      if (bank.toLowerCase() === 'mercantil') redisKey = 'bybit_active_strategy_mercantil';
      else if (bank.toLowerCase() === 'pagomovil') redisKey = 'bybit_active_strategy_pagomovil';
      
      const data = await this.redis.get(redisKey);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return { error: 'Error leyendo de redis' };
    }
  }

  @Post('active-strategy')
  async setActiveStrategy(@Body() payload: any) {
    try {
      if (!payload || !payload.strategy_id) {
         return { success: false, error: 'Estrategia inválida' };
      }

      const bank = payload.bank || 'Banesco';
      let redisKey = 'bybit_active_strategy_banesco';
      if (bank.toLowerCase() === 'mercantil') redisKey = 'bybit_active_strategy_mercantil';
      else if (bank.toLowerCase() === 'pagomovil') redisKey = 'bybit_active_strategy_pagomovil';

      await this.redis.set(redisKey, JSON.stringify(payload));
      this.logger.log(`Estrategia Activa fijada para ${bank}`);
      
      return { success: true };
    } catch (e) {
      this.logger.error(`Error fijando estrategia activa: ${e}`);
      return { success: false, error: e.message };
    }
  }

  @Post('orders/:orderId/pay-with-receipt')
  async payWithReceipt(
    @Param('orderId') orderId: string, 
    @Body('imageBase64') imageBase64: string,
    @Req() req: Request
  ) {
      if (!imageBase64) return { error: 'No image provided' };

      // Generate unique ID
      const receiptId = Math.random().toString(36).substring(2, 15);
      
      // Store in Redis with TTL 24 hours (86400 seconds)
      await this.redis.set(`receipt:${receiptId}`, imageBase64, 'EX', 86400);

      // Generate public URL using the new root domain
      const customDomain = process.env.PUBLIC_DOMAIN || 'aiquantcore.cloud';
      const receiptUrl = `https://${customDomain}/p2p-command/receipt/${receiptId}`;

      try {
          const cleanUrl = receiptUrl.replace(/^https?:\/\//, '');
          const chatMsg = `Transferencia confirmada y pago emitido ✅.\nPor filtros de la plataforma, copia y pega el siguiente texto en tu navegador para VER EL COMPROBANTE de pago:\n\n${cleanUrl}\n\nPor favor verifica tu banco y libera.`;
          
          // El try/catch ahora es dependiente del resultado exacto del Chat (HTTP 200 pero fallos internos)
          await this.bybitP2PService.sendChatMessage(orderId, chatMsg);
          
          const result = await this.p2pService.markOrderAsPaid(orderId);
          return { success: true, receiptUrl, result };
      } catch (err: any) {
          req.res?.status(400); // Bad Request to show error explicitly
          return { error: true, message: err.message };
      }
  }

  @Get('receipt/:id')
  async getReceipt(@Param('id') id: string, @Res() res: Response) {
      const base64 = await this.redis.get(`receipt:${id}`);
      if (!base64) {
         return res.type('text/html').send(`<html><body style="background:#0f172a;color:white;font-family:sans-serif;text-align:center;padding:50px;"><h1>Comprobante Expirado o No Encontrado</h1><p>El comprobante ha sido destruido por razones de seguridad tras 24 horas.</p></body></html>`);
      }

      // Return an HTML page with the image to open nicely in a browser
      const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Comprobante de Pago P2P</title>
          <style>
            body { background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: system-ui, sans-serif; }
            img { max-width: 100%; max-height: 80vh; border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); border: 2px solid #334155; }
            .badge { background: #10b981; color: white; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: bold; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px; }
            p { color: #94a3b8; font-size: 14px; margin-top: 16px; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="badge">Validación Segura (Expira en 24h)</div>
          <img src="${base64}" alt="Comprobante de Pago P2P" />
          <p>Comprobante #${id.toUpperCase()}</p>
        </body>
        </html>
      `;
      return res.type('text/html').send(html);
  }
}
