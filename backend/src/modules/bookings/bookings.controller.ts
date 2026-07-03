import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';
import type { FastifyRequest } from 'fastify';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { BookingAvailabilityService } from './booking-availability.service';
import { BookingLocksService } from './booking-locks.service';
import { BookingsService } from './bookings.service';
import {
  AdminBookingsQueryDto,
  BookingAvailabilityQueryDto,
  CreateBookingDto,
  CreateBookingLockDto,
  OwnerBookingsQueryDto,
  RejectBookingDto,
  UpdateBookingStatusDto,
} from './dto/booking.dto';
import {
  GenerateQrDto,
  MarkIdVerifiedDto,
  RegisterQueryDto,
  ScanQrDto,
  UpdateRegisterNotesDto,
} from './dto/qr-register.dto';
import { GuestRegisterService } from './guest-register.service';
import { QrCheckinService } from './qr-checkin.service';

@Controller()
export class BookingsController {
  public constructor(
    private readonly availabilityService: BookingAvailabilityService,
    private readonly bookingLocksService: BookingLocksService,
    private readonly bookingsService: BookingsService,
    private readonly guestRegisterService: GuestRegisterService,
    private readonly qrCheckinService: QrCheckinService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('bookings/lock')
  public createLock(@Body() dto: CreateBookingLockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingLocksService.createLock(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('bookings')
  public createBooking(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.createBooking(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bookings/my')
  public listMyBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.listMyBookings(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bookings/:id')
  public getBooking(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.getBookingById(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post('bookings/:id/qr/generate')
  public generateQr(
    @Param('id') id: string,
    @Body() dto: GenerateQrDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qrCheckinService.generateQr(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bookings/:id/qr')
  public getQrMetadata(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.qrCheckinService.getQrMetadata(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('owner/bookings')
  public listOwnerBookings(
    @Query() query: OwnerBookingsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.listOwnerBookings(query, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('owner/register')
  public listOwnerRegisters(
    @Query() query: RegisterQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guestRegisterService.listOwnerRegisters(query, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('owner/register/:id')
  public getOwnerRegister(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.guestRegisterService.getRegister(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Patch('owner/register/:id/id-verified')
  public markRegisterIdVerified(
    @Param('id') id: string,
    @Body() dto: MarkIdVerifiedDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guestRegisterService.markIdVerified(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Patch('owner/register/:id/notes')
  public updateRegisterNotes(
    @Param('id') id: string,
    @Body() dto: UpdateRegisterNotesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guestRegisterService.updateNotes(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post('owner/register/:id/checkout')
  public checkoutRegister(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.guestRegisterService.checkout(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post('owner/bookings/:id/accept')
  public acceptBooking(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.acceptBooking(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post('owner/bookings/:id/reject')
  public rejectBooking(
    @Param('id') id: string,
    @Body() dto: RejectBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.rejectBooking(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/bookings')
  public listAdminBookings(@Query() query: AdminBookingsQueryDto) {
    return this.bookingsService.listAdminBookings(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/register')
  public listAdminRegisters(@Query() query: RegisterQueryDto) {
    return this.guestRegisterService.listAdminRegisters(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/bookings/:id/status')
  public updateBookingStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.updateBookingStatus(id, dto, user);
  }

  @Get('lodges/:lodgeId/room-types/:roomTypeId/availability')
  public getAvailability(
    @Param('lodgeId') lodgeId: string,
    @Param('roomTypeId') roomTypeId: string,
    @Query() query: BookingAvailabilityQueryDto,
  ) {
    return this.availabilityService.getAvailability(
      lodgeId,
      roomTypeId,
      query.checkInDate,
      query.checkOutDate,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post('qr/scan')
  public scanQr(
    @Body() dto: ScanQrDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ) {
    return this.qrCheckinService.scanQr(dto, user, {
      deviceId: dto.deviceId,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
