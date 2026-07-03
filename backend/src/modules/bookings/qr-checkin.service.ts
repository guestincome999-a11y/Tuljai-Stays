import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser, CheckInResponse, QrPayload, QrTokenMetadata } from '@tuljai/types';

import { Prisma, QrScanResult as PrismaQrScanResult } from '../../../generated/prisma';
import { AuditLogService } from '../../shared/audit/audit-log.service';
import { LodgeAccessService } from '../lodges/lodge-access.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';

import { BookingsService } from './bookings.service';
import type { GenerateQrDto, ScanQrDto } from './dto/qr-register.dto';
import { GuestRegisterService } from './guest-register.service';

interface ScanContext {
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
}

type BookingForQr = Prisma.BookingGetPayload<{
  include: {
    lodge: true;
    room: true;
    roomType: true;
  };
}>;

@Injectable()
export class QrCheckinService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly bookingsService: BookingsService,
    private readonly configService: ConfigService,
    private readonly guestRegisterService: GuestRegisterService,
    private readonly lodgeAccessService: LodgeAccessService,
    private readonly notificationEventsService: NotificationEventsService,
    private readonly prisma: PrismaService,
  ) {}

  public async generateQr(
    bookingId: string,
    dto: GenerateQrDto,
    user: AuthenticatedUser,
  ): Promise<QrPayload> {
    const booking = await this.findBookingForQrOrThrow(bookingId);
    await this.assertCanGenerateQr(booking, user);

    if (booking.status !== 'ACCEPTED') {
      throw new BadRequestException('QR can be generated only for accepted bookings');
    }

    const activeToken = await this.prisma.bookingQrToken.findFirst({
      where: {
        bookingId,
        expiresAt: { gt: new Date() },
        status: 'ACTIVE',
      },
    });

    if (activeToken) {
      throw new ConflictException('An active QR token already exists for this booking');
    }

    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() +
        (dto.ttlSeconds ?? this.configService.get<number>('api.booking.qrTokenTtlSeconds', 86400)) *
          1000,
    );
    const qrToken = await this.prisma.$transaction(async (tx) => {
      await tx.bookingQrToken.updateMany({
        data: { status: 'REVOKED' },
        where: {
          bookingId,
          status: 'ACTIVE',
        },
      });
      const created = await tx.bookingQrToken.create({
        data: {
          bookingId,
          expiresAt,
          tokenHash: this.hashToken(rawToken),
          tokenVersion: 1,
        },
      });
      await tx.booking.update({
        data: { status: 'QR_GENERATED' },
        where: { id: bookingId },
      });
      await tx.bookingHistory.create({
        data: {
          action: 'QR_GENERATED',
          actorUserId: user.id,
          bookingId,
          fromStatus: booking.status,
          toStatus: 'QR_GENERATED',
        },
      });

      return created;
    });
    await this.auditLogService.create({
      action: 'QR_GENERATED',
      actorUserId: user.id,
      entityId: bookingId,
      entityType: 'booking',
      metadata: { qrTokenId: qrToken.id },
    });
    await this.notificationEventsService.qrGenerated(bookingId);

    return {
      bookingCode: booking.bookingCode,
      bookingId,
      expiresAt: qrToken.expiresAt.toISOString(),
      token: rawToken,
      tokenVersion: qrToken.tokenVersion,
    };
  }

  public async getQrMetadata(bookingId: string, user: AuthenticatedUser): Promise<QrTokenMetadata> {
    const booking = await this.findBookingForQrOrThrow(bookingId);

    if (booking.pilgrimUserId !== user.id && !this.lodgeAccessService.isAdmin(user)) {
      throw new ForbiddenException('Only the pilgrim or admin can view QR metadata');
    }

    if (!['ACCEPTED', 'QR_GENERATED'].includes(booking.status)) {
      throw new BadRequestException('QR is available only for accepted bookings');
    }

    const qrToken = await this.prisma.bookingQrToken.findFirst({
      orderBy: { createdAt: 'desc' },
      where: {
        bookingId,
        status: 'ACTIVE',
      },
    });

    if (!qrToken) {
      throw new NotFoundException('Active QR token not found');
    }

    return {
      bookingId,
      expiresAt: qrToken.expiresAt.toISOString(),
      id: qrToken.id,
      status: qrToken.status,
      tokenVersion: qrToken.tokenVersion,
      usedAt: qrToken.usedAt?.toISOString() ?? null,
    };
  }

  public async scanQr(
    dto: ScanQrDto,
    user: AuthenticatedUser,
    context: ScanContext,
  ): Promise<CheckInResponse> {
    const tokenHash = this.hashToken(dto.token);
    const qrToken = await this.prisma.bookingQrToken.findUnique({
      include: {
        booking: {
          include: {
            lodge: true,
            room: true,
            roomType: true,
          },
        },
      },
      where: { tokenHash },
    });

    if (!qrToken) {
      await this.logScanFailure('INVALID', 'QR token is invalid', user, context, dto.bookingId);
      this.notificationEventsService.qrScanFailed(user.id, dto.bookingId);
      throw new BadRequestException('Invalid QR token');
    }

    if (dto.bookingId && dto.bookingId !== qrToken.bookingId) {
      await this.logScanFailure(
        'BOOKING_NOT_FOUND',
        'QR token does not match booking',
        user,
        context,
        dto.bookingId,
        qrToken.id,
        qrToken.booking.lodgeId,
      );
      this.notificationEventsService.qrScanFailed(user.id, dto.bookingId);
      throw new BadRequestException('Invalid QR token');
    }

    if (qrToken.status === 'USED' || qrToken.usedAt) {
      await this.logScanFailure(
        'USED',
        'QR token has already been used',
        user,
        context,
        qrToken.bookingId,
        qrToken.id,
        qrToken.booking.lodgeId,
      );
      this.notificationEventsService.qrScanFailed(user.id, qrToken.bookingId);
      throw new ConflictException('QR token has already been used');
    }

    if (qrToken.status !== 'ACTIVE') {
      await this.logScanFailure(
        'INVALID',
        'QR token is not active',
        user,
        context,
        qrToken.bookingId,
        qrToken.id,
        qrToken.booking.lodgeId,
      );
      this.notificationEventsService.qrScanFailed(user.id, qrToken.bookingId);
      throw new BadRequestException('QR token is not active');
    }

    if (qrToken.expiresAt <= new Date()) {
      await this.prisma.bookingQrToken.update({
        data: { status: 'EXPIRED' },
        where: { id: qrToken.id },
      });
      await this.logScanFailure(
        'EXPIRED',
        'QR token has expired',
        user,
        context,
        qrToken.bookingId,
        qrToken.id,
        qrToken.booking.lodgeId,
      );
      this.notificationEventsService.qrScanFailed(user.id, qrToken.bookingId);
      throw new BadRequestException('QR token has expired');
    }

    try {
      await this.lodgeAccessService.assertCanManageLodge(user, qrToken.booking.lodgeId);
    } catch {
      await this.logScanFailure(
        'UNAUTHORIZED',
        'User cannot scan this lodge QR',
        user,
        context,
        qrToken.bookingId,
        qrToken.id,
        qrToken.booking.lodgeId,
      );
      this.notificationEventsService.qrScanFailed(user.id, qrToken.bookingId);
      throw new ForbiddenException('You cannot scan this QR code');
    }

    if (!['ACCEPTED', 'QR_GENERATED'].includes(qrToken.booking.status)) {
      await this.logScanFailure(
        'INVALID_STATUS',
        'Booking status does not allow QR check-in',
        user,
        context,
        qrToken.bookingId,
        qrToken.id,
        qrToken.booking.lodgeId,
      );
      this.notificationEventsService.qrScanFailed(user.id, qrToken.bookingId);
      throw new BadRequestException('Booking is not ready for QR check-in');
    }

    if (!qrToken.booking.roomId || !qrToken.booking.room) {
      await this.logScanFailure(
        'INVALID_STATUS',
        'Booking has no assigned room',
        user,
        context,
        qrToken.bookingId,
        qrToken.id,
        qrToken.booking.lodgeId,
      );
      this.notificationEventsService.qrScanFailed(user.id, qrToken.bookingId);
      throw new BadRequestException('Booking has no assigned room');
    }

    const checkedInAt = new Date();
    const previousBookingStatus = qrToken.booking.status;
    const assignedRoomId = qrToken.booking.roomId;
    const assignedRoomStatus = qrToken.booking.room.status;
    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      await tx.bookingQrToken.update({
        data: {
          scanIpAddress: context.ipAddress,
          scanUserAgent: context.userAgent,
          status: 'USED',
          usedAt: checkedInAt,
          usedByUserId: user.id,
          usedDeviceId: dto.deviceId ?? context.deviceId,
        },
        where: { id: qrToken.id },
      });
      const booking = await tx.booking.update({
        data: {
          checkedInAt,
          status: 'CHECKED_IN',
        },
        include: {
          city: true,
          guests: { where: { deletedAt: null } },
          lodge: true,
          room: true,
          roomType: true,
        },
        where: { id: qrToken.bookingId },
      });
      await tx.room.update({
        data: { status: 'OCCUPIED' },
        where: { id: assignedRoomId },
      });
      await tx.roomStatusHistory.create({
        data: {
          actorUserId: user.id,
          bookingId: qrToken.bookingId,
          fromStatus: assignedRoomStatus,
          reason: 'QR_CHECK_IN',
          roomId: assignedRoomId,
          toStatus: 'OCCUPIED',
        },
      });
      await tx.bookingHistory.create({
        data: {
          action: 'BOOKING_CHECKED_IN_BY_QR',
          actorUserId: user.id,
          bookingId: qrToken.bookingId,
          fromStatus: previousBookingStatus,
          metadata: { qrTokenId: qrToken.id },
          toStatus: 'CHECKED_IN',
        },
      });
      await tx.qrScanLog.create({
        data: {
          bookingId: qrToken.bookingId,
          deviceId: dto.deviceId ?? context.deviceId,
          ipAddress: context.ipAddress,
          lodgeId: qrToken.booking.lodgeId,
          qrTokenId: qrToken.id,
          result: 'SUCCESS',
          scannedByUserId: user.id,
          userAgent: context.userAgent,
        },
      });

      return booking;
    });
    const register = await this.guestRegisterService.createFromBooking({
      actorUserId: user.id,
      booking: updatedBooking,
      qrTokenId: qrToken.id,
    });
    await this.notificationEventsService.checkinCompleted(
      qrToken.bookingId,
      qrToken.booking.lodgeId,
    );

    return {
      booking: await this.bookingsService.getOwnerUnlockedBookingView(qrToken.bookingId, user),
      register,
      scanResult: 'SUCCESS',
    };
  }

  private async assertCanGenerateQr(booking: BookingForQr, user: AuthenticatedUser): Promise<void> {
    await this.lodgeAccessService.assertCanManageLodge(user, booking.lodgeId);

    if (!booking.lodge.isActive || booking.lodge.deletedAt) {
      throw new BadRequestException('Lodge is not active');
    }

    if (booking.lodge.status !== 'VERIFIED' || booking.lodge.verificationStatus !== 'VERIFIED') {
      throw new BadRequestException('Lodge is not verified');
    }
  }

  private async findBookingForQrOrThrow(bookingId: string): Promise<BookingForQr> {
    const booking = await this.prisma.booking.findFirst({
      include: {
        lodge: true,
        room: true,
        roomType: true,
      },
      where: {
        deletedAt: null,
        id: bookingId,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async logScanFailure(
    result: PrismaQrScanResult,
    failureReason: string,
    user: AuthenticatedUser,
    context: ScanContext,
    bookingId?: string,
    qrTokenId?: string,
    lodgeId?: string,
  ): Promise<void> {
    await this.prisma.qrScanLog.create({
      data: {
        bookingId,
        deviceId: context.deviceId,
        failureReason,
        ipAddress: context.ipAddress,
        lodgeId,
        qrTokenId,
        result,
        scannedByUserId: user.id,
        userAgent: context.userAgent,
      },
    });
  }
}
