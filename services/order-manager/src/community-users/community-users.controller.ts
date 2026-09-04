import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { CommunityUsersService } from './community-users.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('community-users')
export class CommunityUsersController {
  constructor(private readonly usersService: CommunityUsersService) {}

  @Post()
  async createUser(@Body() data: any) {
    return this.usersService.createUser(data);
  }

  @Get()
  async getUsers() {
    return this.usersService.getLiveUiData();
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async getMyData(@Req() req) {
     return this.usersService.getLiveUiDataForUser(req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Get('me/debug')
  async getMyDebug(@Req() req) {
     return { resolvedUserId: req.user.userId, role: req.user.role };
  }

  @UseGuards(AuthGuard)
  @Get('me/daily-pnl')
  async getMyDailyPnL(@Req() req) {
     console.log(`[DailyPnL] JWT resolved userId: ${req.user.userId}`);
     const result = await this.usersService.getDailyPnL(req.user.userId);
     console.log(`[DailyPnL] Result for ${req.user.userId}: success=${result.success}, days=${Object.keys(result.data || {}).length}`);
     return result;
  }

  // ── Tesoro BTC / DCA ────────────────────────────────────────────────────────
  @UseGuards(AuthGuard)
  @Get('me/dca-dashboard')
  async getDcaDashboard(@Req() req) {
    return this.usersService.getDcaDashboard(req.user.userId);
  }

  // Bot llama esto cada lunes para obtener el monto DCA de la semana (sin auth, usa userId)
  @Get(':id/weekly-dca')
  async getWeeklyDca(@Param('id') id: string) {
    return this.usersService.getWeeklyPnlForDca(Number(id));
  }

  @UseGuards(AuthGuard)
  @Post('me/spot-increase-request')
  async spotIncreaseRequest(@Req() req, @Body() data: { amountUSDT: number, asset: string }) {
     return this.usersService.createSpotIncreaseRequest(req.user.userId, data.amountUSDT, data.asset);
  }

  @Post('internal/trend')
  async updateTrend(@Body() data: { trend: string }) {
    return this.usersService.updateMasterTrend(data.trend);
  }

  @Patch('internal/virtual-pnl')
  async updateVirtualPnl(@Body() data: { userId: number, symbol: string, virtualPnl: number }) {
    return this.usersService.updateVirtualPnl(data.userId, data.symbol, data.virtualPnl);
  }

  // Bot llama esto cada ciclo para persistir el USDT pendiente de DCA
  @Patch('internal/dca-pending')
  async updateDcaPending(@Body() data: { userId: number; pendingUsdt: number }) {
    return this.usersService.updateDcaPending(data.userId, data.pendingUsdt);
  }

  // Bot llama esto cuando ejecuta una compra DCA semanal
  @Post('internal/dca-purchase')
  async recordDcaPurchase(@Body() data: {
    userId: number;
    usdtSpent: number;
    btcBought: number;
    btcPrice: number;
    weekProfit: number;
    earnStaked: boolean;
  }) {
    return this.usersService.recordDcaPurchase(data.userId, data);
  }

  @Get('internal/bot-payload')
  async getBotPayload() {
    const data = await this.usersService.getInternalUsersForPy();
    return { success: true, active_users: data };
  }

  @Get('internal/migrate-bnb')
  async migrateBnb() {
    return this.usersService.runBnbMigration();
  }

  @Patch(':id/capital')
  async updateCapital(@Param('id') id: string, @Body() data: any) {
    return this.usersService.updateCapital(Number(id), data);
  }

  // Admin: activar/desactivar DCA Tesoro BTC por usuario
  @Patch(':id/dca-settings')
  async updateDcaSettings(@Param('id') id: string, @Body() data: { dcaEnabled?: boolean; dcaPct?: number }) {
    return this.usersService.updateDcaSettings(Number(id), data);
  }

  // Admin: restaurar/ajustar manualmente el USDT pendiente de DCA (recuperacion tras bugs)
  @Patch(':id/dca-pending-admin')
  async setDcaPendingAdmin(@Param('id') id: string, @Body() data: { pendingUsdt: number }) {
    return this.usersService.setDcaPendingManual(Number(id), data.pendingUsdt);
  }

  @Patch(':id/credentials')
  async updateCredentials(@Param('id') id: string, @Body() data: { email?: string, password?: string }) {
    return this.usersService.updateCredentials(Number(id), data);
  }

  @Get('internal/test-pnl/:id')
  async testPnl(@Param('id') id: string) {
    return this.usersService.getDailyPnL(Number(id));
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(Number(id));
  }
}
