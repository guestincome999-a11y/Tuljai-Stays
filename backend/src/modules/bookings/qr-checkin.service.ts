import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type BookingQrToken, Prisma, QrScanResult as PrismaQrScanResult } from '@prisma/client';
import type {
  AuthenticatedUser,
  CheckInResponse,
  QrDisplayPayload,
  QrPayload,
  QrScanLogEntry,
  PaginatedResponse,
} from '@tuljai/types';
import { normalizePagination } from '@tuljai/utils';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { LodgeAccessService } from '../lodges/lodge-access.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';

import { BookingsService } from './bookings.service';
import type { GenerateQrDto, QrScanLogQueryDto, ScanQrDto } from './dto/qr-register.dto';
import { GuestRegisterService } from './guest-register.service';

interface ScanContext {
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface SignedQrPayloadBody {
  bookingCode: string;
  bookingId: string;
  expiresAt: string;
  qrTokenId: string;
  tokenVersion: number;
  version: 1;
}

type QrTokenWithBooking = Prisma.BookingQrTokenGetPayload<{
  include: {
    booking: {
      include: {
        lodge: true;
        room: true;
        roomType: true;
      };
    };
  };
}>;

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
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId}::uuid FOR UPDATE`;
      const current = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      if (current.deletedAt || current.status !== 'ACCEPTED')
        throw new ConflictException('Booking changed; use the existing booking pass');
      const existing = await tx.bookingQrToken.findFirst({
        where: { bookingId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      });
      if (existing)
        throw new ConflictException('An active QR token already exists for this booking');
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

  public async getQrMetadata(
    bookingId: string,
    user: AuthenticatedUser,
    opaque = false,
  ): Promise<QrDisplayPayload> {
    const booking = await this.findBookingForQrOrThrow(bookingId);

    if (booking.pilgrimUserId !== user.id) {
      throw new ForbiddenException('Only the pilgrim can view QR display payload');
    }

    if (!['ACCEPTED', 'QR_GENERATED'].includes(booking.status)) {
      throw new BadRequestException('QR is available only for accepted bookings');
    }

    if (booking.lodge.deletedAt) {
      throw new BadRequestException('Lodge is not available');
    }
    if (booking.lodge.status !== 'VERIFIED' || booking.lodge.verificationStatus !== 'VERIFIED') {
      throw new BadRequestException('Lodge is not verified');
    }

    const qrToken = await this.ensureActiveQrToken(booking);

    return {
      bookingCode: booking.bookingCode,
      bookingId,
      expiresAt: qrToken.expiresAt.toISOString(),
      qrPayload: this.signQrDisplayPayload(
        {
          bookingCode: booking.bookingCode,
          bookingId,
          expiresAt: qrToken.expiresAt.toISOString(),
          qrTokenId: qrToken.id,
          tokenVersion: qrToken.tokenVersion,
          version: 1,
        },
        opaque || this.configService.get<boolean>('api.booking.qrOpaqueEnabled', false),
      ),
      status: qrToken.status,
      tokenVersion: qrToken.tokenVersion,
    };
  }

  public async scanQr(
    dto: ScanQrDto,
    user: AuthenticatedUser,
    context: ScanContext,
  ): Promise<CheckInResponse> {
    const qrToken = await this.resolveQrTokenFromScanDto(dto);

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

    // Authorization precedes replay handling; a used token never grants access.
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
    if (dto.idempotencyKey && dto.idempotencyKey !== `checkin.${qrToken.id}`) {
      throw new BadRequestException('Invalid check-in idempotency key');
    }
    if (qrToken.booking.deletedAt) throw new NotFoundException('Booking not found');
    if (qrToken.booking.status === 'CANCELLED') throw new BadRequestException('Booking cancelled');
    if (qrToken.status === 'USED' || qrToken.usedAt) {
      return this.existingCheckinResult(qrToken, user);
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
    let replayed = false;
    const register = await this.prisma
      .$transaction(async (tx) => {
        const claimed = await tx.bookingQrToken.updateMany({
          data: {
            scanIpAddress: context.ipAddress,
            scanUserAgent: context.userAgent,
            status: 'USED',
            usedAt: checkedInAt,
            usedByUserId: user.id,
            usedDeviceId: dto.deviceId ?? context.deviceId,
          },
          where: { id: qrToken.id, status: 'ACTIVE', usedAt: null, expiresAt: { gt: checkedInAt } },
        });
        if (claimed.count !== 1)
          throw new ConflictException('QR token has already been used or is no longer active');
        const bookingClaim = await tx.booking.updateMany({
          data: {
            checkedInAt,
            status: 'CHECKED_IN',
          },
          where: {
            id: qrToken.bookingId,
            status: { in: ['ACCEPTED', 'QR_GENERATED'] },
            roomId: assignedRoomId,
            deletedAt: null,
          },
        });
        if (bookingClaim.count !== 1)
          throw new ConflictException('Booking status or room assignment changed; scan again');
        const booking = await tx.booking.findUniqueOrThrow({
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

        return this.guestRegisterService.createFromBooking(
          {
            actorUserId: user.id,
            booking,
            qrTokenId: qrToken.id,
          },
          tx,
        );
      })
      .catch(async (error: unknown) => {
        // A competing device may have committed while our conditional claim waited.
        // Return the committed register rather than repeating any transition/history.
        if (error instanceof ConflictException) {
          const fresh = await this.resolveQrTokenFromScanDto(dto);
          if (fresh?.status === 'USED' && fresh.booking.status === 'CHECKED_IN') {
            replayed = true;
            return (await this.existingCheckinResult(fresh, user)).register;
          }
        }
        throw error;
      });
    if (!replayed)
      await this.notificationEventsService.checkinCompleted(
        qrToken.bookingId,
        qrToken.booking.lodgeId,
        user.id,
      );

    return {
      booking: await this.bookingsService.getOwnerUnlockedBookingView(qrToken.bookingId, user),
      register,
      scanResult: replayed ? 'USED' : 'SUCCESS',
    };
  }

  /** Called only after an admin has verified the booking's identity on the server. */
  public async verifyManualCheckin(
    bookingId: string,
    user: AuthenticatedUser,
  ): Promise<CheckInResponse> {
    const booking = await this.findBookingForQrOrThrow(bookingId);
    await this.lodgeAccessService.assertCanManageLodge(user, booking.lodgeId);
    const token = await this.prisma.bookingQrToken.findFirst({
      where: { bookingId, status: { in: ['ACTIVE', 'USED'] } },
      orderBy: { tokenVersion: 'desc' },
    });
    if (!token)
      throw new BadRequestException('No eligible QR token. Review the booking before check-in.');
    const qrPayload = this.signQrDisplayPayload({
      bookingCode: booking.bookingCode,
      bookingId,
      qrTokenId: token.id,
      tokenVersion: token.tokenVersion,
      expiresAt: token.expiresAt.toISOString(),
      version: 1,
    });
    return this.scanQr({ bookingId, qrPayload, idempotencyKey: `checkin.${token.id}` }, user, {});
  }

  private async existingCheckinResult(
    qrToken: QrTokenWithBooking,
    user: AuthenticatedUser,
  ): Promise<CheckInResponse> {
    await this.lodgeAccessService.assertCanManageLodge(user, qrToken.booking.lodgeId);
    if (qrToken.booking.status !== 'CHECKED_IN' || qrToken.booking.deletedAt) {
      throw new BadRequestException('Booking is not currently checked in');
    }
    const register = await this.prisma.guestRegister.findUnique({
      where: { bookingId: qrToken.bookingId },
    });
    if (!register || register.deletedAt)
      throw new ConflictException('Check-in register is not ready; retry');
    return {
      booking: await this.bookingsService.getOwnerUnlockedBookingView(qrToken.bookingId, user),
      register: await this.guestRegisterService.getRegister(register.id, user, false),
      scanResult: 'USED',
    };
  }

  public async listOwnerScanLogs(
    query: QrScanLogQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<QrScanLogEntry>> {
    if (query.lodgeId) {
      await this.lodgeAccessService.assertCanManageLodge(user, query.lodgeId);
    }

    const pagination = normalizePagination(query.page, query.limit);
    const where: Prisma.QrScanLogWhereInput = {
      ...(query.lodgeId ? { lodgeId: query.lodgeId } : {}),
      ...(query.result ? { result: query.result } : {}),
      ...(query.fromDate || query.toDate
        ? {
            createdAt: {
              gte: query.fromDate ? new Date(query.fromDate) : undefined,
              lte: query.toDate ? new Date(query.toDate) : undefined,
            },
          }
        : {}),
      ...(this.lodgeAccessService.isAdmin(user)
        ? {}
        : {
            lodge: {
              owners: {
                some: {
                  deletedAt: null,
                  isActive: true,
                  userId: user.id,
                },
              },
            },
          }),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.qrScanLog.findMany({
        include: { booking: true, lodge: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        where,
      }),
      this.prisma.qrScanLog.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        bookingCode: item.booking?.bookingCode ?? null,
        bookingId: item.bookingId,
        createdAt: item.createdAt.toISOString(),
        failureReason: item.failureReason,
        guestName: item.booking?.guestName ?? null,
        id: item.id,
        lodgeId: item.lodgeId,
        lodgeName: item.lodge?.name ?? null,
        result: item.result,
      })),
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  private async assertCanGenerateQr(booking: BookingForQr, user: AuthenticatedUser): Promise<void> {
    await this.lodgeAccessService.assertCanManageLodge(user, booking.lodgeId);

    if (booking.lodge.deletedAt) {
      throw new BadRequestException('Lodge is not available');
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

  private async ensureActiveQrToken(booking: BookingForQr): Promise<BookingQrToken> {
    // Serialize in-app/email requests on the same booking; re-read after taking the lock.
    let createdNow = false;
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${booking.id}::uuid FOR UPDATE`;
      const fresh = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
      if (fresh.deletedAt || !['ACCEPTED', 'QR_GENERATED'].includes(fresh.status))
        throw new BadRequestException('QR is available only for accepted bookings');
      const now = new Date();
      const activeToken = await tx.bookingQrToken.findFirst({
        orderBy: { createdAt: 'desc' },
        where: {
          bookingId: booking.id,
          expiresAt: { gt: now },
          status: 'ACTIVE',
        },
      });

      if (activeToken) return activeToken;

      const defaultTtlSeconds = this.configService.get<number>(
        'api.booking.qrTokenTtlSeconds',
        86400,
      );
      const endOfStay = new Date(booking.checkOutDate);
      endOfStay.setUTCHours(23, 59, 59, 999);
      const expiresAt = new Date(
        Math.max(now.getTime() + defaultTtlSeconds * 1000, endOfStay.getTime()),
      );
      const rawToken = randomBytes(32).toString('base64url');
      const action = booking.status === 'ACCEPTED' ? 'QR_GENERATED' : 'QR_REISSUED';

      await tx.bookingQrToken.updateMany({
        data: { status: 'EXPIRED' },
        where: {
          bookingId: booking.id,
          expiresAt: { lte: now },
          status: 'ACTIVE',
        },
      });
      const token = await tx.bookingQrToken.create({
        data: {
          bookingId: booking.id,
          expiresAt,
          tokenHash: this.hashToken(rawToken),
          tokenVersion: 1,
        },
      });

      if (booking.status === 'ACCEPTED') {
        await tx.booking.update({
          data: { status: 'QR_GENERATED' },
          where: { id: booking.id },
        });
      }
      await tx.bookingHistory.create({
        data: {
          action,
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: 'QR_GENERATED',
        },
      });

      await tx.auditLog.create({
        data: {
          action,
          entityId: booking.id,
          entityType: 'booking',
          metadata: { qrTokenId: token.id },
        },
      });
      createdNow = true;
      return token;
    });
    if (createdNow)
      void this.notificationEventsService.qrGenerated(booking.id).catch(() => undefined);
    return result;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async resolveQrTokenFromScanDto(dto: ScanQrDto): Promise<QrTokenWithBooking | null> {
    if (dto.qrPayload) {
      const payloadBody = this.verifyQrDisplayPayload(dto.qrPayload);

      if (!payloadBody) {
        return null;
      }

      if (dto.bookingId && dto.bookingId !== payloadBody.bookingId) {
        return null;
      }

      return this.prisma.bookingQrToken.findFirst({
        include: {
          booking: {
            include: {
              lodge: true,
              room: true,
              roomType: true,
            },
          },
        },
        where: {
          bookingId: payloadBody.bookingId,
          id: payloadBody.qrTokenId,
          tokenVersion: payloadBody.tokenVersion,
        },
      });
    }

    if (!dto.token) {
      return null;
    }

    return this.prisma.bookingQrToken.findUnique({
      include: {
        booking: {
          include: {
            lodge: true,
            room: true,
            roomType: true,
          },
        },
      },
      where: { tokenHash: this.hashToken(dto.token) },
    });
  }

  private signQrDisplayPayload(body: SignedQrPayloadBody, opaque = false): string {
    // v1 remains readable during owner-app rollout. v2 hides all internal IDs and PII.
    if (opaque) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', this.qrEncryptionKey(), iv);
      cipher.setAAD(Buffer.from('tjsqr.v2'));
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(body), 'utf8'),
        cipher.final(),
      ]);
      return `tjsqr.v2.${iv.toString('base64url')}.${encrypted.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
    }
    const encodedBody = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
    const signature = this.signEncodedQrBody(encodedBody);

    return `tjsqr.v1.${encodedBody}.${signature}`;
  }

  /** Identify a booking for search without consuming its QR or changing stay/payment state. */
  public async lookupBookingQr(
    dto: { qrPayload: string; lodgeId?: string },
    user: AuthenticatedUser,
  ) {
    const payload = this.verifyQrDisplayPayload(dto.qrPayload, true);
    if (!payload) throw new BadRequestException('Scan a valid Tuljai Stays booking QR.');
    const token = await this.prisma.bookingQrToken.findFirst({
      where: {
        id: payload.qrTokenId,
        bookingId: payload.bookingId,
        tokenVersion: payload.tokenVersion,
      },
      select: { booking: { select: { bookingCode: true, lodgeId: true, deletedAt: true } } },
    });
    if (!token || token.booking.deletedAt) throw new NotFoundException('Booking not found.');
    await this.lodgeAccessService.assertCanManageLodge(user, token.booking.lodgeId);
    if (dto.lodgeId && dto.lodgeId !== token.booking.lodgeId) {
      throw new ForbiddenException('This booking belongs to a different lodge.');
    }
    return { bookingCode: token.booking.bookingCode };
  }

  private verifyQrDisplayPayload(
    qrPayload: string,
    allowExpired = false,
  ): SignedQrPayloadBody | null {
    if (qrPayload.startsWith('tjsqr.v2.')) {
      if (qrPayload.length > 1800) return null;
      try {
        const parts = qrPayload.split('.');
        if (parts.length !== 5) return null;
        const decipher = createDecipheriv(
          'aes-256-gcm',
          this.qrEncryptionKey(),
          Buffer.from(parts[2]!, 'base64url'),
        );
        decipher.setAAD(Buffer.from('tjsqr.v2'));
        decipher.setAuthTag(Buffer.from(parts[4]!, 'base64url'));
        const parsed: unknown = JSON.parse(
          Buffer.concat([
            decipher.update(Buffer.from(parts[3]!, 'base64url')),
            decipher.final(),
          ]).toString('utf8'),
        );
        return this.isSignedQrPayloadBody(parsed) &&
          (allowExpired || new Date(parsed.expiresAt).getTime() > Date.now())
          ? parsed
          : null;
      } catch {
        return null;
      }
    }
    const [prefix, version, encodedBody, signature] = qrPayload.split('.');

    if (prefix !== 'tjsqr' || version !== 'v1' || !encodedBody || !signature) {
      return null;
    }

    const expectedSignature = this.signEncodedQrBody(encodedBody);

    if (!this.safeEqual(signature, expectedSignature)) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(Buffer.from(encodedBody, 'base64url').toString('utf8'));

      if (!this.isSignedQrPayloadBody(parsed)) {
        return null;
      }

      if (!allowExpired && new Date(parsed.expiresAt).getTime() <= Date.now()) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private signEncodedQrBody(encodedBody: string): string {
    return createHmac('sha256', this.getQrPayloadSecret()).update(encodedBody).digest('base64url');
  }

  private qrEncryptionKey(): Buffer {
    return createHash('sha256')
      .update('tuljai:qr:encryption:v2:')
      .update(this.getQrPayloadSecret())
      .digest();
  }

  private getQrPayloadSecret(): string {
    return this.configService.getOrThrow<string>('api.jwt.accessSecret');
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private isSignedQrPayloadBody(value: unknown): value is SignedQrPayloadBody {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const payload = value as Record<string, unknown>;

    return (
      payload.version === 1 &&
      typeof payload.bookingId === 'string' &&
      typeof payload.bookingCode === 'string' &&
      typeof payload.qrTokenId === 'string' &&
      typeof payload.expiresAt === 'string' &&
      typeof payload.tokenVersion === 'number'
    );
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
