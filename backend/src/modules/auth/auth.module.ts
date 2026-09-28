import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { EmailService } from '../../shared/email/email.service';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthStrategy } from './strategies/jwt-auth.strategy';
import { SupabaseAuthService } from './supabase-auth.service';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, EmailService, JwtAuthStrategy, SupabaseAuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
