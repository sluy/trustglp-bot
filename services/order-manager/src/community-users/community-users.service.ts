import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CryptoService } from '../crypto/crypto.service';
import { AuthService } from '../auth/auth.service';
import * as crypto from 'crypto';
import axios from 'axios';

const prisma = new PrismaClient();

@Injectable()
export class CommunityUsersService {
  currentMasterTrend: string = "ESCANEO PENDIENTE";

  constructor(private cryptoService: CryptoService, private authService: AuthService) {}
  
  async updateMasterTrend(trend: string) {
     this.currentMasterTrend = trend;
     return { success: true };
  }

  async runBnbMigration() {
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE p2p.community_user
          ADD COLUMN IF NOT EXISTS bnb_capital_allocated DECIMAL(18,8) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS bnb_offset DECIMAL(18,8) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS bnb_enabled BOOLEAN DEFAULT false
      `);
      return { success: true, message: '✅ Columnas BNB creadas o ya existían' };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  private async fetchCumRealized(apiKey: string, apiSecretEnc: string): Promise<{btcCumRealized: number, ethCumRealized: number, solCumRealized: number, xrpCumRealized: number, bnbCumRealized: number}> {
       let btcCumRealized = 0;
       let ethCumRealized = 0;
       let solCumRealized = 0;
       let xrpCumRealized = 0;
       let bnbCumRealized = 0;
       try {
           const apiSecret = this.cryptoService.decrypt(apiSecretEnc);
           const timestampPos = Date.now().toString();
           const recvWindow = '10000';
           const qsPos = 'category=linear&settleCoin=USDT';
           const signStringPos = timestampPos + apiKey + recvWindow + qsPos;
           const signaturePos = crypto.createHmac('sha256', apiSecret).update(signStringPos).digest('hex');
           
           const reqPos = await axios.get(`https://api.bybit.com/v5/position/list?${qsPos}`, {
             headers: { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': timestampPos, 'X-BAPI-SIGN': signaturePos, 'X-BAPI-RECV-WINDOW': recvWindow },
             timeout: 5000
           });
           
