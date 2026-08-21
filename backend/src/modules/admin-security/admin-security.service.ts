import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import {
  createTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotp,
} from '../auth/totp.util';
import { PrismaService } from '../prisma/prisma.service';

import type { VerifyAdminTotpDto } from './dto/admin-security.dto';

@Injectable()
export class AdminSecurityService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}
  public async status(user: AuthenticatedUser) {
    const rows = await this.prisma.$queryRaw<Array<{ enabled: boolean }>>(
      Prisma.sql`SELECT "enabled" FROM "admin_totp_credentials" WHERE "user_id" = ${user.id}::uuid LIMIT 1`,
    );
    return { enabled: rows[0]?.enabled ?? false };
  }
  public async setup(user: AuthenticatedUser) {
    const existing = await this.status(user);
    if (existing.enabled)
      throw new BadRequestException('Two-factor authentication is already enabled');
    const secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret, this.encryptionKey());
    await this.prisma.$executeRaw(
      Prisma.sql`INSERT INTO "admin_totp_credentials" ("user_id", "secret_encrypted", "enabled", "created_at", "updated_at") VALUES (${user.id}::uuid, ${encrypted}, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("user_id") DO UPDATE SET "secret_encrypted" = EXCLUDED."secret_encrypted", "enabled" = FALSE, "updated_at" = CURRENT_TIMESTAMP`,
    );
    await this.auditLogService.create({
      action: 'ADMIN_2FA_SETUP_STARTED',
      actorUserId: user.id,
      entityId: user.id,
      entityType: 'user',
    });
    return {
      account: user.phoneNumber ?? user.id,
      otpauthUri: createTotpUri(secret, user.phoneNumber ?? user.id),
      secret,
    };
  }
  public async verify(user: AuthenticatedUser, dto: VerifyAdminTotpDto) {
    const rows = await this.prisma.$queryRaw<Array<{ secret_encrypted: string }>>(
      Prisma.sql`SELECT "secret_encrypted" FROM "admin_totp_credentials" WHERE "user_id" = ${user.id}::uuid LIMIT 1`,
    );
    if (!rows[0]) throw new BadRequestException('Start two-factor setup first');
    const secret = this.decryptOrThrow(rows[0].secret_encrypted);
    if (!verifyTotp(secret, dto.code)) throw new UnauthorizedException('Invalid two-factor code');
    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE "admin_totp_credentials" SET "enabled" = TRUE, "last_verified_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP WHERE "user_id" = ${user.id}::uuid`,
    );
    await this.auditLogService.create({
      action: 'ADMIN_2FA_ENABLED',
      actorUserId: user.id,
      entityId: user.id,
      entityType: 'user',
    });
    return { enabled: true };
  }
  public async disable(user: AuthenticatedUser, dto: VerifyAdminTotpDto) {
    const rows = await this.prisma.$queryRaw<Array<{ secret_encrypted: string; enabled: boolean }>>(
      Prisma.sql`SELECT "secret_encrypted", "enabled" FROM "admin_totp_credentials" WHERE "user_id" = ${user.id}::uuid LIMIT 1`,
    );
    if (!rows[0]?.enabled) return { enabled: false };
    const secret = this.decryptOrThrow(rows[0].secret_encrypted);
    if (!verifyTotp(secret, dto.code)) throw new UnauthorizedException('Invalid two-factor code');
    await this.prisma
      .$executeRaw`DELETE FROM "admin_totp_credentials" WHERE "user_id" = ${user.id}::uuid`;
    await this.auditLogService.create({
      action: 'ADMIN_2FA_DISABLED',
      actorUserId: user.id,
      entityId: user.id,
      entityType: 'user',
    });
    return { enabled: false };
  }
  private decryptOrThrow(payload: string): string {
    try {
      return decryptTotpSecret(payload, this.encryptionKey());
    } catch {
      throw new UnauthorizedException('Two-factor configuration is invalid');
    }
  }
  private encryptionKey(): string {
    const key = process.env.ADMIN_TOTP_ENCRYPTION_KEY;
    if (!key && process.env.NODE_ENV === 'production')
      throw new InternalServerErrorException('ADMIN_TOTP_ENCRYPTION_KEY is required in production');
    return key ?? process.env.JWT_ACCESS_SECRET ?? 'local-development-only';
  }
}
