import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: true, // Devuelve el origen exacto que hace la petición (requerido cuando credentials: true)
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Forzar que permita ambos transportes explícitamente
})
export class DashboardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = 0;

  handleConnection(client: Socket) {
    this.connectedClients++;
    console.log(`📡 [DashboardGateway] Cliente conectado: ${client.id} | Total: ${this.connectedClients}`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    console.log(`🔌 [DashboardGateway] Cliente desconectado: ${client.id} | Total: ${this.connectedClients}`);
  }

  /**
   * Emite la actualización de la rentabilidad del mercado a todos los clientes (Next.js Dashboard)
   */
  emitMarketUpdate(data: {
    spread: number;
    spread_gross_pct?: number;
    precioCompraMaker: number;
    precioVentaMaker: number;
    volumen_usdt: number;
    competitivo: boolean;
  }) {
    this.server.emit('marketUpdate', data);
  }

  /**
   * Emite información sobre liquidez o capital disponible.
   */
  emitCapitalUpdate(data: { capitalDisponible: number }) {
    this.server.emit('capitalUpdate', data);
  }

  /**
   * Emite la actualización global P2P de Bybit (Array Top 3 y spread)
   */
  emitBybitMarketUpdate(data: any) {
    this.server.emit('bybitMarketUpdate', data);
  }

  /**
   * Emite el resultado de una actualización de anuncio P2P individual.
   * Permite al dashboard construir la tabla de anuncios monitoreados en tiempo real.
   */
  emitAdUpdate(data: {
    adId: string;
    adType: 'SELL' | 'BUY';
    price: string;
    exchange: 'Binance' | 'Bybit';
    bank: string;
    success: boolean;
    timestamp: string;
  }) {
    this.server.emit('adUpdate', data);
  }

  /**
   * Emite el estado real de salud de las APIs externas (Binance, Bybit).
   * Estados: 'ok' = verde, 'api_error' = amarillo, 'offline' = rojo
   */
  emitSystemHealth(data: {
    binance: { status: 'ok' | 'api_error' | 'offline'; message: string };
    bybit: { status: 'ok' | 'api_error' | 'offline'; message: string };
    timestamp: string;
  }) {
    this.server.emit('systemHealth', data);
  }
}
