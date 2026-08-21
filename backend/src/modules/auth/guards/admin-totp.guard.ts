import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FastifyRequest } from 'fastify';

import { PrismaService } from '../../prisma/prisma.service';
import { decryptTotpSecret, verifyTotp } from '../totp.util';

interface VerifyOtpBody {
  appType?: string;
  phoneNumber?: string;
  totpCode?: string;
}

@Injectable()
export class AdminTotpGuard implements CanActivate {
  public constructor(private readonly prisma: PrismaService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { body: VerifyOtpBody }>();
    if (request.body?.appType !== 'ADMIN_PANEL') return true;

    const phoneNumber = request.body.phoneNumber?.trim();
    if (!phoneNumber) return true;

    const user = await this.prisma.user.findUnique({
      select: { id: true, roles: true },
      where: { phoneNumber },
    });
    if (!user || (!user.roles.includes('ADMIN') && !user.roles.includes('SUPER_ADMIN'))) return true;

    const rows = await this.prisma.$queryRaw<Array<{ secret_encrypted: string; enabled: boolean }>>(Prisma.sql`
      SELECT "secret_encrypted", "enabled"
      FROM "admin_totp_credentials"
      WHERE "user_id" = ${user.id}::uuid
      LIMIT 1
    `);
    if (!rows[0]?.enabled) return true;

    const code = request.body.totpCode;
    if (!code) throw new UnauthorizedException('Two-factor code required');

    try {
      const secret = decryptTotpSecret(
        rows[0].secret_encrypted,
        process.env.ADMIN_TOTP_ENCRYPTION_KEY ?? process.env.JWT_ACCESS_SECRET ?? '',
      );
      if (!verifyTotp(secret, code)) throw new UnauthorizedException('Invalid two-factor code');
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Two-factor configuration is invalid');
    }

    return true;
  }
}
