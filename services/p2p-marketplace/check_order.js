const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const order = await prisma.bybitP2pOrder.findUnique({ where: { bybitOrderId: '2044396897735450624' } });
    console.log(JSON.stringify(order, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
