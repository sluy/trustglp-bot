import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CryptoService } from '../crypto/crypto.service';

@Module({
  providers: [AuthService, CryptoService],
  controllers: [AuthController],
  exports: [AuthService]
})
export class AuthModule {}
