import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { AuthenticatedUser, JwtPayload } from '@tuljai/types';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthStrategy extends PassportStrategy(Strategy, 'jwt') {
  public constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('api.jwt.accessSecret'),
    });
  }

  public async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sid) throw new UnauthorizedException('Session authentication required');
    const session = await this.prisma.userSession.findFirst({
      include: { user: true },
      where: {
        refreshTokenId: payload.sid,
        userId: payload.sub,
        isActive: true,
        sessionExpiresAt: { gt: new Date() },
        refreshToken: { revokedAt: null, expiresAt: { gt: new Date() } },
        user: { isActive: true, deletedAt: null },
      },
    });
    if (!session) throw new UnauthorizedException('Session expired or revoked');
    return {
      id: session.user.id,
      isActive: session.user.isActive,
      phoneNumber: session.user.phoneNumber,
      roles: session.user.roles,
    };
  }
}
