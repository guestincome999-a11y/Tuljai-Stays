import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthStrategy } from './strategies/jwt-auth.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
