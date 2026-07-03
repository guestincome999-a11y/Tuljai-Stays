import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { JwtAuthStrategy } from './strategies/jwt-auth.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  providers: [JwtAuthStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
