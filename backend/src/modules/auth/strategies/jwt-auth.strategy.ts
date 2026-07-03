import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { AuthenticatedUser, JwtPayload } from '@tuljai/types';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtAuthStrategy extends PassportStrategy(Strategy, 'jwt') {
  public constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('api.jwt.accessSecret'),
    });
  }

  public validate(payload: JwtPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      isActive: true,
      phoneNumber: payload.phoneNumber,
      roles: payload.roles,
    };
  }
}
