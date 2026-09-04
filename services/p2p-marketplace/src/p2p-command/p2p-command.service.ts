declare var process: any;
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BybitP2PService } from './bybit-p2p.service';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class P2pCommandService {
  private readonly logger = new Logger(P2pCommandService.name);

  constructor(
    private prisma: PrismaService,
    private bybitService: BybitP2PService
  ) {}

  async syncIncomingOrders() {
     this.logger.log('Syncing pending orders from ByBit P2P...');
     try {
       const orders = await this.bybitService.getPendingOrdersFromBybit();
       let syncedCount = 0;
       
       const activeBybitIds = orders.map((o: any) => o.id?.toString() || o.orderId?.toString()).filter(Boolean);

       for (const bybitOrder of orders) {
          const orderId = bybitOrder.id || bybitOrder.orderId;
          if (!orderId) continue;
          
          const existingOrder = await this.prisma.bybitP2pOrder.findUnique({
             where: { bybitOrderId: orderId.toString() }
          });

          if (!existingOrder) {
             // Nueva orden detectada. Disparar Auto-Welcomer!
             const msg = "¡Hola! 🤖 A.I Quant Core ha encolado tu orden. Procesaremos tu solicitud a la brevedad. Por favor, asegúrate de ser el titular de los depósitos.";
             this.bybitService.sendChatMessage(orderId.toString(), msg).catch(e => this.logger.warn("Auto-Welcomer failed: " + e.message));
          }

          const sideLabel = (bybitOrder.side === 1 || bybitOrder.orderType === 1 ? '[COMPRA] ' : '[VENTA] ');
          const retailName = sideLabel + (bybitOrder.targetNickName || bybitOrder.nickName || bybitOrder.makerName || bybitOrder.counterPartyName || "Client P2P");

          // BYBIT v5 simplifyList no trae payment. Debemos llamar a info ad-hoc.
          let detectedPayments = bybitOrder.payments ? bybitOrder.payments.join(',') : '';
          
          try {
             // Siempre pedir los detalles de la orden para tener `bankName` y el `paymentName`
             const infoDetail = await this.bybitService.getOrderDetails(orderId.toString());
             if (infoDetail && infoDetail.result && infoDetail.result.paymentTermList) {
                detectedPayments = infoDetail.result.paymentTermList.map((p: any) => {
                    const pname = (p.paymentName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const bname = (p.bankName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const accNo = (p.accountNo || '').replace(/\s/g, '');
                    
                    if (pname.includes('pago movil') || pname.includes('pagomovil') || bname.includes('pago movil') || bname.includes('pagomovil')) return 'pagomovil';
                    if (p.paymentType == 64 || p.paymentType == 318 || p.paymentType == 377 || p.paymentType == 382 || p.paymentType == 416) return 'pagomovil';
                    if (accNo.includes('0414') || accNo.includes('0424') || accNo.includes('0412') || accNo.includes('0416')) return 'pagomovil';
                    
                    if (pname.includes('mercantil') || bname.includes('mercantil') || p.paymentType == 316 || p.paymentType == 321) return 'mercantil';
                    
                    return p.paymentType || p.paymentId || pname;
                }).join(',');
             }
          } catch(e) {
             this.logger.warn(`Could not fetch detail for order ${orderId} while syncing: ${e}`);
          }

          try {
             await this.prisma.bybitP2pOrder.upsert({
                where: { bybitOrderId: orderId.toString() },
                update: {
                   retailName: retailName,
                   bankDetails: detectedPayments !== '' ? detectedPayments : undefined,
                   status: (bybitOrder.status == 2 || bybitOrder.status == '2') ? 'PAYMENT_SENT' : ((existingOrder && existingOrder.status === 'COMPLETED') ? 'PENDING_ASSIGNMENT' : undefined), // AUTO-HEAL
                },
                create: {
                   bybitOrderId: orderId.toString(),
                   amountFiat: Number(bybitOrder.amount),
                   amountUsdt: Number(bybitOrder.notifyTokenQuantity || bybitOrder.quantity),
                   price: Number(bybitOrder.price),
                   fiatCurrency: bybitOrder.currencyId || "VES",
                   status: 'PENDING_ASSIGNMENT',
                   retailName: retailName,
                   bankDetails: detectedPayments,
                }
             });
             syncedCount++;
          } catch (upsertErr: any) {
             this.logger.error(`Failed to upsert order ${orderId}: ${upsertErr.message}`);
          }
       }

       // Autoclean: Any local order that is pending/assigned/payment_sent but no longer in ByBit's pending list is COMPLETED
       // ADVERTENCIA IMPORTANTÍSIMA: Solo hacer autoclean si la API de ByBit respondió exitosamente (al menos devolvió un item o un arreglo vacío, indicando éxito, pero si hay falla de red arrojo [] con error).
       // Sin embargo, si la respuesta es correcta, iterar. Pero OJO, Bybit podría devolver orders vacía si de verdad no hay pendientes.
       // Para mayor seguridad solo limpiamos si fetch fue exitosamente procesado (que lo es si no cayó en catch).
       const localActiveOrders = await this.prisma.bybitP2pOrder.findMany({
          where: { status: { in: ['PENDING_ASSIGNMENT', 'ASSIGNED', 'PAYMENT_SENT'] } }
       });
       
       for (const localOrder of localActiveOrders) {
           if (!activeBybitIds.includes(localOrder.bybitOrderId)) {
               // Verify it was real by fetching order details!
               try {
                   const detail = await this.bybitService.getOrderDetails(localOrder.bybitOrderId);
                   // status: 1 = Wait-Pay, 2 = Wait-Release. Everything else (50=Completed, 5=Cancelled, etc) means it's inactive.
                   if (detail && detail.result && detail.result.status !== 1 && detail.result.status !== 2) {
                       this.logger.log(`Order ${localOrder.bybitOrderId} no longer active in Bybit (Status ${detail.result.status}). Marking as COMPLETED.`);
                       await this.prisma.bybitP2pOrder.update({
                           where: { bybitOrderId: localOrder.bybitOrderId },
                           data: { status: 'COMPLETED' }
                       });
                       continue; // Ya se completó, no enviar recordatorio de 10 mins
                    } else if (detail && detail.result && (detail.result.status === 2 || detail.result.status === '2')) {
                        this.logger.log(`Order ${localOrder.bybitOrderId} dropped from simplifyList pero es Wait-Release. Actualizando local a PAYMENT_SENT.`);
                        await this.prisma.bybitP2pOrder.update({
                            where: { bybitOrderId: localOrder.bybitOrderId },
                            data: { status: 'PAYMENT_SENT' }
                        });
                        continue;
                    } else if (!detail || (detail.retCode !== 0 && detail.retCode !== -1)) {
                       // Si bybit no la encontró o ya expiró por completo en simplifylist.
                       this.logger.log(`Order ${localOrder.bybitOrderId} dropped from Bybit list. Assuming COMPLETED.`);
                       await this.prisma.bybitP2pOrder.update({
                           where: { bybitOrderId: localOrder.bybitOrderId },
                           data: { status: 'COMPLETED' }
                       });
                       continue; // Ya se completó, no enviar recordatorio de 10 mins
                   }
                } catch (e: any) {
                    if (e.response && e.response.data && e.response.data.ret_code && (e.response.data.ret_code === 10001 || e.response.data.ret_code === 40002 || e.response.data.ret_code === 40001 || e.response.data.ret_code > 0)) {
                        this.logger.log(`Order ${localOrder.bybitOrderId} dropped from Bybit con error explícito de API (${e.response.data.ret_code}). Assuming COMPLETED/CANCELLED.`);
                        await this.prisma.bybitP2pOrder.update({
                            where: { bybitOrderId: localOrder.bybitOrderId },
                            data: { status: 'COMPLETED' }
                        });
                        continue;
                    }
                   // IMPORTANTE: NO marcar como COMPLETED si hay error de red o timeout
                   // porque puede ser un rate limit y borraríamos del panel del cajero una orden válida.
                   this.logger.error(`Error verificando details de orden Bybit ${localOrder.bybitOrderId}: ${e.message}`);
               }
           }
           
           // Independientemente de si sigue saliendo en simplifyList, revisar 10 min SLA
           if (localOrder.status === 'PAYMENT_SENT' && !localOrder.reminderSent) {
               const tenMinutesMs = 10 * 60 * 1000;
               if (Date.now() - new Date(localOrder.updatedAt).getTime() > tenMinutesMs) {
                   try {
                       const reminderMsg = "Saludos, han transcurrido más de 10 minutos desde que le realizamos y reportamos la transferencia exitosamente. Por favor, valide la recepción del dinero en su cuenta bancaria y proceda a **liberar la orden**. ¡Muchas gracias!";
                       await this.bybitService.sendChatMessage(localOrder.bybitOrderId, reminderMsg);
                       await this.prisma.bybitP2pOrder.update({
                           where: { bybitOrderId: localOrder.bybitOrderId },
                           data: { reminderSent: true }
                       });
                       this.logger.log(`Recordatorio automático de 10 min enviado para la orden ${localOrder.bybitOrderId}`);
                       
                       // Webhook Dispatcher para métricas de SLA
                       const slaWebhookUrl = process.env.SLA_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
                       if (slaWebhookUrl) {
                           try {
                               await axios.post(slaWebhookUrl, {
                                   content: `🚨 **SLA P2P VENCIDO (>10m)** 🚨\nLa contraparte no ha liberado la orden **${localOrder.bybitOrderId}** luego de 10 minutos de haber recibido el pago.\n👤 Usuario: ${localOrder.retailName}\n💸 Fiat: ${localOrder.amountFiat} VES`
                               });
                               this.logger.log(`SLA Webhook disparado para orden ${localOrder.bybitOrderId}`);
                           } catch (werr: any) {
                               this.logger.error(`Fallo enviando SLA webhook: ${werr.message}`);
                           }
                       }
                   } catch (msgErr: any) {
                       this.logger.error(`Error enviando recordatorio a ${localOrder.bybitOrderId}: ${msgErr.message}`);
                   }
               }
           }
       }
       
       this.logger.log(`Synced ${syncedCount} pending orders to locally tracking DB.`);
       return { success: true, count: syncedCount, message: "Sync command executed successfully" };
     } catch (err: any) {
       this.logger.error(`Error in syncIncomingOrders: ${err.message}`);
       return { success: false, error: err.message };
     }
  }

  async getPendingOrders() {
     // Fetch Orders from DB that are active (admin overview)
     return this.prisma.bybitP2pOrder.findMany({
         where: { status: { in: ['PENDING_ASSIGNMENT', 'ASSIGNED', 'PAYMENT_SENT'] } },
         include: { assignedUser: { select: { alias: true, role: true } } }
     });
  }

  async getAssignedOrders(userId: number) {
     return this.prisma.bybitP2pOrder.findMany({
         where: { status: { in: ['ASSIGNED', 'PAYMENT_SENT'] }, assignedUserId: userId },
         include: { assignedUser: { select: { alias: true } } }
     });
  }

  async assignOrder(orderId: string, userId: number) {
     return this.prisma.bybitP2pOrder.update({
         where: { bybitOrderId: orderId },
         data: {
             assignedUserId: userId,
             status: 'ASSIGNED',
             lockedAt: new Date()
         }
     });
  }

  async markOrderAsPaid(orderId: string) {
     try {
       await this.bybitService.markOrderAsPaidInBybit(orderId);
     } catch (e: any) {
       this.logger.error(`Fallo bloqueante al notificar pago a Bybit: ${e.message}`);
       throw new Error(e.message);
     }

     return this.prisma.bybitP2pOrder.update({
         where: { bybitOrderId: orderId },
         data: { status: 'PAYMENT_SENT' }
     });
  }

  async releaseOrderInBybit(orderId: string) {
     this.logger.log(`Executing remote Release for ${orderId}`);
     const apiKey = process.env.BYBIT_MASTER_API_KEY || '';
     const apiSecret = process.env.BYBIT_MASTER_API_SECRET || '';
     const timestamp = Date.now().toString();
     const recvWindow = '5000';
     const payload = JSON.stringify({ orderId });
     
     if (apiKey && apiSecret) {
         const sign = crypto.createHmac('sha256', apiSecret)
            .update(timestamp + apiKey + recvWindow + payload)
            .digest('hex');

         try {
           await axios.post('https://api.bybit.com/v5/p2p/release', payload, {
              headers: {
                 'X-BAPI-API-KEY': apiKey,
                 'X-BAPI-SIGN': sign,
                 'X-BAPI-TIMESTAMP': timestamp,
                 'X-BAPI-RECV-WINDOW': recvWindow,
                 'Content-Type': 'application/json'
              }
           });
           this.logger.log(`Successfully released Order ${orderId} on Bybit P2P`);
         } catch (err: any) {
           this.logger.error(`Failed to release ByBit P2P Order ${orderId}: ${err?.response?.data?.retMsg || err.message}`);
           throw new Error('Bybit Release Error');
         }
     }

     return this.prisma.$transaction(async (tx) => {
         const order = await tx.bybitP2pOrder.update({
             where: { bybitOrderId: orderId },
             data: { status: 'COMPLETED' }
         });

         if (order.assignedUserId) {
            // Acreditamos el monto USDT y un extra opcional (1% de spread al cajero por ejemplo)
            await tx.communityUser.update({
               where: { id: order.assignedUserId },
               data: {
                  p2pUsdtBalance: {
                     increment: Number(order.amountUsdt)
                  }
               }
            });
         }
         return order;
     });
  }
}
