import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AppType,
  AuthProvider,
  DevicePlatform,
  OtpPurpose,
  Prisma,
  UserRole,
  type RefreshToken,
  type User,
} from '@prisma/client';
import type {
  AuthTokens,
  AuthUserProfile,
  OwnerForgotPasswordResponse,
  OwnerLoginResponse,
  OwnerResetPasswordResponse,
  RefreshTokenResponse,
  RequestOtpResponse,
  UserSession,
  VerifyOtpResponse,
} from '@tuljai/types';

import { EmailService } from '../../shared/email/email.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  AdminLoginDto,
  GoogleLoginDto,
  LogoutDto,
  OwnerForgotPasswordDto,
  OwnerLoginDto,
  OwnerResetPasswordDto,
  RefreshTokenDto,
  RegisterDeviceTokenDto,
  RequestOtpDto,
  UpdateProfileDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { SupabaseAuthService } from './supabase-auth.service';
import { decryptTotpSecret, verifyTotp } from './totp.util';
interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}
interface AccessTokenResult {
  accessToken: string;
  expiresInSeconds: number;
}
// Roles allowed to authenticate into the Owner App, mirrored from
// apps/owner-app/src/auth/auth-context.tsx's allowedOwnerRoles — keep both in
// sync if this ever changes.
const OWNER_APP_ALLOWED_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.STAFF,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
];
@Injectable()
export class AuthService {
  private readonly accessTokenTtl: string;
  private readonly refreshTokenTtl: string;
  private readonly otpTtlSeconds: number;
  private readonly otpMaxAttempts: number;
  private readonly otpRateLimitWindowSeconds: number;
  private readonly otpRateLimitMaxRequests: number;
  private readonly allowDevOtpResponse: boolean;
  private readonly nodeEnv: string;
  private readonly ownerPasswordResetTtlSeconds: number;
  private readonly ownerPasswordResetRateLimitWindowSeconds: number;
  private readonly ownerPasswordResetRateLimitMaxRequests: number;
  private readonly ownerPasswordResetDeepLink: string;
  // Precomputed once so a "no such account" lookup in ownerLogin still pays
  // roughly the same scrypt cost as a real password check, instead of
  // returning noticeably faster and leaking account existence via timing.
  private readonly dummyPasswordHash: string;
  public constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly supabaseAuth: SupabaseAuthService,
  ) {
    this.accessTokenTtl = this.configService.getOrThrow<string>('api.jwt.accessTokenTtl');
    this.refreshTokenTtl = this.configService.getOrThrow<string>('api.jwt.refreshTokenTtl');
    this.otpTtlSeconds = this.configService.getOrThrow<number>('api.otp.ttlSeconds');
    this.otpMaxAttempts = this.configService.getOrThrow<number>('api.otp.maxAttempts');
    this.otpRateLimitWindowSeconds = this.configService.getOrThrow<number>(
      'api.otp.rateLimitWindowSeconds',
    );
    this.otpRateLimitMaxRequests = this.configService.getOrThrow<number>(
      'api.otp.rateLimitMaxRequests',
    );
    this.allowDevOtpResponse = this.configService.getOrThrow<boolean>('api.otp.allowDevResponse');
    this.nodeEnv = this.configService.getOrThrow<string>('api.nodeEnv');
    this.ownerPasswordResetTtlSeconds = this.configService.getOrThrow<number>(
      'api.ownerAuth.passwordResetTtlSeconds',
    );
    this.ownerPasswordResetRateLimitWindowSeconds = this.configService.getOrThrow<number>(
      'api.ownerAuth.passwordResetRateLimitWindowSeconds',
    );
    this.ownerPasswordResetRateLimitMaxRequests = this.configService.getOrThrow<number>(
      'api.ownerAuth.passwordResetRateLimitMaxRequests',
    );
    this.ownerPasswordResetDeepLink = this.configService.getOrThrow<string>(
      'api.ownerAuth.resetPasswordDeepLink',
    );
    this.dummyPasswordHash = this.hashSecret(randomBytes(24).toString('hex'));
  }
  public async requestOtp(
    dto: RequestOtpDto,
    context: RequestContext,
  ): Promise<RequestOtpResponse> {
    await this.enforceOtpRateLimit(dto.phoneNumber, dto.purpose);
    const otp = this.generateOtp();
    const expiresAt = this.addSeconds(new Date(), this.otpTtlSeconds);
    await this.prisma.otpRequest.create({
      data: {
        expiresAt,
        ipAddress: context.ipAddress,
        maxAttempts: this.otpMaxAttempts,
        otpHash: this.hashSecret(otp),
        phoneNumber: dto.phoneNumber,
        purpose: dto.purpose,
        userAgent: context.userAgent,
      },
    });
    await this.createAuditLog({
      action: 'OTP_REQUESTED',
      entityType: 'otp_request',
      metadata: {
        appType: dto.appType,
        phoneNumber: this.maskPhoneNumber(dto.phoneNumber),
        purpose: dto.purpose,
      },
    });
    const shouldReturnDevOtp = this.allowDevOtpResponse;
    return {
      expiresAt: expiresAt.toISOString(),
      ...(shouldReturnDevOtp ? { otpForTesting: otp } : {}),
    };
  }
  public async verifyOtp(dto: VerifyOtpDto, context: RequestContext): Promise<VerifyOtpResponse> {
    const otpRequest = await this.prisma.otpRequest.findFirst({
      where: { consumedAt: null, phoneNumber: dto.phoneNumber },
      orderBy: { createdAt: 'desc' },
    });
    if (!otpRequest || otpRequest.expiresAt <= new Date())
      throw new UnauthorizedException('Invalid or expired OTP');
    if (otpRequest.attempts >= otpRequest.maxAttempts)
      throw new UnauthorizedException('OTP attempt limit exceeded');
    if (!this.verifySecret(dto.otp, otpRequest.otpHash)) {
      await this.prisma.otpRequest.update({
        data: { attempts: { increment: 1 } },
        where: { id: otpRequest.id },
      });
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    const now = new Date();
    const existingUser = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber },
    });
    if (existingUser?.deletedAt || existingUser?.isActive === false)
      throw new UnauthorizedException('User is not active');
    const user = existingUser
      ? await this.prisma.user.update({
          data: { isActive: true, lastLoginAt: now },
          where: { id: existingUser.id },
        })
      : await this.prisma.user.create({ data: { lastLoginAt: now, phoneNumber: dto.phoneNumber } });
    await this.prisma.otpRequest.update({
      data: { consumedAt: now },
      where: { id: otpRequest.id },
    });
    const tokens = await this.issueTokens(user, dto.deviceId);
    const session = await this.prisma.userSession.create({
      data: {
        appType: dto.appType,
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        ipAddress: context.ipAddress,
        lastSeenAt: now,
        platform: dto.platform,
        refreshTokenId: tokens.refreshTokenRecord.id,
        userAgent: context.userAgent,
        userId: user.id,
      },
    });
    if (dto.fcmToken)
      await this.saveDeviceToken(user.id, {
        appType: dto.appType,
        deviceId: dto.deviceId,
        fcmToken: dto.fcmToken,
        platform: dto.platform,
      });
    const onboardingRequired = !existingUser?.displayName;
    await this.createAuditLog({
      action: 'OTP_VERIFIED',
      actorUserId: user.id,
      entityId: user.id,
      entityType: 'user',
      metadata: { appType: dto.appType, onboardingRequired },
    });
    return {
      onboardingRequired,
      session: this.toSession(session),
      tokens: tokens.response,
      user: this.toUserProfile(user),
    };
  }
  public async signInWithGoogle(
    dto: GoogleLoginDto,
    context: RequestContext,
  ): Promise<VerifyOtpResponse> {
    const googleProfile = await this.supabaseAuth.verifyGoogleAccessToken(dto.supabaseAccessToken);
    const now = new Date();
    const existingIdentity = await this.prisma.authIdentity.findUnique({
      include: { user: true },
      where: {
        provider_providerSubject: {
          provider: AuthProvider.GOOGLE,
          providerSubject: googleProfile.providerSubject,
        },
      },
    });
    if (existingIdentity?.user.deletedAt || existingIdentity?.user.isActive === false)
      throw new UnauthorizedException('User is not active');
    const user = existingIdentity
      ? await this.prisma.user.update({
          data: { displayName: googleProfile.fullName, isActive: true, lastLoginAt: now },
          where: { id: existingIdentity.userId },
        })
      : await this.prisma.user.create({
          data: {
            authIdentities: {
              create: {
                email: googleProfile.email,
                provider: AuthProvider.GOOGLE,
                providerSubject: googleProfile.providerSubject,
              },
            },
            displayName: googleProfile.fullName,
            lastLoginAt: now,
          },
        });
    if (existingIdentity && existingIdentity.email !== googleProfile.email)
      await this.prisma.authIdentity.update({
        data: { email: googleProfile.email },
        where: { id: existingIdentity.id },
      });
    const tokens = await this.issueTokens(user, dto.deviceId);
    const session = await this.prisma.userSession.create({
      data: {
        appType: dto.appType,
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        ipAddress: context.ipAddress,
        lastSeenAt: now,
        platform: dto.platform,
        refreshTokenId: tokens.refreshTokenRecord.id,
        userAgent: context.userAgent,
        userId: user.id,
      },
    });
    if (dto.fcmToken)
      await this.saveDeviceToken(user.id, {
        appType: dto.appType,
        deviceId: dto.deviceId,
        fcmToken: dto.fcmToken,
        platform: dto.platform,
      });
    const onboardingRequired = !existingIdentity;
    return {
      onboardingRequired,
      session: this.toSession(session),
      tokens: tokens.response,
      user: this.toUserProfile(user),
    };
  }
  /**
   * Admin panel sign-in with email + password (replaces phone OTP for the admin
   * panel). Only ADMIN / SUPER_ADMIN accounts may use it. If the account has
   * two-factor enabled, a valid authenticator code is also required. Repeated
   * failures for the same email or IP are throttled.
   */
  public async adminLogin(dto: AdminLoginDto, context: RequestContext): Promise<OwnerLoginResponse> {
    const email = this.normalizeEmail(dto.email);
    const throttleKeys = [`email:${email}`, `ip:${context.ipAddress ?? 'unknown'}`];
    this.assertAdminLoginNotThrottled(throttleKeys);
    const invalidCredentials = (): UnauthorizedException => {
      this.recordAdminLoginFailure(throttleKeys);
      return new UnauthorizedException('Incorrect email or password.');
    };
    const identity = await this.prisma.authIdentity.findUnique({
      include: { user: true },
      where: {
        provider_providerSubject: { provider: AuthProvider.PASSWORD, providerSubject: email },
      },
    });
    if (!identity?.passwordHash) {
      this.verifySecret(dto.password, this.dummyPasswordHash);
      throw invalidCredentials();
    }
    if (identity.user.deletedAt || !identity.user.isActive) throw invalidCredentials();
    const isAdmin = identity.user.roles.some(
      (role) => role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN,
    );
    if (!isAdmin) throw invalidCredentials();
    if (!this.verifySecret(dto.password, identity.passwordHash)) throw invalidCredentials();
    await this.assertAdminTotp(identity.userId, dto.totpCode, invalidCredentials);
    this.clearAdminLoginFailures(throttleKeys);
    const now = new Date();
    const user = await this.prisma.user.update({
      data: { isActive: true, lastLoginAt: now },
      where: { id: identity.userId },
    });
    const tokens = await this.issueTokens(user, dto.deviceId);
    const session = await this.prisma.userSession.create({
      data: {
        appType: AppType.ADMIN_PANEL,
        deviceId: dto.deviceId,
        deviceName: dto.deviceName ?? 'Admin Browser',
        ipAddress: context.ipAddress,
        lastSeenAt: now,
        platform: DevicePlatform.WEB,
        refreshTokenId: tokens.refreshTokenRecord.id,
        userAgent: context.userAgent,
        userId: user.id,
      },
    });
    await this.createAuditLog({
      action: 'ADMIN_PASSWORD_LOGIN',
      actorUserId: user.id,
      entityId: user.id,
      entityType: 'user',
    });
    return {
      session: this.toSession(session),
      tokens: tokens.response,
      user: this.toUserProfile(user),
    };
  }
  private readonly adminLoginFailures = new Map<string, { count: number; resetAt: number }>();
  private assertAdminLoginNotThrottled(keys: string[]): void {
    const now = Date.now();
    for (const key of keys) {
      const entry = this.adminLoginFailures.get(key);
      if (entry && entry.resetAt > now && entry.count >= 5)
        throw new HttpException(
          'Too many failed sign-in attempts. Please wait 15 minutes and try again.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
    }
  }
  private recordAdminLoginFailure(keys: string[]): void {
    const now = Date.now();
    for (const key of keys) {
      const entry = this.adminLoginFailures.get(key);
      if (!entry || entry.resetAt <= now)
        this.adminLoginFailures.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
      else entry.count += 1;
    }
  }
  private clearAdminLoginFailures(keys: string[]): void {
    for (const key of keys) this.adminLoginFailures.delete(key);
  }
  private async assertAdminTotp(
    userId: string,
    code: string | undefined,
    fail: () => UnauthorizedException,
  ): Promise<void> {
    const rows = await this.prisma.$queryRaw<
      Array<{ secret_encrypted: string; enabled: boolean }>
    >(Prisma.sql`
      SELECT "secret_encrypted", "enabled"
      FROM "admin_totp_credentials"
      WHERE "user_id" = ${userId}::uuid
      LIMIT 1
    `);
    const credential = rows[0];
    if (!credential?.enabled) return;
    if (!code) throw new UnauthorizedException('Two-factor code required');
    try {
      const secret = decryptTotpSecret(
        credential.secret_encrypted,
        process.env.ADMIN_TOTP_ENCRYPTION_KEY ?? process.env.JWT_ACCESS_SECRET ?? '',
      );
      if (!verifyTotp(secret, code)) throw fail();
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Two-factor configuration is invalid');
    }
  }
  public async ownerLogin(
    dto: OwnerLoginDto,
    context: RequestContext,
  ): Promise<OwnerLoginResponse> {
    const email = this.normalizeEmail(dto.email);
    const invalidCredentials = (): UnauthorizedException =>
      new UnauthorizedException('Incorrect email or password.');
    const identity = await this.prisma.authIdentity.findUnique({
      include: { user: true },
      where: {
        provider_providerSubject: { provider: AuthProvider.PASSWORD, providerSubject: email },
      },
    });
    if (!identity?.passwordHash) {
      this.verifySecret(dto.password, this.dummyPasswordHash);
      throw invalidCredentials();
    }
    if (identity.user.deletedAt || !identity.user.isActive) throw invalidCredentials();
    if (!this.hasAllowedOwnerRole(identity.user.roles)) throw invalidCredentials();
    if (!this.verifySecret(dto.password, identity.passwordHash)) throw invalidCredentials();
    const now = new Date();
    const user = await this.prisma.user.update({
      data: { isActive: true, lastLoginAt: now },
      where: { id: identity.userId },
    });
    const tokens = await this.issueTokens(user, dto.deviceId);
    const session = await this.prisma.userSession.create({
      data: {
        appType: AppType.OWNER_APP,
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        ipAddress: context.ipAddress,
        lastSeenAt: now,
        platform: dto.platform,
        refreshTokenId: tokens.refreshTokenRecord.id,
        userAgent: context.userAgent,
        userId: user.id,
      },
    });
    if (dto.fcmToken)
      await this.saveDeviceToken(user.id, {
        appType: AppType.OWNER_APP,
        deviceId: dto.deviceId,
        fcmToken: dto.fcmToken,
        platform: dto.platform,
      });
    await this.createAuditLog({
      action: 'OWNER_PASSWORD_LOGIN',
      actorUserId: user.id,
      entityId: user.id,
      entityType: 'user',
    });
    return {
      session: this.toSession(session),
      tokens: tokens.response,
      user: this.toUserProfile(user),
    };
  }
  public async ownerForgotPassword(
    dto: OwnerForgotPasswordDto,
    context: RequestContext,
  ): Promise<OwnerForgotPasswordResponse> {
    const email = this.normalizeEmail(dto.email);
    // Deliberately identical regardless of whether the email matches an
    // account, so the response never reveals which owner emails exist.
    const genericResponse: OwnerForgotPasswordResponse = {
      message: "If an account exists for that email, we've sent a password reset link to it.",
    };
    const identity = await this.prisma.authIdentity.findUnique({
      include: { user: true },
      where: {
        provider_providerSubject: { provider: AuthProvider.PASSWORD, providerSubject: email },
      },
    });
    // An owner who has never set a password yet (e.g. backfilled straight
    // from their lodge registration email) can still bootstrap one here.
    const user = identity?.user ?? (await this.prisma.user.findUnique({ where: { email } }));
    if (!user || user.deletedAt || !user.isActive || !this.hasAllowedOwnerRole(user.roles))
      return genericResponse;
    await this.enforcePasswordResetRateLimit(user.id);
    const rawToken = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: {
        email,
        expiresAt: this.addSeconds(new Date(), this.ownerPasswordResetTtlSeconds),
        ipAddress: context.ipAddress,
        tokenHash: this.hashResetToken(rawToken),
        userAgent: context.userAgent,
        userId: user.id,
      },
    });
    const resetLink = `${this.ownerPasswordResetDeepLink}?token=${rawToken}`;
    const expiresInMinutes = Math.round(this.ownerPasswordResetTtlSeconds / 60);
    await this.emailService.send({
      html:
        `<p>Hello${user.displayName ? ` ${user.displayName}` : ''},</p>` +
        `<p>Use the link below to reset your Tuljai Stays owner account password. ` +
        `This link expires in ${expiresInMinutes} minutes.</p>` +
        `<p><a href="${resetLink}">${resetLink}</a></p>` +
        `<p>If you did not request this, you can safely ignore this email.</p>`,
      subject: 'Reset your Tuljai Stays owner password',
      text:
        `Use this link to reset your Tuljai Stays owner account password ` +
        `(expires in ${expiresInMinutes} minutes): ${resetLink}\n\n` +
        `If you did not request this, you can safely ignore this email.`,
      to: email,
    });
    await this.createAuditLog({
      action: 'OWNER_PASSWORD_RESET_REQUESTED',
      actorUserId: user.id,
      entityId: user.id,
      entityType: 'user',
    });
    return genericResponse;
  }
  public async ownerResetPassword(dto: OwnerResetPasswordDto): Promise<OwnerResetPasswordResponse> {
    const tokenHash = this.hashResetToken(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      include: { user: true },
      where: { tokenHash },
    });
    const invalidToken = (): UnauthorizedException =>
      new UnauthorizedException(
        'This reset link is invalid or has expired. Please request a new one.',
      );
    if (
      !resetToken ||
      resetToken.consumedAt ||
      resetToken.expiresAt <= new Date() ||
      resetToken.user.deletedAt ||
      !resetToken.user.isActive ||
      !this.hasAllowedOwnerRole(resetToken.user.roles)
    )
      throw invalidToken();
    const passwordHash = this.hashSecret(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.authIdentity.upsert({
        create: {
          email: resetToken.email,
          passwordHash,
          provider: AuthProvider.PASSWORD,
          providerSubject: resetToken.email,
          userId: resetToken.userId,
        },
        update: { passwordHash },
        where: {
          provider_providerSubject: {
            provider: AuthProvider.PASSWORD,
            providerSubject: resetToken.email,
          },
        },
      }),
      this.prisma.passwordResetToken.update({
        data: { consumedAt: new Date() },
        where: { id: resetToken.id },
      }),
      // A password reset should invalidate every other active session -
      // the old password may have been compromised.
      this.prisma.refreshToken.updateMany({
        data: { revokedAt: new Date() },
        where: { revokedAt: null, userId: resetToken.userId },
      }),
      this.prisma.userSession.updateMany({
        data: { isActive: false },
        where: { userId: resetToken.userId },
      }),
    ]);
    await this.createAuditLog({
      action: 'OWNER_PASSWORD_RESET_COMPLETED',
      actorUserId: resetToken.userId,
      entityId: resetToken.userId,
      entityType: 'user',
    });
    return { message: 'Your password has been reset. Please sign in with your new password.' };
  }
  /**
   * Admin-triggered password set/reset for an owner or staff account,
   * bypassing the email reset flow entirely (no SMTP dependency). Also used
   * by OwnersService when an admin creates a new owner/staff account, so the
   * password-hashing and AuthIdentity upsert logic lives in one place.
   */
  public async adminSetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.email)
      throw new BadRequestException(
        'This account has no login email on file yet - set one before assigning a password.',
      );
    const email = this.normalizeEmail(user.email);
    const passwordHash = this.hashSecret(newPassword);
    await this.prisma.$transaction([
      this.prisma.authIdentity.upsert({
        create: { email, passwordHash, provider: AuthProvider.PASSWORD, providerSubject: email, userId },
        update: { passwordHash },
        where: {
          provider_providerSubject: { provider: AuthProvider.PASSWORD, providerSubject: email },
        },
      }),
      this.prisma.refreshToken.updateMany({
        data: { revokedAt: new Date() },
        where: { revokedAt: null, userId },
      }),
      this.prisma.userSession.updateMany({
        data: { isActive: false },
        where: { userId },
      }),
    ]);
  }
  public async refreshToken(dto: RefreshTokenDto): Promise<RefreshTokenResponse> {
    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    const refreshToken = await this.prisma.refreshToken.findUnique({
      include: { user: true, userSession: true },
      where: { tokenHash },
    });
    if (
      !refreshToken ||
      refreshToken.deviceId !== dto.deviceId ||
      refreshToken.revokedAt ||
      refreshToken.expiresAt <= new Date() ||
      !refreshToken.user.isActive ||
      refreshToken.user.deletedAt
    )
      throw new UnauthorizedException('Invalid refresh token');
    await this.prisma.userSession.updateMany({
      data: { lastSeenAt: new Date() },
      where: { refreshTokenId: refreshToken.id },
    });
    return this.issueAccessToken(refreshToken.user);
  }
  public async logout(userId: string, dto: LogoutDto): Promise<{ success: true }> {
    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    const now = new Date();
    const refreshToken = await this.prisma.refreshToken.findFirst({
      where: { deviceId: dto.deviceId, tokenHash, userId },
    });
    if (!refreshToken) throw new BadRequestException('Refresh token was not found for this device');
    await this.prisma.refreshToken.update({
      data: { revokedAt: now },
      where: { id: refreshToken.id },
    });
    await this.prisma.userSession.updateMany({
      data: { isActive: false, lastSeenAt: now },
      where: { refreshTokenId: refreshToken.id, userId },
    });
    if (dto.deactivateDeviceToken)
      await this.prisma.deviceToken.updateMany({
        data: { isActive: false },
        where: { deviceId: dto.deviceId, userId },
      });
    return { success: true };
  }
  public async getProfile(userId: string): Promise<AuthUserProfile> {
    const user = await this.prisma.user.findFirst({
      where: { deletedAt: null, id: userId, isActive: true },
    });
    if (!user) throw new UnauthorizedException('User is not active');
    return this.toUserProfile(user);
  }
  public async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthUserProfile> {
    const existing = await this.prisma.user.findFirst({
      where: { deletedAt: null, id: userId, isActive: true },
    });
    if (!existing) throw new UnauthorizedException('User is not active');
    const displayName = dto.displayName.trim().replace(/\s+/gu, ' ');
    if (displayName.length < 2)
      throw new BadRequestException('Display name must contain at least 2 characters');
    const updated = await this.prisma.user.update({ data: { displayName }, where: { id: userId } });
    await this.createAuditLog({
      action: 'PROFILE_UPDATED',
      actorUserId: userId,
      entityId: userId,
      entityType: 'user',
      metadata: { displayName },
    });
    return this.toUserProfile(updated);
  }
  public async registerDeviceToken(
    userId: string,
    dto: RegisterDeviceTokenDto,
  ): Promise<{ success: true }> {
    await this.saveDeviceToken(userId, dto);
    return { success: true };
  }
  private hasAllowedOwnerRole(roles: UserRole[]): boolean {
    return roles.some((role) => OWNER_APP_ALLOWED_ROLES.includes(role));
  }
  private async enforcePasswordResetRateLimit(userId: string): Promise<void> {
    const rateLimitWindowStart = this.addSeconds(
      new Date(),
      -this.ownerPasswordResetRateLimitWindowSeconds,
    );
    const requestCount = await this.prisma.passwordResetToken.count({
      where: { createdAt: { gte: rateLimitWindowStart }, userId },
    });
    if (requestCount >= this.ownerPasswordResetRateLimitMaxRequests)
      throw new HttpException(
        'Too many password reset requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  private async enforceOtpRateLimit(phoneNumber: string, purpose: OtpPurpose): Promise<void> {
    const rateLimitWindowStart = this.addSeconds(new Date(), -this.otpRateLimitWindowSeconds);
    const requestCount = await this.prisma.otpRequest.count({
      where: { createdAt: { gte: rateLimitWindowStart }, phoneNumber, purpose },
    });
    if (requestCount >= this.otpRateLimitMaxRequests)
      throw new HttpException(
        'Too many OTP requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
  private async issueTokens(
    user: User,
    deviceId: string,
  ): Promise<{ refreshTokenRecord: RefreshToken; response: AuthTokens }> {
    const accessToken = await this.issueAccessToken(user);
    const refreshToken = this.generateRefreshToken();
    const refreshTokenRecord = await this.prisma.refreshToken.create({
      data: {
        deviceId,
        expiresAt: this.addSeconds(new Date(), this.parseDurationSeconds(this.refreshTokenTtl)),
        tokenHash: this.hashRefreshToken(refreshToken),
        userId: user.id,
      },
    });
    return {
      refreshTokenRecord,
      response: {
        accessToken: accessToken.accessToken,
        expiresInSeconds: accessToken.expiresInSeconds,
        refreshToken,
      },
    };
  }
  private async issueAccessToken(user: User): Promise<AccessTokenResult> {
    const expiresInSeconds = this.parseDurationSeconds(this.accessTokenTtl);
    const accessToken = await this.jwtService.signAsync(
      { phoneNumber: user.phoneNumber, roles: user.roles, sub: user.id },
      {
        expiresIn: expiresInSeconds,
        secret: this.configService.getOrThrow<string>('api.jwt.accessSecret'),
      },
    );
    return { accessToken, expiresInSeconds };
  }
  private async saveDeviceToken(userId: string, dto: RegisterDeviceTokenDto): Promise<void> {
    await this.prisma.deviceToken.updateMany({
      data: { isActive: false },
      where: {
        appType: dto.appType,
        deviceId: { not: dto.deviceId },
        fcmToken: dto.fcmToken,
        userId,
      },
    });
    await this.prisma.deviceToken.upsert({
      create: {
        appType: dto.appType,
        deviceId: dto.deviceId,
        fcmToken: dto.fcmToken,
        platform: dto.platform,
        userId,
      },
      update: { fcmToken: dto.fcmToken, isActive: true, platform: dto.platform },
      where: { userId_deviceId_appType: { appType: dto.appType, deviceId: dto.deviceId, userId } },
    });
  }
  private async createAuditLog(params: {
    action: string;
    actorUserId?: string;
    entityId?: string;
    entityType: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: params.action,
        actorUserId: params.actorUserId,
        entityId: params.entityId,
        entityType: params.entityType,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
  private toUserProfile(user: User): AuthUserProfile {
    return {
      displayName: user.displayName,
      id: user.id,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      phoneNumber: user.phoneNumber,
      roles: user.roles,
    };
  }
  private toSession(session: {
    appType: AppType;
    createdAt: Date;
    deviceId: string;
    deviceName: string | null;
    id: string;
    isActive: boolean;
    lastSeenAt: Date;
    platform: DevicePlatform;
    userId: string;
  }): UserSession {
    return {
      appType: session.appType,
      createdAt: session.createdAt.toISOString(),
      deviceId: session.deviceId,
      deviceName: session.deviceName,
      id: session.id,
      isActive: session.isActive,
      lastSeenAt: session.lastSeenAt.toISOString(),
      platform: session.platform,
      userId: session.userId,
    };
  }
  private generateOtp(): string {
    return String(randomInt(100000, 1000000));
  }
  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  private hashSecret(secret: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(secret, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) return '****';
    return `${'*'.repeat(Math.max(phoneNumber.length - 4, 0))}${phoneNumber.slice(-4)}`;
  }
  private verifySecret(secret: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const hashedSecret = scryptSync(secret, salt, 64);
    const storedSecretHash = Buffer.from(hash, 'hex');
    if (hashedSecret.length !== storedSecretHash.length) return false;
    return timingSafeEqual(hashedSecret, storedSecretHash);
  }
  private addSeconds(date: Date, seconds: number): Date {
    return new Date(date.getTime() + seconds * 1000);
  }
  private parseDurationSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return Number(duration);
    const value = Number(match[1]);
    const unit = match[2];
    if (unit === 's') return value;
    if (unit === 'm') return value * 60;
    if (unit === 'h') return value * 60 * 60;
    return value * 60 * 60 * 24;
  }
}
