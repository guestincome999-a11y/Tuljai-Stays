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
interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}
interface AccessTokenResult {
  accessToken: string;
  expiresInSeconds: number;
}
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
  public constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly supabaseAuth: SupabaseAuthService,
    private readonly emailService: EmailService,
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
  public async ownerLogin(
    dto: OwnerLoginDto,
    context: RequestContext,
  ): Promise<OwnerLoginResponse> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      include: { authIdentities: { where: { provider: AuthProvider.PASSWORD } } },
      where: { email },
    });
    const passwordIdentity = user?.authIdentities[0];

    if (
      !user ||
      user.deletedAt ||
      !user.isActive ||
      !user.roles.includes('OWNER') ||
      !passwordIdentity?.passwordHash ||
      !this.verifySecret(dto.password, passwordIdentity.passwordHash)
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const now = new Date();
    const updatedUser = await this.prisma.user.update({
      data: { lastLoginAt: now },
      where: { id: user.id },
    });
    const tokens = await this.issueTokens(updatedUser, dto.deviceId);
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
        userId: updatedUser.id,
      },
    });
    if (dto.fcmToken) {
      await this.saveDeviceToken(updatedUser.id, {
        appType: AppType.OWNER_APP,
        deviceId: dto.deviceId,
        fcmToken: dto.fcmToken,
        platform: dto.platform,
      });
    }
    await this.createAuditLog({
      action: 'OWNER_PASSWORD_LOGIN',
      actorUserId: updatedUser.id,
      entityId: updatedUser.id,
      entityType: 'user',
      metadata: { appType: AppType.OWNER_APP },
    });
    return {
      session: this.toSession(session),
      tokens: tokens.response,
      user: this.toUserProfile(updatedUser),
    };
  }
  public async ownerForgotPassword(
    dto: OwnerForgotPasswordDto,
    context: RequestContext,
  ): Promise<OwnerForgotPasswordResponse> {
    const email = this.normalizeEmail(dto.email);
    const genericResponse = { message: 'If an eligible account exists, a reset link has been sent.' };
    const windowStart = this.addSeconds(
      new Date(),
      -this.configService.getOrThrow<number>('api.ownerAuth.passwordResetRateLimitWindowSeconds'),
    );
    const requestCount = await this.prisma.passwordResetToken.count({
      where: { createdAt: { gte: windowStart }, email },
    });
    const maxRequests = this.configService.getOrThrow<number>(
      'api.ownerAuth.passwordResetRateLimitMaxRequests',
    );
    if (requestCount >= maxRequests) return genericResponse;

    const user = await this.prisma.user.findUnique({
      include: { authIdentities: { where: { provider: AuthProvider.PASSWORD } } },
      where: { email },
    });
    const passwordIdentity = user?.authIdentities[0];
    if (
      !user ||
      user.deletedAt ||
      !user.isActive ||
      !user.roles.includes('OWNER') ||
      !passwordIdentity?.passwordHash
    ) {
      return genericResponse;
    }

    const token = this.generateRefreshToken();
    const expiresAt = this.addSeconds(
      new Date(),
      this.configService.getOrThrow<number>('api.ownerAuth.passwordResetTtlSeconds'),
    );
    await this.prisma.passwordResetToken.create({
      data: {
        email,
        expiresAt,
        ipAddress: context.ipAddress,
        tokenHash: this.hashRefreshToken(token),
        userAgent: context.userAgent,
        userId: user.id,
      },
    });
    const resetLink = this.buildOwnerPasswordResetLink(token);
    await this.emailService.send({
      html: `<p>Use the link below to reset your Tuljai Stays Owner App password. It expires in ${Math.floor((expiresAt.getTime() - Date.now()) / 60000)} minutes.</p><p><a href="${resetLink}">Reset password</a></p>`,
      subject: 'Reset your Tuljai Stays owner password',
      text: `Reset your Tuljai Stays Owner App password: ${resetLink}`,
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
  public async ownerResetPassword(
    dto: OwnerResetPasswordDto,
  ): Promise<OwnerResetPasswordResponse> {
    const now = new Date();
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      include: { user: { include: { authIdentities: { where: { provider: AuthProvider.PASSWORD } } } } },
      where: { tokenHash: this.hashRefreshToken(dto.token) },
    });
    const passwordIdentity = resetToken?.user.authIdentities[0];
    if (
      !resetToken ||
      resetToken.consumedAt ||
      resetToken.expiresAt <= now ||
      resetToken.user.deletedAt ||
      !resetToken.user.isActive ||
      !resetToken.user.roles.includes('OWNER') ||
      !passwordIdentity
    ) {
      throw new UnauthorizedException('Invalid or expired password reset link');
    }
    const consumed = await this.prisma.passwordResetToken.updateMany({
      data: { consumedAt: now },
      where: { consumedAt: null, expiresAt: { gt: now }, id: resetToken.id },
    });
    if (consumed.count !== 1) throw new UnauthorizedException('Invalid or expired password reset link');

    await this.prisma.$transaction([
      this.prisma.authIdentity.update({
        data: { passwordHash: this.hashSecret(dto.newPassword) },
        where: { id: passwordIdentity.id },
      }),
      this.prisma.refreshToken.updateMany({
        data: { revokedAt: now },
        where: { revokedAt: null, userId: resetToken.userId },
      }),
      this.prisma.userSession.updateMany({
        data: { isActive: false, lastSeenAt: now },
        where: { isActive: true, userId: resetToken.userId },
      }),
    ]);
    await this.createAuditLog({
      action: 'OWNER_PASSWORD_RESET_COMPLETED',
      actorUserId: resetToken.userId,
      entityId: resetToken.userId,
      entityType: 'user',
    });
    return { message: 'Password reset successfully. Please sign in with your new password.' };
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
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
  private buildOwnerPasswordResetLink(token: string): string {
    const deepLink = this.configService.getOrThrow<string>('api.ownerAuth.resetPasswordDeepLink');
    const separator = deepLink.includes('?') ? '&' : '?';
    return `${deepLink}${separator}token=${encodeURIComponent(token)}`;
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
