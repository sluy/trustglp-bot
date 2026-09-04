import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const DATA_FILE = '/app/data/operators.json';

export async function GET(req: NextRequest) {
  try {
     const ops = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
     
     // Buscar al operador SirCaiza
     const opIndex = ops.findIndex((o: any) => o.alias === 'SirCaiza' || o.alias === 'sircaiza');
     
     if (opIndex >= 0) {
        ops[opIndex].totalOrders = (ops[opIndex].totalOrders || 0) + 1;
        ops[opIndex].completedOrders = (ops[opIndex].completedOrders || 0) + 1;
        ops[opIndex].totalVolumeUsdt = (ops[opIndex].totalVolumeUsdt || 0) + 5;
        ops[opIndex].p2pUsdtBalance = (ops[opIndex].p2pUsdtBalance || 0) + 5;
        ops[opIndex].successRate = 100;
        
        writeFileSync(DATA_FILE, JSON.stringify(ops, null, 2), 'utf-8');
        return NextResponse.json({ ok: true, message: 'Operador SirCaiza restaurado con 5 USDT y 1 orden.', operator: ops[opIndex] });
     } else {
        // Fallback al primer operador si no encuentra SirCaiza
        if (ops.length > 0) {
            ops[0].totalOrders = (ops[0].totalOrders || 0) + 1;
            ops[0].completedOrders = (ops[0].completedOrders || 0) + 1;
            ops[0].totalVolumeUsdt = (ops[0].totalVolumeUsdt || 0) + 5;
            ops[0].p2pUsdtBalance = (ops[0].p2pUsdtBalance || 0) + 5;
            ops[0].successRate = 100;
            writeFileSync(DATA_FILE, JSON.stringify(ops, null, 2), 'utf-8');
            return NextResponse.json({ ok: true, message: 'Primer operador restaurado con 5 USDT y 1 orden.', operator: ops[0] });
        }
     }
     
     return NextResponse.json({ error: 'No operators found' });
  } catch (e: any) {
     return NextResponse.json({ error: e.message });
  }
}
