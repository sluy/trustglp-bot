import { NextResponse } from 'next/server';
import { readBinanceKeys, binanceSapi } from '../../_lib/binance';

export const dynamic = 'force-dynamic';

/**
 * GET /api/binance/order/[orderId]
 * Obtiene los métodos de pago del vendedor via:
 *   GET /sapi/v1/c2c/orderMatch/paymentMethods?orderNo=xxx
 * Retorna: account, bankName, accountName, payMethodId
 */
export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;
  const { apiKey, apiSecret } = readBinanceKeys();

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ ok: false, error: 'Falta Binance API Key o Secret.' });
  }

  const errors: string[] = [];



  // === FALLBACK: getUserOrderDetail (por si paymentMethods no existe) ===
  // === ENDPOINT PRIMARIO: getUserOrderDetail ===
  const detailVariants: Array<[string, string, 'GET' | 'POST']> = [
    ['/sapi/v1/c2c/orderMatch/getUserOrderDetail', 'adOrderNo', 'POST'],
    ['/sapi/v1/c2c/orderMatch/getUserOrderDetail', 'orderNo', 'POST'],
    ['/sapi/v1/c2c/orderMatch/getUserOrderDetail', 'orderNumber', 'POST'],
    ['/sapi/v1/c2c/orderMatch/paymentMethods', 'orderNo', 'GET'],
    ['/sapi/v1/c2c/orderMatch/paymentMethods', 'adOrderNo', 'GET'],
    ['/sapi/v1/c2c/orderMatch/paymentMethods', 'orderNumber', 'GET'],
  ];

  let bestResult: any = null;
  let bestFields: any[] = [];
  let bestD: any = null;
  let resolvedWith = '';

  for (const [apiPath, paramName, method] of detailVariants) {
    try {
      const p: Record<string, string> = {};
      p[paramName] = orderId;
      const d = await binanceSapi(method, apiPath, p, apiKey, apiSecret);

      if (d && d.code === -1002) continue; // Si es auth error intentamos otra variante
      
      const dData = d?.data ?? d;
      const payMethods   = Array.isArray(dData) ? dData : (dData?.payMethods ?? dData?.payTerms ?? []);
      const first        = Array.isArray(payMethods) ? payMethods[0] : null;
      let fieldsArr: any[] = [];
      if (Array.isArray(first?.fields)) {
        fieldsArr = first.fields;
      } else if (first?.fields && typeof first.fields === 'object') {
        // Convert object to array
        fieldsArr = Object.entries(first.fields).map(([k, v]) => ({ fieldName: k, fieldValue: v }));
      }
      
      // Si la API devolvió los datos directamente en vez de en el arreglo fields
      if (fieldsArr.length === 0 && first && (first.accountNo || first.realName || first.identifier || first.bankName || first.payType)) {
         const newFields = [];
         if (first.accountNo)  newFields.push({ fieldName: 'accountNo', fieldValue: first.accountNo });
         if (first.realName)   newFields.push({ fieldName: 'realName', fieldValue: first.realName });
         if (first.identifier) newFields.push({ fieldName: 'identifier', fieldValue: first.identifier });
         if (first.bankName)   newFields.push({ fieldName: 'bankName', fieldValue: first.bankName });
         if (first.payType)    newFields.push({ fieldName: 'payType', fieldValue: first.payType });
         fieldsArr = newFields;
      }
      
      if (!bestD) bestD = d; // Guardar el primero por si acaso
      
      if (fieldsArr.length > 0) {
        bestFields = fieldsArr;
        bestD = d;
        bestResult = first;
        resolvedWith = `POST ${apiPath} [${paramName}]`;
        break; // Encontramos uno con campos, detenemos la búsqueda
      }
    } catch (e: any) {
      if (e.message.includes('404')) continue;
      errors.push(`detail[${apiPath}:${paramName}]: ${e.message}`);
    }
  }

  // Ahora procesamos bestFields y bestD
  if (bestD) {
      let chatDetectedAccount: string | null = null;
      let chatDetectedCedula:  string | null = null;
      let accountHolder:       string | null = null;
      
      let cedulasFound: any[] = [];
      let accountsFound: any[] = [];
      let bankNameField: string | null = null;
      
      for (const f of bestFields) {
        const n = (f.fieldName || '').toLowerCase();
        const nNorm = n.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remover acentos

        if ((nNorm.includes('name') || nNorm.includes('nombre') || nNorm.includes('titular') || nNorm.includes('holder') || nNorm.includes('receptor')) && !nNorm.includes('banco') && !nNorm.includes('bank')) {
          accountHolder = f.fieldValue;
        } else if ((nNorm.includes('account') || nNorm.includes('cuenta') || nNorm.includes('cta') || nNorm.includes('phone') || nNorm.includes('movil') || nNorm.includes('telefono') || nNorm.includes('celular') || nNorm.includes('numero')) && !nNorm.includes('type') && !nNorm.includes('tipo') && !nNorm.includes('cedula') && !nNorm.includes('id') && !nNorm.includes('document')) {
          accountsFound.push({ name: nNorm, value: f.fieldValue });
        } else if (nNorm.includes('cedula') || nNorm.includes('rif') || nNorm.includes('identity') || nNorm.includes('id number') || nNorm.includes('id ') || nNorm === 'id' || nNorm === 'ci' || nNorm.includes('c.i') || nNorm.includes('dni') || nNorm.includes('documento')) {
          cedulasFound.push({ name: nNorm, value: f.fieldValue });
        } else if (nNorm.includes('bank') || nNorm.includes('banco')) {
          bankNameField = f.fieldValue;
        }
      }

      if (accountsFound.length > 0) {
        const bestAcc = accountsFound.find(a => a.name.includes('account') || a.name.includes('cuenta')) || accountsFound.find(a => a.name.includes('phone') || a.name.includes('movil')) || accountsFound[0];
        let accountVal = bestAcc.value.replace(/[\s.-]/g, '');
        if (/^(414|412|416|424|426)\d{7}$/.test(accountVal)) {
           accountVal = '0' + accountVal;
        }
        chatDetectedAccount = accountVal;
      }
      if (cedulasFound.length > 0) {
        // Prioritize 'personal id number' or 'cedula'
        const best = cedulasFound.find(c => c.name.includes('personal id') || c.name.includes('cedula') || c.name.includes('rif') || c.name.includes('id number')) || cedulasFound[0];
        chatDetectedCedula = best.value.replace(/\./g, '');
      }


      return NextResponse.json({
        ok: true,
        result: {
          chatDetectedAccount: chatDetectedAccount || bestD?.buyerRealName || null,
          chatDetectedCedula:  chatDetectedCedula  || bestD?.identityNo    || null,
          accountHolder:       accountHolder        || bestD?.sellerRealName || null,
          payId: bestResult?.payId ?? bestResult?.id ?? bestResult?.payMethodId ?? null,
          bankName: bankNameField ?? bestResult?.identifier ?? bestResult?.payMethodName ?? null,
          payMethods: bestResult ? [bestResult] : [],
          _resolvedWith: resolvedWith || 'Fallback (no fields)',
          raw: bestD,
        },
      });
  }

  return NextResponse.json({
    ok: false,
    error: errors[0] || 'No se pudo obtener datos de la orden',
    allErrors: errors,
  });
}
