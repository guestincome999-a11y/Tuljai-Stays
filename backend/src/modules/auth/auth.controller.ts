import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type {
  AuthUserProfile,
  OwnerForgotPasswordResponse,
  OwnerLoginResponse,
  OwnerResetPasswordResponse,
  RefreshTokenResponse,
  RequestOtpResponse,
  VerifyOtpResponse,
} from '@tuljai/types';
import type { FastifyRequest } from 'fastify';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import {
  AdminLoginDto,
  AdminSetPasswordDto,
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
import { AdminTotpGuard } from './guards/admin-totp.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Controller('auth')
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  public requestOtp(
    @Body() dto: RequestOtpDto,
    @Req() request: FastifyRequest,
  ): Promise<RequestOtpResponse> {
    return this.authService.requestOtp(dto, this.getRequestContext(request));
  }

  @UseGuards(AdminTotpGuard)
  @Post('verify-otp')
  public verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() request: FastifyRequest,
  ): Promise<VerifyOtpResponse> {
    return this.authService.verifyOtp(dto, this.getRequestContext(request));
  }

  @Post('google')
  public googleLogin(
    @Body() dto: GoogleLoginDto,
    @Req() request: FastifyRequest,
  ): Promise<VerifyOtpResponse> {
    return this.authService.signInWithGoogle(dto, this.getRequestContext(request));
  }

  @Post('admin/login')
  public adminLogin(
    @Body() dto: AdminLoginDto,
    @Req() request: FastifyRequest,
  ): Promise<OwnerLoginResponse> {
    return this.authService.adminLogin(dto, this.getRequestContext(request));
  }

  @Post('owner/login')
  public ownerLogin(
    @Body() dto: OwnerLoginDto,
    @Req() request: FastifyRequest,
  ): Promise<OwnerLoginResponse> {
    return this.authService.ownerLogin(dto, this.getRequestContext(request));
  }

  @Post('owner/forgot-password')
  public ownerForgotPassword(
    @Body() dto: OwnerForgotPasswordDto,
    @Req() request: FastifyRequest,
  ): Promise<OwnerForgotPasswordResponse> {
    return this.authService.ownerForgotPassword(dto, this.getRequestContext(request));
  }

  @Post('owner/reset-password')
  public ownerResetPassword(
    @Body() dto: OwnerResetPasswordDto,
  ): Promise<OwnerResetPasswordResponse> {
    return this.authService.ownerResetPassword(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/users/:userId/set-password')
  public async adminSetPassword(
    @Param('userId') userId: string,
    @Body() dto: AdminSetPasswordDto,
  ): Promise<{ success: true }> {
    await this.authService.adminSetPassword(userId, dto.newPassword);
    return { success: true };
  }

  @Post('refresh-token')
  public refreshToken(@Body() dto: RefreshTokenDto): Promise<RefreshTokenResponse> {
    return this.authService.refreshToken(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  public logout(
    @CurrentUser() user: AuthUserProfile,
    @Body() dto: LogoutDto,
  ): Promise<{ success: true }> {
    return this.authService.logout(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  public me(@CurrentUser() user: AuthUserProfile): Promise<AuthUserProfile> {
    return this.authService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  public updateMe(
    @CurrentUser() user: AuthUserProfile,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthUserProfile> {
    return this.authService.updateProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('device-token')
  public registerDeviceToken(
    @CurrentUser() user: AuthUserProfile,
    @Body() dto: RegisterDeviceTokenDto,
  ): Promise<{ success: true }> {
    return this.authService.registerDeviceToken(user.id, dto);
  }

  private getRequestContext(request: FastifyRequest): { ipAddress?: string; userAgent?: string } {
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }
}
