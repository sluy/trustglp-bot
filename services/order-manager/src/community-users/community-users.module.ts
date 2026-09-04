import { Module } from '@nestjs/common';
import { CommunityUsersController } from './community-users.controller';
import { CommunityUsersService } from './community-users.service';
import { AuthModule } from '../auth/auth.module';
import { CryptoService } from '../crypto/crypto.service';

@Module({
  imports: [AuthModule],
  controllers: [CommunityUsersController],
  providers: [CommunityUsersService, CryptoService],
  exports: [CommunityUsersService],
})
export class CommunityUsersModule {}