           if (reqPos.data?.retCode === 0) {
              const posList = reqPos.data.result.list || [];
              for (const pos of posList) {
                  if (pos.symbol === 'BTCUSDT') btcCumRealized += parseFloat(pos.cumRealisedPnl || '0');
                  if (pos.symbol === 'ETHUSDT') ethCumRealized += parseFloat(pos.cumRealisedPnl || '0');
                  if (pos.symbol === 'SOLUSDT') solCumRealized += parseFloat(pos.cumRealisedPnl || '0');
                  if (pos.symbol === 'XRPUSDT') xrpCumRealized += parseFloat(pos.cumRealisedPnl || '0');
                   if (pos.symbol === 'BNBUSDT') bnbCumRealized += parseFloat(pos.cumRealisedPnl || '0');
              }
           }
       } catch(e) {
           console.error("Error fetching offsets", e.message);
       }
       return { btcCumRealized, ethCumRealized, solCumRealized, xrpCumRealized, bnbCumRealized };
  }

  /**
   * Suma el PnL REAL cerrado por símbolo desde una fecha de inicio usando el endpoint closed-pnl.
   * Fetches blocks in PARALLEL for fast response (5s instead of 30s).
   */
  private async fetchBlockPnl(
    apiKey: string, apiSecret: string, recvWindow: string,
    blockStart: number, blockEnd: number
  ): Promise<{ btc: number; eth: number; sol: number; xrp: number; bnb: number }> {
    const result = { btc: 0, eth: 0, sol: 0, xrp: 0, bnb: 0 };
    let cursor = '';
    let hasNext = true;
    let pages = 0;

    while (hasNext && pages < 15) {
      let qs = `category=linear&limit=100&startTime=${blockStart}&endTime=${blockEnd}`;
      if (cursor) qs += `&cursor=${encodeURIComponent(cursor)}`;
      const ts = Date.now().toString();
      const sign = crypto.createHmac('sha256', apiSecret).update(ts + apiKey + recvWindow + qs).digest('hex');

      try {
        const res = await axios.get(`https://api.bybit.com/v5/position/closed-pnl?${qs}`, {
          headers: { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': ts, 'X-BAPI-SIGN': sign, 'X-BAPI-RECV-WINDOW': recvWindow },
          timeout: 8000
        });

        if (res.data?.retCode === 0) {
          const list = res.data.result.list || [];
          for (const item of list) {
            const pnl = parseFloat(item.closedPnl || '0');
            if (item.symbol === 'BTCUSDT') result.btc += pnl;
            else if (item.symbol === 'ETHUSDT') result.eth += pnl;
            else if (item.symbol === 'SOLUSDT') result.sol += pnl;
            else if (item.symbol === 'XRPUSDT') result.xrp += pnl;
            else if (item.symbol === 'BNBUSDT') result.bnb += pnl;
          }
          cursor = res.data.result.nextPageCursor || '';
          hasNext = !!(cursor && list.length >= 100);
        } else {
          hasNext = false;
        }
      } catch {
        hasNext = false;
      }
      pages++;
    }
    return result;
  }

  private async fetchTotalClosedPnlSince(
    apiKey: string,
    apiSecret: string,
    sinceMs: number
  ): Promise<{ btc: number; eth: number; sol: number; xrp: number; bnb: number }> {
    const recvWindow = '10000';
    const dayMs = 24 * 60 * 60 * 1000;

    const blocks: { start: number; end: number }[] = [];
    let currentEnd = Date.now();
    while (currentEnd > sinceMs) {
      const blockStart = Math.max(currentEnd - 7 * dayMs, sinceMs);
      blocks.push({ start: blockStart, end: currentEnd });
      currentEnd = blockStart;
    }

    const blockResults = await Promise.all(
      blocks.map(b => this.fetchBlockPnl(apiKey, apiSecret, recvWindow, b.start, b.end))
    );

    return blockResults.reduce(
      (acc, r) => ({ btc: acc.btc + r.btc, eth: acc.eth + r.eth, sol: acc.sol + r.sol, xrp: acc.xrp + r.xrp, bnb: acc.bnb + r.bnb }),
      { btc: 0, eth: 0, sol: 0, xrp: 0, bnb: 0 }
    );
  }

  async createUser(data: { alias: string, email?: string, password?: string, btcCapitalAllocated: number, ethCapitalAllocated: number, solCapitalAllocated?: number, xrpCapitalAllocated?: number, btcEnabled: boolean, ethEnabled: boolean, solEnabled?: boolean, xrpEnabled?: boolean, apiKey?: string, apiSecret?: string, isSimulation?: boolean, p2pEnabled?: boolean }) {
    try {
      let encryptedSecret = '';
      let offsets = {btcCumRealized: 0, ethCumRealized: 0, solCumRealized: 0, xrpCumRealized: 0};
      
      const cleanApiKey = data.apiKey?.trim() || '';
      const cleanApiSecret = data.apiSecret?.trim() || '';

      if (!data.isSimulation && cleanApiKey && cleanApiSecret) {
         encryptedSecret = this.cryptoService.encrypt(cleanApiSecret);
         offsets = await this.fetchCumRealized(cleanApiKey, encryptedSecret);
      }
      
      const totalCap = Number(data.btcCapitalAllocated) + Number(data.ethCapitalAllocated) + Number(data.solCapitalAllocated || 0) + Number(data.xrpCapitalAllocated || 0);
      
      let passwordEntry: string | null = null;
      if (data.password) {
          const salt = crypto.randomBytes(16).toString('hex');
          const hash = this.authService.hashPassword(data.password, salt);
          passwordEntry = `${salt}:${hash}:force`;
      }

      const user = await prisma.communityUser.create({
        data: {
          alias: data.alias,
          email: data.email && data.email.trim() !== '' ? data.email.trim() : null,
          password: passwordEntry,
          isSimulation: data.isSimulation || false,
          capitalAllocated: totalCap,
          btcCapitalAllocated: data.btcCapitalAllocated || 0,
          ethCapitalAllocated: data.ethCapitalAllocated || 0,
          solCapitalAllocated: data.solCapitalAllocated || 0,
          xrpCapitalAllocated: data.xrpCapitalAllocated || 0,
          btcOffset: offsets.btcCumRealized,
          ethOffset: offsets.ethCumRealized,
          solOffset: offsets.solCumRealized,
          xrpOffset: offsets.xrpCumRealized,
          btcEnabled: data.btcEnabled ?? true,
          ethEnabled: data.ethEnabled ?? false,
          solEnabled: data.solEnabled ?? false,
          xrpEnabled: data.xrpEnabled ?? false,
          p2pEnabled: data.p2pEnabled ?? false,
          ...(!data.isSimulation && cleanApiKey ? {
             bybitKeys: {
               create: {
                 apiKey: cleanApiKey,
                 apiSecretEnc: encryptedSecret
               }
             }
          } : {})
        },
        include: { bybitKeys: true }
      });
      return user;
    } catch (e) {
      console.error("Error creating community user:", e);
      throw new InternalServerErrorException("Failed to create community user");
    }
  }

  async getLiveUiDataForUser(id: number) {
     const u = await prisma.communityUser.findUnique({
        where: { id },
        include: { bybitKeys: true }
     });
     if (!u) return null;

     // Leer campos DCA (no estan en el schema Prisma) via raw SQL
     const [dcaRow] = await prisma.$queryRawUnsafe<any[]>(
       `SELECT dca_enabled, dca_pct, dca_pending_usdt, dca_btc_accumulated FROM p2p.community_user WHERE id = $1`,
       id
     ).catch(() => [{}]);
     if (dcaRow) {
       (u as any).dcaEnabled        = dcaRow.dca_enabled        ?? false;
       (u as any).dcaPct            = Number(dcaRow.dca_pct ?? 20);
       (u as any).dcaPendingUsdt    = Number(dcaRow.dca_pending_usdt ?? 0);
       (u as any).dcaBtcAccumulated = Number(dcaRow.dca_btc_accumulated ?? 0);
     }
     let livePnl = Number((u as any).virtualPnl || 0);
     let realizedPnl = Number((u as any).virtualPnl || 0);
     let unrealizedPnl = 0;
     let btcUnrealized = 0, ethUnrealized = 0, solUnrealized = 0, xrpUnrealized = 0;
     let btcCumRealized = 0, ethCumRealized = 0, solCumRealized = 0, xrpCumRealized = 0;
     let btcSessionRealized = Number((u as any).btcVirtualPnl || 0);
     let ethSessionRealized = Number((u as any).ethVirtualPnl || 0);
     let solSessionRealized = Number((u as any).solVirtualPnl || 0);
     let xrpSessionRealized = Number((u as any).xrpVirtualPnl || 0);
     let bnbSessionRealized = 0;

     const btcBaseCapital = Number((u as any).btcCapitalAllocated) || 0;
     const ethBaseCapital = Number((u as any).ethCapitalAllocated) || 0;
     const solBaseCapital = Number((u as any).solCapitalAllocated) || 0;
     const xrpBaseCapital = Number((u as any).xrpCapitalAllocated) || 0;
     const bnbBaseCapital = Number((u as any).bnbCapitalAllocated) || 0;
     const totalBaseCapital = Number(u.capitalAllocated) || (btcBaseCapital + ethBaseCapital + solBaseCapital + xrpBaseCapital + bnbBaseCapital);

     let currentEquity = totalBaseCapital + livePnl;
     let roiPercentage = totalBaseCapital > 0 ? (realizedPnl / totalBaseCapital) * 100 : 0;

     const apiKey = u.bybitKeys[0]?.apiKey;
     const apiSecretEnc = u.bybitKeys[0]?.apiSecretEnc;

     if (apiKey && apiSecretEnc && u.status === 'ACTIVE') {
        try {
           const apiSecret = this.cryptoService.decrypt(apiSecretEnc);
           const recvWindow = '10000';

           const [walletRes, posRes, closedPnl] = await Promise.all([
              (() => {
                 const ts = Date.now().toString();
                 const qs = 'accountType=UNIFIED&coin=USDT';
                 const sig = crypto.createHmac('sha256', apiSecret).update(ts + apiKey + recvWindow + qs).digest('hex');
                 return axios.get(`https://api.bybit.com/v5/account/wallet-balance?${qs}`, {
                    headers: { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': ts, 'X-BAPI-SIGN': sig, 'X-BAPI-RECV-WINDOW': recvWindow },
                    timeout: 8000
                 });
              })(),
              (() => {
                 const ts = Date.now().toString();
                 const qs = 'category=linear&settleCoin=USDT';
                 const sig = crypto.createHmac('sha256', apiSecret).update(ts + apiKey + recvWindow + qs).digest('hex');
                 return axios.get(`https://api.bybit.com/v5/position/list?${qs}`, {
                    headers: { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': ts, 'X-BAPI-SIGN': sig, 'X-BAPI-RECV-WINDOW': recvWindow },
                    timeout: 8000
                 });
              })(),
              this.fetchTotalClosedPnlSince(
                 apiKey.trim(), this.cryptoService.decrypt(apiSecretEnc).trim(),
                 new Date((u as any).botStartDate || u.createdAt).getTime()
              )
           ]);

           if (walletRes.data?.retCode === 0) {
              const coinDetail = walletRes.data.result.list[0]?.coin?.find((c: any) => c.coin === 'USDT');
              if (coinDetail) {
                 currentEquity = parseFloat(coinDetail.equity || '0');
                 unrealizedPnl = parseFloat(coinDetail.unrealisedPnl || '0');
              }
           }

           if (posRes.data?.retCode === 0) {
              for (const pos of (posRes.data.result.list || [])) {
                 if (pos.symbol === 'BTCUSDT') { btcUnrealized += parseFloat(pos.unrealisedPnl || '0'); btcCumRealized += parseFloat(pos.cumRealisedPnl || '0'); }
                 if (pos.symbol === 'ETHUSDT') { ethUnrealized += parseFloat(pos.unrealisedPnl || '0'); ethCumRealized += parseFloat(pos.cumRealisedPnl || '0'); }
                 if (pos.symbol === 'SOLUSDT') { solUnrealized += parseFloat(pos.unrealisedPnl || '0'); solCumRealized += parseFloat(pos.cumRealisedPnl || '0'); }
                 if (pos.symbol === 'XRPUSDT') { xrpUnrealized += parseFloat(pos.unrealisedPnl || '0'); xrpCumRealized += parseFloat(pos.cumRealisedPnl || '0'); }
              }
           }

           btcSessionRealized = closedPnl.btc;
           ethSessionRealized = closedPnl.eth;
           solSessionRealized = closedPnl.sol;
           xrpSessionRealized = closedPnl.xrp;
           bnbSessionRealized = closedPnl.bnb;
           realizedPnl = btcSessionRealized + ethSessionRealized + solSessionRealized + xrpSessionRealized + bnbSessionRealized;
           roiPercentage = totalBaseCapital > 0 ? (realizedPnl / totalBaseCapital) * 100 : 0;
           livePnl = realizedPnl + unrealizedPnl;
           currentEquity = totalBaseCapital + livePnl;
        } catch (e) {
           console.error(`[getLiveUiDataForUser] Error for ${u.alias}:`, e.message);
        }
     }

     let btcRoi = 0, ethRoi = 0, solRoi = 0, xrpRoi = 0, bnbRoi = 0;
     if (btcBaseCapital > 0) btcRoi = (btcSessionRealized / btcBaseCapital) * 100;
     if (ethBaseCapital > 0) ethRoi = (ethSessionRealized / ethBaseCapital) * 100;
     if (solBaseCapital > 0) solRoi = (solSessionRealized / solBaseCapital) * 100;
     if (xrpBaseCapital > 0) xrpRoi = (xrpSessionRealized / xrpBaseCapital) * 100;
     if (bnbBaseCapital > 0) bnbRoi = (bnbSessionRealized / bnbBaseCapital) * 100;

     return {
        id: u.id,
        alias: u.alias,
        email: u.email,
        // capitalAllocated = suma real de activos (nunca el campo legacy desactualizado)
        capitalAllocated: (btcBaseCapital + ethBaseCapital + solBaseCapital + xrpBaseCapital + bnbBaseCapital) || totalBaseCapital || Number(u.capitalAllocated),
        btcCapitalAllocated: btcBaseCapital,
        ethCapitalAllocated: ethBaseCapital,
        solCapitalAllocated: solBaseCapital,
        xrpCapitalAllocated: xrpBaseCapital,
        bnbCapitalAllocated: bnbBaseCapital,
        ethEnabled: (u as any).ethEnabled,
        btcEnabled: (u as any).btcEnabled,
        solEnabled: (u as any).solEnabled || false,
        xrpEnabled: (u as any).xrpEnabled || false,
        bnbEnabled: (u as any).bnbEnabled || false,
        p2pEnabled: (u as any).p2pEnabled || false,
        // — Tesoro BTC / DCA —
        dcaEnabled: (u as any).dcaEnabled || false,
        dcaPct: Number((u as any).dcaPct || 20),
        dcaPendingUsdt: Number((u as any).dcaPendingUsdt || 0),
        dcaBtcAccumulated: Number((u as any).dcaBtcAccumulated || 0),
        isSimulation: (u as any).isSimulation,
        status: u.status,
        createdAt: u.createdAt,
        currentEquity,
        livePnl,
        realizedPnl,
        unrealizedPnl,
        roiPercentage,
        btcRoi, ethRoi, solRoi, xrpRoi, bnbRoi,
        btcRealized: btcSessionRealized,
        ethRealized: ethSessionRealized,
        solRealized: solSessionRealized,
        xrpRealized: xrpSessionRealized,
        bnbRealized: bnbSessionRealized,
        btcTotalPnl: btcUnrealized + btcSessionRealized,
        ethTotalPnl: ethUnrealized + ethSessionRealized,
        solTotalPnl: solUnrealized + solSessionRealized,
        xrpTotalPnl: xrpUnrealized + xrpSessionRealized,
        btcCumRealized, ethCumRealized, solCumRealized, xrpCumRealized
     };
  }

  async getLiveUiData() {
    const users = await prisma.communityUser.findMany({
      include: { bybitKeys: true },
      orderBy: { id: 'asc' }
    });

    // Leer campos DCA de todos los usuarios en una sola query (no estan en schema Prisma)
    const dcaRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, dca_enabled, dca_pct, dca_pending_usdt, dca_btc_accumulated FROM p2p.community_user ORDER BY id ASC`
    ).catch(() => []);
    const dcaMap: Record<number, any> = {};
    for (const row of dcaRows) { dcaMap[Number(row.id)] = row; }
    for (const u of users) {
      const dca = dcaMap[u.id] || {};
      (u as any).dcaEnabled        = dca.dca_enabled        ?? false;
      (u as any).dcaPct            = Number(dca.dca_pct ?? 20);
      (u as any).dcaPendingUsdt    = Number(dca.dca_pending_usdt ?? 0);
      (u as any).dcaBtcAccumulated = Number(dca.dca_btc_accumulated ?? 0);
    }

    // Consultamos saldos dinámicos
    const uiUsers = await Promise.all(users.map(async (u) => {
      let livePnl = Number((u as any).virtualPnl || 0);
      let realizedPnl = Number((u as any).virtualPnl || 0);
      let unrealizedPnl = 0;
      let currentEquity = Number(u.capitalAllocated) + livePnl;
      let roiPercentage = Number(u.capitalAllocated) > 0 ? (realizedPnl / Number(u.capitalAllocated)) * 100 : 0;
      
      let btcUnrealized = 0, ethUnrealized = 0, solUnrealized = 0, xrpUnrealized = 0;
      let btcCumRealized = 0, ethCumRealized = 0, solCumRealized = 0, xrpCumRealized = 0;
      
      let btcSessionRealized = Number((u as any).btcVirtualPnl || 0);
      let ethSessionRealized = Number((u as any).ethVirtualPnl || 0);
      let solSessionRealized = Number((u as any).solVirtualPnl || 0);
      let xrpSessionRealized = Number((u as any).xrpVirtualPnl || 0);
      let bnbSessionRealized = 0;
      
      const apiKey = u.bybitKeys[0]?.apiKey;
      const apiSecretEnc = u.bybitKeys[0]?.apiSecretEnc;
      
      if (apiKey && apiSecretEnc && u.status === 'ACTIVE') {
         try {
           const apiSecret = this.cryptoService.decrypt(apiSecretEnc);
           const timestamp = Date.now().toString();
           const recvWindow = '10000';
           
           // Fetch Wallet Balance
           const qs = 'accountType=UNIFIED&coin=USDT';
           const signString = timestamp + apiKey + recvWindow + qs;
           const signature = crypto.createHmac('sha256', apiSecret).update(signString).digest('hex');
           
           const req = await axios.get(`https://api.bybit.com/v5/account/wallet-balance?${qs}`, {
             headers: {
               'X-BAPI-API-KEY': apiKey,
               'X-BAPI-TIMESTAMP': timestamp,
               'X-BAPI-SIGN': signature,
               'X-BAPI-RECV-WINDOW': recvWindow
             },
             timeout: 5000
           });
           
           if (req.data?.retCode === 0) {
             const coinDetails = req.data.result.list[0]?.coin?.find((c:any) => c.coin === 'USDT');
             if (coinDetails) {
               currentEquity = parseFloat(coinDetails.equity);
               livePnl = currentEquity - Number(u.capitalAllocated);
               unrealizedPnl = parseFloat(coinDetails.unrealisedPnl || '0');
               realizedPnl = livePnl - unrealizedPnl;
               if (Number(u.capitalAllocated) > 0) {
                  roiPercentage = (realizedPnl / Number(u.capitalAllocated)) * 100;
               }
             }
           }
           
           // Fetch Positions for Breakdown
           const timestampPos = Date.now().toString();
           const qsPos = 'category=linear&settleCoin=USDT';
           const signStringPos = timestampPos + apiKey + recvWindow + qsPos;
           const signaturePos = crypto.createHmac('sha256', apiSecret).update(signStringPos).digest('hex');
           
           const reqPos = await axios.get(`https://api.bybit.com/v5/position/list?${qsPos}`, {
             headers: { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': timestampPos, 'X-BAPI-SIGN': signaturePos, 'X-BAPI-RECV-WINDOW': recvWindow },
             timeout: 5000
           });
           
           if (reqPos.data?.retCode === 0) {
              const posList = reqPos.data.result.list || [];
              for (const pos of posList) {
                  if (pos.symbol === 'BTCUSDT') {
                      btcUnrealized += parseFloat(pos.unrealisedPnl || '0');
                      btcCumRealized += parseFloat(pos.cumRealisedPnl || '0');
                  }
                  if (pos.symbol === 'ETHUSDT') {
                      ethUnrealized += parseFloat(pos.unrealisedPnl || '0');
                      ethCumRealized += parseFloat(pos.cumRealisedPnl || '0');
                  }
                  if (pos.symbol === 'SOLUSDT') {
                      solUnrealized += parseFloat(pos.unrealisedPnl || '0');
                      solCumRealized += parseFloat(pos.cumRealisedPnl || '0');
                  }
                  if (pos.symbol === 'XRPUSDT') {
                      xrpUnrealized += parseFloat(pos.unrealisedPnl || '0');
                      xrpCumRealized += parseFloat(pos.cumRealisedPnl || '0');
                  }
              }
           }
         } catch (e) {
           console.error(`Error auth bybit para ${u.alias}:`, e.message);
         }
      }
      
      // Capital base original (inmutable). Se usa como denominador de todos los ROI.
      // capitalAllocated se fija en la creación y NUNCA cambia con el compounding del bot.
      const btcBaseCapital  = Number((u as any).btcCapitalAllocated)  || 0;
      const ethBaseCapital  = Number((u as any).ethCapitalAllocated)  || 0;
      const solBaseCapital  = Number((u as any).solCapitalAllocated)  || 0;
      const xrpBaseCapital  = Number((u as any).xrpCapitalAllocated)  || 0;
      const bnbBaseCapital  = Number((u as any).bnbCapitalAllocated)  || 0;
      const totalBaseCapital = Number(u.capitalAllocated) || (btcBaseCapital + ethBaseCapital + solBaseCapital + xrpBaseCapital + bnbBaseCapital);
      
      if (apiKey && apiSecretEnc && u.status === 'ACTIVE') {
         // Ganancia realizada real = suma del endpoint closed-pnl desde la fecha de registro del usuario.
         // Usamos createdAt de cada usuario para capturar solo desde que empezó en el sistema.
         // (telecambios-ve10k tiene su createdAt actualizado a su fecha real de inicio 2026-03-01)
         const apiSecret = this.cryptoService.decrypt(apiSecretEnc);
         const sinceMs = new Date((u as any).botStartDate || u.createdAt).getTime();
         const closedPnl = await this.fetchTotalClosedPnlSince(apiKey.trim(), apiSecret.trim(), sinceMs);

         btcSessionRealized = closedPnl.btc;
         ethSessionRealized = closedPnl.eth;
         solSessionRealized = closedPnl.sol;
         xrpSessionRealized = closedPnl.xrp;
         bnbSessionRealized = closedPnl.bnb;

         realizedPnl = btcSessionRealized + ethSessionRealized + solSessionRealized + xrpSessionRealized + bnbSessionRealized;
         roiPercentage = totalBaseCapital > 0 ? (realizedPnl / totalBaseCapital) * 100 : 0;
         livePnl = realizedPnl + unrealizedPnl;
         currentEquity = totalBaseCapital + livePnl;
      }

      const btcTotalPnl = btcUnrealized + btcSessionRealized;
      const ethTotalPnl = ethUnrealized + ethSessionRealized;
      const solTotalPnl = solUnrealized + solSessionRealized;
      const xrpTotalPnl = xrpUnrealized + xrpSessionRealized;
      
      let btcRoi = 0, ethRoi = 0, solRoi = 0, xrpRoi = 0, bnbRoi = 0;
      if (btcBaseCapital > 0) btcRoi = (btcSessionRealized / btcBaseCapital) * 100;
      if (ethBaseCapital > 0) ethRoi = (ethSessionRealized / ethBaseCapital) * 100;
      if (solBaseCapital > 0) solRoi = (solSessionRealized / solBaseCapital) * 100;
      if (xrpBaseCapital > 0) xrpRoi = (xrpSessionRealized / xrpBaseCapital) * 100;
      if (bnbBaseCapital > 0) bnbRoi = (bnbSessionRealized / bnbBaseCapital) * 100;

      return {
        id: u.id,
        alias: u.alias,
        email: u.email,
        // capitalAllocated = suma real de activos (nunca el campo legacy desactualizado)
        capitalAllocated: (btcBaseCapital + ethBaseCapital + solBaseCapital + xrpBaseCapital + bnbBaseCapital) || totalBaseCapital || Number(u.capitalAllocated),
        btcCapitalAllocated: btcBaseCapital,
        ethCapitalAllocated: ethBaseCapital,
        solCapitalAllocated: solBaseCapital,
        xrpCapitalAllocated: xrpBaseCapital,
        bnbCapitalAllocated: bnbBaseCapital,
        ethEnabled: (u as any).ethEnabled,
        btcEnabled: (u as any).btcEnabled,
        solEnabled: (u as any).solEnabled || false,
        xrpEnabled: (u as any).xrpEnabled || false,
        bnbEnabled: (u as any).bnbEnabled || false,
        p2pEnabled: (u as any).p2pEnabled || false,
        // — Tesoro BTC / DCA —
        dcaEnabled: (u as any).dcaEnabled || false,
        dcaPct: Number((u as any).dcaPct || 20),
        dcaPendingUsdt: Number((u as any).dcaPendingUsdt || 0),
        dcaBtcAccumulated: Number((u as any).dcaBtcAccumulated || 0),
        isSimulation: (u as any).isSimulation,
        status: u.status,
        apiKey: apiKey,
        createdAt: u.createdAt,
        currentEquity,
        livePnl,
        realizedPnl,
        unrealizedPnl,
        roiPercentage,
        btcTotalPnl, btcRoi, btcCumRealized,
        ethTotalPnl, ethRoi, ethCumRealized,
        solTotalPnl, solRoi, solCumRealized,
        xrpTotalPnl, xrpRoi, xrpCumRealized,
        btcRealized: btcSessionRealized,
        ethRealized: ethSessionRealized,
        solRealized: solSessionRealized,
        xrpRealized: xrpSessionRealized,
        bnbRealized: bnbSessionRealized,
        bnbRoi
      };
    }));
    
    return {
      trend: this.currentMasterTrend,
      users: uiUsers
    };
  }

  // ── DCA: Consulta rápida del PnL semanal (solo 8 días, 1 request a Bybit) ──
  async getWeeklyPnlForDca(userId: number) {
    try {
      const user = await prisma.communityUser.findUnique({
        where: { id: userId }, include: { bybitKeys: true }
      });
      if (!user || !user.bybitKeys[0]) return { success: false, weeklyProfit: 0, dcaEnabled: false };

      const dcaRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT dca_enabled, dca_pct, dca_last_execution FROM p2p.community_user WHERE id = $1`, userId
      ).catch(() => []);
      const dca = dcaRows[0] || {};
      if (!dca.dca_enabled) return { success: true, weeklyProfit: 0, weeklyDcaAmount: 0, dcaEnabled: false };

      const apiKey     = user.bybitKeys[0].apiKey.trim();
      const apiSecret  = this.cryptoService.decrypt(user.bybitKeys[0].apiSecretEnc.trim()).trim();
      const dcaPct     = Number(dca.dca_pct || 20);
      const recvWindow = '10000';

      const now = new Date();
      const todayDay = now.getDay();
      const daysToMon = todayDay === 0 ? 6 : todayDay - 1;
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() - daysToMon);
      thisMonday.setHours(0, 0, 0, 0);

      let startDate: Date, endDate: Date;
      if (todayDay === 1) {
        // Hoy ES lunes: tomar la semana pasada (lun-dom anterior)
        startDate = new Date(thisMonday); startDate.setDate(thisMonday.getDate() - 7);
        endDate   = new Date(thisMonday); endDate.setDate(thisMonday.getDate() - 1); endDate.setHours(23,59,59,999);
      } else {
        startDate = thisMonday;
        endDate   = new Date(now);
      }

      const weekStart = startDate.toISOString().split('T')[0];
      const weekEnd   = endDate.toISOString().split('T')[0];

      // 1 sola llamada a Bybit (8 días caben en 200 resultados normalmente)
      const ts  = Date.now().toString();
      const qs  = `category=linear&limit=200&startTime=${startDate.getTime()}&endTime=${endDate.getTime()}`;
      const sig = require('crypto').createHmac('sha256', apiSecret).update(ts + apiKey + recvWindow + qs).digest('hex');
      const resp = await axios.get(`https://api.bybit.com/v5/position/closed-pnl?${qs}`, {
        headers: { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': ts, 'X-BAPI-SIGN': sig, 'X-BAPI-RECV-WINDOW': recvWindow },
        timeout: 8000
      });

      let weeklyProfit = 0;
      if (resp.data?.retCode === 0) {
        for (const item of resp.data.result.list || []) {
          weeklyProfit += parseFloat(item.closedPnl || '0');
        }
      }
      const weeklyDcaAmount = Math.max(0, weeklyProfit * (dcaPct / 100));
      console.log(`[WeeklyDca] User ${userId}: semana ${weekStart}->${weekEnd} profit=$${weeklyProfit.toFixed(2)} dca=$${weeklyDcaAmount.toFixed(2)}`);
      return { success: true, dcaEnabled: true, dcaPct, weeklyProfit: Math.max(0, weeklyProfit), weeklyDcaAmount, weekStart, weekEnd };
    } catch (e) {
      console.error('[WeeklyDca] Error:', e.message);
      return { success: false, weeklyProfit: 0, dcaEnabled: false };
    }
  }

  async getInternalUsersForPy() {
    // Endpoints for the distributed python architecture
    const users = await prisma.communityUser.findMany({
      where: { status: 'ACTIVE' },
      include: { bybitKeys: true }
    });

    // Leer campos DCA en una sola query (no estan en schema Prisma)
    const dcaRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, dca_enabled, dca_pct, dca_pending_usdt, dca_btc_accumulated, dca_last_execution
       FROM p2p.community_user WHERE status = 'ACTIVE'`
    ).catch(() => []);
    const dcaMap: Record<number, any> = {};
    for (const row of dcaRows) { dcaMap[Number(row.id)] = row; }

    return users.map(u => {
      const dca = dcaMap[u.id] || {};
      return {
        id: u.id,
        alias: u.alias,
        isSimulation: (u as any).isSimulation,
        capitalAllocated: Number(u.capitalAllocated),
        btcCapitalAllocated: Number((u as any).btcCapitalAllocated),
        ethCapitalAllocated: Number((u as any).ethCapitalAllocated),
        solCapitalAllocated: Number((u as any).solCapitalAllocated || 0),
        xrpCapitalAllocated: Number((u as any).xrpCapitalAllocated || 0),
        bnbCapitalAllocated: Number((u as any).bnbCapitalAllocated || 0),
        btcEnabled: (u as any).btcEnabled,
        ethEnabled: (u as any).ethEnabled,
        solEnabled: (u as any).solEnabled || false,
        xrpEnabled: (u as any).xrpEnabled || false,
        bnbEnabled: (u as any).bnbEnabled || false,
        p2pEnabled: (u as any).p2pEnabled || false,
        // ── Tesoro BTC / DCA (leido via raw SQL) ──
        dcaEnabled:        dca.dca_enabled        ?? false,
        dcaPct:            Number(dca.dca_pct      ?? 20),
        dcaPendingUsdt:    Number(dca.dca_pending_usdt ?? 0),
        dcaLastExecution:  dca.dca_last_execution  ?? null,
        dcaBtcAccumulated: Number(dca.dca_btc_accumulated ?? 0),
        apiKey:    (u.bybitKeys[0]?.apiKey || "").trim(),
        apiSecret: u.bybitKeys[0]?.apiSecretEnc ? this.cryptoService.decrypt(u.bybitKeys[0].apiSecretEnc).trim() : ""
      };
    });
  }

  // ── DCA Tesoro BTC: Actualiza USDT pendiente acumulado (llamado por el bot cada ciclo) ──
  async updateDcaPending(userId: number, pendingUsdt: number) {
    try {
      // GREATEST: el bot nunca puede bajar el acumulado (proteccion ante reinicios con memoria 0)
      await prisma.$executeRawUnsafe(
        `UPDATE p2p.community_user SET dca_pending_usdt = GREATEST(dca_pending_usdt, $1) WHERE id = $2`,
        pendingUsdt, userId
      );
      return { success: true };
    } catch (e) {
      console.error('Error updateDcaPending:', e.message);
      return { success: false };
    }
  }

  // ── DCA Tesoro BTC: Ajuste manual del pending (Admin) ──
  async setDcaPendingManual(userId: number, pendingUsdt: number) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE p2p.community_user SET dca_pending_usdt = $1 WHERE id = $2`,
        pendingUsdt, userId
      );
      console.log(`[Admin] dca_pending_usdt forzado a ${pendingUsdt} para user ${userId}`);
      return { success: true };
    } catch (e) {
      console.error('Error setDcaPendingManual:', e.message);
      return { success: false };
    }
  }

  // ── DCA Tesoro BTC: Registra una compra DCA ejecutada (llamado por el bot semanal) ──
  async recordDcaPurchase(userId: number, data: {
    usdtSpent: number;
    btcBought: number;
    btcPrice: number;
    weekProfit: number;
    earnStaked: boolean;
  }) {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO p2p.dca_purchase (user_id, usdt_spent, btc_bought, btc_price, week_profit, earn_staked)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        userId, data.usdtSpent, data.btcBought, data.btcPrice, data.weekProfit, data.earnStaked
      );
      // Actualiza el acumulado de BTC y resetea el pending
      await prisma.$executeRawUnsafe(
        `UPDATE p2p.community_user
         SET dca_btc_accumulated = dca_btc_accumulated + $1,
             dca_pending_usdt    = 0,
             dca_last_execution  = NOW()
         WHERE id = $2`,
        data.btcBought, userId
      );
      return { success: true };
    } catch (e) {
      console.error('Error recordDcaPurchase:', e.message);
      return { success: false };
    }
  }

  // ── DCA Tesoro BTC: Dashboard para el portal del usuario ──
  async getDcaDashboard(userId: number) {
    try {
      const user = await prisma.communityUser.findUnique({
        where: { id: userId },
        include: { bybitKeys: true }
      });
      if (!user) return { success: false };

      // Leer campos DCA via raw SQL (no estan en schema Prisma)
      const [dcaRow] = await prisma.$queryRawUnsafe<any[]>(
        `SELECT dca_enabled, dca_pct, dca_pending_usdt, dca_btc_accumulated FROM p2p.community_user WHERE id = $1`,
        userId
      ).catch(() => [{}]);
      if (dcaRow) {
        (user as any).dcaEnabled        = dcaRow.dca_enabled        ?? false;
        (user as any).dcaPct            = Number(dcaRow.dca_pct ?? 20);
        (user as any).dcaPendingUsdt    = Number(dcaRow.dca_pending_usdt ?? 0);
        (user as any).dcaBtcAccumulated = Number(dcaRow.dca_btc_accumulated ?? 0);
      }

      // Historial de compras
      const history = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, usdt_spent, btc_bought, btc_price, earn_staked, executed_at
         FROM p2p.dca_purchase
         WHERE user_id = $1
         ORDER BY executed_at DESC
         LIMIT 50`,
        userId
      );

      const btcAccumulated = Number((user as any).dcaBtcAccumulated || 0);
      const dcaPct         = Number((user as any).dcaPct || 20);
      const dcaEnabled     = (user as any).dcaEnabled || false;

      // ── Calcular ganancia de la semana cerrada (Lun-Dom pasados) desde DailyPnL ──
      let weeklyProfit = 0;
      let weekStart = '';
      let weekEnd = '';
      try {
        const pnlResult = await this.getDailyPnL(userId);
        if (pnlResult.success && pnlResult.data) {
          const now = new Date();
          const today = now.getDay(); // 0=Dom, 1=Lun...
          // Calcular el lunes de la semana PASADA
          const daysToLastMon = today === 0 ? 6 : today - 1; // dias desde el lunes de esta semana
          const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - daysToLastMon); thisMonday.setHours(0,0,0,0);
          const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
          const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1);
          weekStart = lastMonday.toISOString().split('T')[0];
          weekEnd   = lastSunday.toISOString().split('T')[0];
          for (const [dateStr, amount] of Object.entries(pnlResult.data)) {
            if (dateStr >= weekStart && dateStr <= weekEnd) {
              weeklyProfit += Number(amount);
            }
          }
          // Si hoy es lunes, la "semana" es la semana que ACABA de terminar (ayer=dom)
          // Si estamos a mitad de semana, mostramos la semana en curso (Mon->hoy)
          if (today !== 1) {
            // Semana en curso (para mostrar en el dashboard)
            const thisWeekStart = thisMonday.toISOString().split('T')[0];
            const todayStr = now.toISOString().split('T')[0];
            let currentWeekProfit = 0;
            for (const [dateStr, amount] of Object.entries(pnlResult.data)) {
              if (dateStr >= thisWeekStart && dateStr <= todayStr) {
                currentWeekProfit += Number(amount);
              }
            }
            weeklyProfit = currentWeekProfit;
            weekStart = thisWeekStart;
            weekEnd = todayStr;
          }
        }
      } catch (e) { /* no-op si falla, weeklyProfit queda 0 */ }

      const weeklyDcaAmount = Math.max(0, weeklyProfit * (dcaPct / 100));

      // Calcular precio promedio de compra
      let totalUsdtSpent = 0;
      let totalBtcBought = 0;
      let earnStakedCount = 0;
      for (const h of history) {
        totalUsdtSpent += Number(h.usdt_spent);
        totalBtcBought += Number(h.btc_bought);
        if (h.earn_staked) earnStakedCount++;
      }
      const avgBuyPrice = totalBtcBought > 0 ? totalUsdtSpent / totalBtcBought : 0;

      // Precio actual de BTC via Bybit pública
      let btcCurrentPrice = 0;
      try {
        const tickerRes = await axios.get(
          'https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT',
          { timeout: 5000 }
        );
        btcCurrentPrice = parseFloat(tickerRes.data?.result?.list?.[0]?.lastPrice || '0');
      } catch { /* no-op */ }

      const btcValueUsdt     = btcAccumulated * btcCurrentPrice;
      const unrealizedPnlPct = avgBuyPrice > 0 ? ((btcCurrentPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;
      let earnYieldUsdt = 0;
      if (history.length > 0) {
        const firstPurchase = new Date(history[history.length - 1].executed_at);
        const daysHeld = (Date.now() - firstPurchase.getTime()) / (1000 * 60 * 60 * 24);
        earnYieldUsdt = btcValueUsdt * 0.015 * (daysHeld / 365);
      }

      return {
        success: true,
        dcaEnabled,
        dcaPct,
        btcAccumulated,
        btcCurrentPrice,
        btcValueUsdt,
        avgBuyPrice,
        unrealizedPnlPct,
        totalUsdtInvested: totalUsdtSpent,
        earnYieldUsdt,
        // ── Nuevos campos: semana y DCA calculado ──
        weeklyProfit: Math.max(0, weeklyProfit),
        weeklyDcaAmount,
        weekStart,
        weekEnd,
        pendingUsdt: weeklyDcaAmount,   // alias para compatibilidad con UI existente
        dcaMinTrigger: 100,
        history: history.map(h => ({
          id: h.id,
          usdtSpent: Number(h.usdt_spent),
          btcBought: Number(h.btc_bought),
          btcPrice:  Number(h.btc_price),
          earnStaked: h.earn_staked,
          date: h.executed_at
        }))
      };
    } catch (e) {
      console.error('Error getDcaDashboard:', e.message);
      return { success: false, message: e.message };
    }
  }

  // ── DCA Tesoro BTC: Toggle admin ──
  async updateDcaSettings(userId: number, data: { dcaEnabled?: boolean; dcaPct?: number }) {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      if (data.dcaEnabled !== undefined) { fields.push(`dca_enabled = $${values.length + 1}`); values.push(data.dcaEnabled); }
      if (data.dcaPct     !== undefined) { fields.push(`dca_pct     = $${values.length + 1}`); values.push(data.dcaPct); }
      if (!fields.length) return { success: true };
      values.push(userId);
      await prisma.$executeRawUnsafe(
        `UPDATE p2p.community_user SET ${fields.join(', ')} WHERE id = $${values.length}`,
        ...values
      );
      return { success: true };
    } catch (e) {
      console.error('Error updateDcaSettings:', e.message);
      return { success: false };
    }
  }

  async updateVirtualPnl(userId: number, symbol: string, virtualPnl: number) {
    try {
       const user = await prisma.communityUser.findUnique({ where: { id: userId } });
       if (!user) return;
       
       let updateData: any = {};
       if (symbol === 'BTCUSDT') {
           updateData.btcVirtualPnl = virtualPnl;
       } else if (symbol === 'ETHUSDT') {
           updateData.ethVirtualPnl = virtualPnl;
       } else if (symbol === 'SOLUSDT') {
           updateData.solVirtualPnl = virtualPnl;
       } else if (symbol === 'XRPUSDT') {
           updateData.xrpVirtualPnl = virtualPnl;
       }
       
       updateData.virtualPnl = (
         (symbol === 'BTCUSDT' ? virtualPnl : Number((user as any).btcVirtualPnl || 0)) +
         (symbol === 'ETHUSDT' ? virtualPnl : Number((user as any).ethVirtualPnl || 0)) +
         (symbol === 'SOLUSDT' ? virtualPnl : Number((user as any).solVirtualPnl || 0)) +
         (symbol === 'XRPUSDT' ? virtualPnl : Number((user as any).xrpVirtualPnl || 0))
       );
                               
       await prisma.communityUser.update({
           where: { id: userId },
           data: updateData
       });
       return { success: true };
    } catch(e) {
       console.error("Error updating virtual pnl", e);
    }
  }

  async updateCredentials(id: number, data: { email?: string, password?: string }) {
     try {
       let updateData: any = {};
       if (data.email !== undefined) {
          updateData.email = data.email.trim() !== '' ? data.email.trim() : null;
       }
       if (data.password) {
          const salt = crypto.randomBytes(16).toString('hex');
          const hash = this.authService.hashPassword(data.password, salt);
          updateData.password = `${salt}:${hash}:force`;
       }
       
       if (Object.keys(updateData).length > 0) {
          return await prisma.communityUser.update({
             where: { id },
             data: updateData
          });
       }
       return { success: true };
     } catch (e) {
       console.error("Error updates credentials", e);
       throw new InternalServerErrorException("Failed to update credentials");
     }
  }

  async updateCapital(id: number, data: { btcCapitalAllocated: number, ethCapitalAllocated: number, solCapitalAllocated?: number, xrpCapitalAllocated?: number, bnbCapitalAllocated?: number, btcEnabled: boolean, ethEnabled: boolean, solEnabled?: boolean, xrpEnabled?: boolean, bnbEnabled?: boolean, p2pEnabled?: boolean, dcaEnabled?: boolean, dcaPct?: number }) {
    try {
      const user = await prisma.communityUser.findUnique({ where: { id }, include: { bybitKeys: true } });
      let newBtcOffset = (user as any)?.btcOffset || 0;
      let newEthOffset = (user as any)?.ethOffset || 0;
      let newSolOffset = (user as any)?.solOffset || 0;
      let newXrpOffset = (user as any)?.xrpOffset || 0;
      let newBnbOffset = (user as any)?.bnbOffset || 0;
      
      if (user && user.bybitKeys[0]) {
         const offsets = await this.fetchCumRealized(user.bybitKeys[0].apiKey, user.bybitKeys[0].apiSecretEnc);
         if ((!user.btcEnabled && data.btcEnabled) || Number(user.btcCapitalAllocated) !== Number(data.btcCapitalAllocated)) {
             newBtcOffset = offsets.btcCumRealized;
         }
         if ((!user.ethEnabled && data.ethEnabled) || Number(user.ethCapitalAllocated) !== Number(data.ethCapitalAllocated)) {
             newEthOffset = offsets.ethCumRealized;
         }
         if ((!(user as any).solEnabled && data.solEnabled) || Number((user as any).solCapitalAllocated) !== Number(data.solCapitalAllocated)) {
             newSolOffset = offsets.solCumRealized;
         }
         if ((!(user as any).xrpEnabled && data.xrpEnabled) || Number((user as any).xrpCapitalAllocated) !== Number(data.xrpCapitalAllocated)) {
             newXrpOffset = offsets.xrpCumRealized;
         }
         if ((!(user as any).bnbEnabled && data.bnbEnabled) || Number((user as any).bnbCapitalAllocated) !== Number(data.bnbCapitalAllocated)) {
             newBnbOffset = offsets.bnbCumRealized;
         }
      }

      const totalCap = Number(data.btcCapitalAllocated) + Number(data.ethCapitalAllocated) + Number(data.solCapitalAllocated || 0) + Number(data.xrpCapitalAllocated || 0) + Number(data.bnbCapitalAllocated || 0);
      
      // Update all standard fields via Prisma ORM
      await prisma.communityUser.update({
        where: { id },
        data: { 
           capitalAllocated: totalCap,
           btcCapitalAllocated: data.btcCapitalAllocated,
           ethCapitalAllocated: data.ethCapitalAllocated,
           solCapitalAllocated: data.solCapitalAllocated || 0,
           xrpCapitalAllocated: data.xrpCapitalAllocated || 0,
           btcEnabled: data.btcEnabled,
           ethEnabled: data.ethEnabled,
           solEnabled: data.solEnabled ?? false,
           xrpEnabled: data.xrpEnabled ?? false,
           p2pEnabled: data.p2pEnabled ?? false,
           btcOffset: newBtcOffset,
           ethOffset: newEthOffset,
           solOffset: newSolOffset,
           xrpOffset: newXrpOffset,
        }
      });

      // Update BNB fields via raw SQL to guarantee persistence
      // (Prisma generated client may not include these columns if schema wasn't regenerated)
      await prisma.$executeRawUnsafe(
        `UPDATE p2p.community_user 
         SET bnb_capital_allocated = $1, bnb_enabled = $2, bnb_offset = $3, capital_allocated = $4,
             dca_enabled = $6, dca_pct = $7
         WHERE id = $5`,
        Number(data.bnbCapitalAllocated || 0),
        data.bnbEnabled ?? false,
        newBnbOffset,
        totalCap,
        id,
        data.dcaEnabled ?? false,
        Number(data.dcaPct ?? 20)
      );

      console.log(`[OK] Capital actualizado user ${id}: BNB=${data.bnbEnabled}, DCA=${data.dcaEnabled}(${data.dcaPct}%)`);
      return { success: true };

    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException("Error updating capital");
    }
  }

  async deleteUser(id: number) {
    try {
      return await prisma.communityUser.delete({
        where: { id }
      });
    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException("Error deleting user");
    }
  }
  async getDailyPnL(id: number) {
      try {
          const user = await prisma.communityUser.findUnique({
              where: { id },
              include: { bybitKeys: true }
          });
          
          if (!user || !user.bybitKeys[0]) {
              console.log("[DailyPnL] API Keys not found for user", id);
              return { success: false, message: "API Keys not found" };
          }

          const apiKey = user.bybitKeys[0].apiKey.trim();
          const apiSecretEnc = user.bybitKeys[0].apiSecretEnc.trim();
          const apiSecret = this.cryptoService.decrypt(apiSecretEnc).trim();
          
          const recvWindow = '10000';
          const dailyGroups: Record<string, number> = {};
          
          // Bybit V5 closed-pnl limits time span to 7 days per request if specified.
          // We want 30 days, so we will do 5 blocks of 7 days backwards.
          let currentEndTime = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;
          
          for (let block = 0; block < 5; block++) {
              let startTime = currentEndTime - (7 * dayMs);
              let nextCursor = "";
              let hasNext = true;
              let pageCount = 0;
              
              while (hasNext && pageCount < 20) { // Safety limit of 20 pages per week block
                  let qs = `category=linear&limit=100&startTime=${startTime}&endTime=${currentEndTime}`;
                  if (nextCursor) {
                      qs += `&cursor=${nextCursor}`;
                  }
                  const currentTimestamp = Date.now().toString();
                  const signString = currentTimestamp + apiKey + recvWindow + qs;
                  const signature = crypto.createHmac('sha256', apiSecret).update(signString).digest('hex');
                  
                  const req = await axios.get(`https://api.bybit.com/v5/position/closed-pnl?${qs}`, {
                     headers: {
                         'X-BAPI-API-KEY': apiKey,
                         'X-BAPI-TIMESTAMP': currentTimestamp,
                         'X-BAPI-SIGN': signature,
                         'X-BAPI-RECV-WINDOW': recvWindow
                     },
                     timeout: 5000
                  });
                  
                  if (req.data?.retCode === 0) {
                      const list = req.data.result.list || [];
                      for (const item of list) {
                          const date = new Date(Number(item.updatedTime)); 
                          const dateStr = date.toISOString().split('T')[0];
                          if (!dailyGroups[dateStr]) dailyGroups[dateStr] = 0;
                          dailyGroups[dateStr] += parseFloat(item.closedPnl || '0');
                      }
                      
                      nextCursor = req.data.result.nextPageCursor;
                      if (!nextCursor || list.length < 100) hasNext = false;
                  } else {
                      console.error(`[DailyPnL] ByBit Error for user ${id}:`, req.data);
                      hasNext = false;
                  }
                  pageCount++;
              }
              // Move end time back 7 days for the next block
              currentEndTime = startTime;
          }
          
          return { success: true, data: dailyGroups };
      } catch (e) {
          console.error("Error fetch daily pnl:", e.message, e.response?.data);
          return { success: false, message: "Error conectando con Bybit API V5" };
      }
  }

  async createSpotIncreaseRequest(userId: number, amountUSDT: number, asset: string) {
      try {
          const user = await prisma.communityUser.findUnique({ where: { id: userId } });
          const typeStr = `SPOT_INCREASE_${asset.toUpperCase()}`;
          const request = await prisma.indexInvestmentRequest.create({
              data: {
                  userId,
                  amountUSDT,
                  name: user?.alias || 'Inversor Spot',
                  whatsapp: (user as any)?.whatsapp || 'N/A',
                  type: typeStr,
                  status: 'PENDING'
              }
          });
          return { success: true, request };
      } catch (e) {
          console.error("Error creating spot increase request:", e);
          throw new InternalServerErrorException("Error saving the request");
      }
  }
}
