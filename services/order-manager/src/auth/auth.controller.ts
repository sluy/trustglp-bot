import { Controller, Post, Body, HttpCode, HttpStatus, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() body: any) {
    const loginId = body.loginId || body.email || body.alias;
    if (!loginId || !body.password) {
       return { statusCode: 400, message: 'Bad Request: missing loginId or password' };
    }
    return this.authService.login(loginId, body.password);
  }

  @Get('me')
  async getMe(@Headers('authorization') authHeader: string) {
     if (!authHeader) throw new UnauthorizedException('Missing token');
     const token = authHeader.replace('Bearer ', '').trim();
     try {
       const payload = this.authService.verifyToken(token);
       const user = await prisma.communityUser.findUnique({ where: { id: payload.userId }});
       if (!user) throw new UnauthorizedException('User not found');
       
       return { 
          id: user.id, alias: user.alias, email: user.email, 
          btcCapitalAllocated: (user as any).btcCapitalAllocated,
          ethCapitalAllocated: (user as any).ethCapitalAllocated,
          btcEnabled: (user as any).btcEnabled, ethEnabled: (user as any).ethEnabled,
          virtualPnl: (user as any).virtualPnl, livePnl: (user as any).livePnl || 0, 
          isSimulation: user.isSimulation, createdAt: user.createdAt 
       };
     } catch(e) {
       throw new UnauthorizedException('Invalid token validation');
     }
  }

  @Post('change-password')
  async changePassword(@Headers('authorization') authHeader: string, @Body() body: any) {
     if (!authHeader) throw new UnauthorizedException('Missing token');
     const token = authHeader.replace('Bearer ', '').trim();
     try {
       const payload = this.authService.verifyToken(token);
       if (!body.newPassword) throw new UnauthorizedException('Missing newPassword');
       
       const salt = require('crypto').randomBytes(16).toString('hex');
       const hash = this.authService.hashPassword(body.newPassword, salt);
       
       await prisma.communityUser.update({
           where: { id: payload.userId },
           data: { password: `${salt}:${hash}` } // Notice no ':force'
       });
       
       return { success: true, message: 'Password updated successfully' };
     } catch(e) {
       throw new UnauthorizedException('Invalid token or password sequence');
     }
  }
}

