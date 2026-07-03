import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type {
  AuthUserProfile,
  RefreshTokenResponse,
  RequestOtpResponse,
  VerifyOtpResponse,
} from '@tuljai/types';
import type { FastifyRequest } from 'fastify';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  LogoutDto,
  RefreshTokenDto,
  RegisterDeviceTokenDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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

  @Post('verify-otp')
  public verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() request: FastifyRequest,
  ): Promise<VerifyOtpResponse> {
    return this.authService.verifyOtp(dto, this.getRequestContext(request));
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
