import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { CryptoService } from '../crypto/crypto.service';

const prisma = new PrismaClient();

@Injectable()
export class AuthService {
  constructor(private cryptoService: CryptoService) {}

  hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  }

  generateToken(userId: number, role: string): string {
    const payload = JSON.stringify({ userId, role, exp: Date.now() + 86400000 }); // 24 hours
    return this.cryptoService.encrypt(payload);
  }

  verifyToken(token: string): any {
    try {
      const decodedStr = this.cryptoService.decrypt(token);
      const payload = JSON.parse(decodedStr);
      if (payload.exp < Date.now()) throw new Error('Token expired');
      return payload;
    } catch(e) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async login(loginId: string, pass: string) {
     const user = await prisma.communityUser.findFirst({
        where: {
           OR: [
              { email: loginId },
              { alias: loginId }
           ]
        }
     });
     if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid credentials');
     
     let requirePasswordChange = false;
     if (user.password) {
        const parts = user.password.split(':');
        const salt = parts[0];
        const storedHash = parts[1];
        if (parts[2] === 'force') requirePasswordChange = true;
        
        const attemptHash = this.hashPassword(pass, salt);
        if (storedHash !== attemptHash) throw new UnauthorizedException('Invalid credentials');
     } else {
        // First time login logic? If no password, deny unless it's a special setup.
        // For security, if they don't have a password, they can't login until admin sets one.
        throw new UnauthorizedException('Account not fully setup');
     }

     return {
        accessToken: this.generateToken(user.id, user.role),
        requirePasswordChange,
        user: { id: user.id, email: user.email, alias: user.alias, role: user.role }
     };
  }
}
