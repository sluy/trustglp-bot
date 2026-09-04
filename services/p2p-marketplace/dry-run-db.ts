import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const orders = await prisma.bybitP2pOrder.findMany({
     where: { status: { in: ['PENDING_ASSIGNMENT', 'ASSIGNED', 'PAYMENT_SENT'] } },
  });
  console.log("Current Pending DB Orders:");
  console.table(orders.map(o => ({
     orderId: o.bybitOrderId,
     status: o.status,
     fiat: o.amountFiat,
     type: o.retailName?.includes('[VENTA]') ? 'VENTA' : 'COMPRA',
     updatedAt: o.updatedAt
  })));
  await prisma.$disconnect();
}

main().catch(console.error);
