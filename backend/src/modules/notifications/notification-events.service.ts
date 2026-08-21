import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationEventsService {
  public constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  public async bookingCreated(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      include: { lodge: { include: { owners: { where: { deletedAt: null, isActive: true } } } } },
      where: { id: bookingId },
    });

    if (!booking) {
      return;
    }

    const payload = {
      bookingCode: booking.bookingCode,
      bookingId: booking.id,
      checkInDate: booking.checkInDate.toISOString().slice(0, 10),
      checkOutDate: booking.checkOutDate.toISOString().slice(0, 10),
      checkoutDateFlexible: booking.checkoutDateFlexible,
      guestName: booking.guestName,
      lodgeId: booking.lodgeId,
      ownerResponseDeadline: booking.ownerResponseDeadline?.toISOString() ?? null,
      roomTypeId: booking.roomTypeId,
      specialRequest: booking.specialRequest,
      totalGuests: booking.totalGuests,
    };

    for (const owner of booking.lodge.owners) {
      this.realtimeEventsService.publishToUser(owner.userId, 'booking:new', payload);
      this.realtimeEventsService.publishToUser(owner.userId, 'owner:alert', payload);
      await this.notificationsService.create({
        body: `New booking request ${booking.bookingCode}`,
        bookingId: booking.id,
        data: payload,
        lodgeId: booking.lodgeId,
        priority: 'HIGH',
        recipientRole: 'OWNER',
        recipientUserId: owner.userId,
        title: 'New booking request',
        type: 'BOOKING_REQUEST',
      });
    }

    await this.notificationsService.create({
      body: `Your booking ${booking.bookingCode} has been confirmed.`,
      bookingId: booking.id,
      data: payload,
      lodgeId: booking.lodgeId,
      priority: 'NORMAL',
      recipientRole: 'PILGRIM',
      recipientUserId: booking.pilgrimUserId,
      title: 'Booking confirmed',
      type: 'BOOKING_CONFIRMED',
    });

    this.realtimeEventsService.publishToRole('ADMIN', 'dashboard:update', {
      bookingId: booking.id,
      type: 'booking:new',
    });
  }

  public async bookingAccepted(bookingId: string): Promise<void> {
    await this.notifyPilgrimBookingStatus(
      bookingId,
      'booking:accepted',
      'BOOKING_ACCEPTED',
      'Booking accepted',
    );
  }

  public async bookingRejected(bookingId: string): Promise<void> {
    await this.notifyPilgrimBookingStatus(
      bookingId,
      'booking:rejected',
      'BOOKING_REJECTED',
      'Booking rejected',
    );
  }

  public async bookingCancelled(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      include: { lodge: { include: { owners: { where: { deletedAt: null, isActive: true } } } } },
      where: { id: bookingId },
    });
    if (!booking) return;

    const payload = {
      bookingCode: booking.bookingCode,
      bookingId: booking.id,
      lodgeId: booking.lodgeId,
      status: booking.status,
    };
    this.realtimeEventsService.publishToUser(booking.pilgrimUserId, 'booking:cancelled', payload);
    await this.notificationsService.create({
      body: `Booking ${booking.bookingCode} was cancelled.`,
      bookingId: booking.id,
      data: payload,
      lodgeId: booking.lodgeId,
      priority: 'HIGH',
      recipientRole: 'PILGRIM',
      recipientUserId: booking.pilgrimUserId,
      title: 'Booking cancelled',
      type: 'BOOKING_CANCELLED',
    });
    for (const owner of booking.lodge.owners) {
      this.realtimeEventsService.publishToUser(owner.userId, 'booking:cancelled', payload);
      await this.notificationsService.create({
        body: `Booking ${booking.bookingCode} was cancelled by the pilgrim.`,
        bookingId: booking.id,
        data: payload,
        lodgeId: booking.lodgeId,
        priority: 'HIGH',
        recipientRole: 'OWNER',
        recipientUserId: owner.userId,
        title: 'Booking cancelled',
        type: 'BOOKING_CANCELLED',
      });
    }
    this.realtimeEventsService.publishToRole('ADMIN', 'dashboard:update', {
      bookingId: booking.id,
      type: 'booking:cancelled',
    });
  }

  public async bookingExpired(bookingId: string): Promise<void> {
    await this.notifyPilgrimBookingStatus(
      bookingId,
      'booking:expired',
      'SYSTEM',
      'Booking expired',
    );
    this.realtimeEventsService.publishToRole('ADMIN', 'booking:expired', { bookingId });
  }

  public async qrGenerated(bookingId: string): Promise<void> {
    await this.notifyPilgrimBookingStatus(
      bookingId,
      'qr:generated',
      'QR_GENERATED',
      'QR generated',
    );
  }

  public async checkinCompleted(
    bookingId: string,
    lodgeId: string,
    scannedByUserId?: string,
  ): Promise<void> {
    await this.notifyPilgrimBookingStatus(
      bookingId,
      'checkin:completed',
      'CHECKIN_COMPLETED',
      'Check-in completed',
    );
    const payload = { bookingId, lodgeId };
    this.realtimeEventsService.publishToLodge(lodgeId, 'checkin:completed', payload);
    if (scannedByUserId) {
      this.realtimeEventsService.publishToUser(scannedByUserId, 'qr:scan-success', payload);
    }
    this.realtimeEventsService.publishToRole('ADMIN', 'qr:scan-success', payload);
  }

  public qrScanFailed(userId: string, bookingId?: string): void {
    const payload = { bookingId, scannedByUserId: userId };
    this.realtimeEventsService.publishToUser(userId, 'qr:scan-failed', payload);
    this.realtimeEventsService.publishToRole('ADMIN', 'qr:scan-failed', payload);
  }

  public async checkoutCompleted(bookingId: string, lodgeId: string): Promise<void> {
    await this.notifyPilgrimBookingStatus(
      bookingId,
      'checkout:completed',
      'CHECKOUT_COMPLETED',
      'Checkout completed',
    );
    const payload = {
      bookingId,
      lodgeId,
    };
    this.realtimeEventsService.publishToLodge(lodgeId, 'checkout:completed', payload);
    this.realtimeEventsService.publishToLodge(lodgeId, 'room:availability-updated', payload);
  }

  public async photoReviewed(lodgeId: string, photoId: string, approved: boolean): Promise<void> {
    const owners = await this.prisma.lodgeOwner.findMany({
      where: { deletedAt: null, isActive: true, lodgeId },
    });
    const type = approved ? 'PHOTO_APPROVED' : 'PHOTO_REJECTED';

    for (const owner of owners) {
      await this.notificationsService.create({
        body: approved ? 'A lodge photo was approved.' : 'A lodge photo was rejected.',
        data: { lodgeId, photoId },
        lodgeId,
        priority: 'NORMAL',
        recipientRole: 'OWNER',
        recipientUserId: owner.userId,
        title: approved ? 'Photo approved' : 'Photo rejected',
        type,
      });
    }
    this.realtimeEventsService.publishToRole('ADMIN', 'dashboard:update', {
      photoId,
      type: approved ? 'photo:approved' : 'photo:rejected',
    });
  }

  private async notifyPilgrimBookingStatus(
    bookingId: string,
    event: string,
    type:
      | 'BOOKING_ACCEPTED'
      | 'BOOKING_REJECTED'
      | 'QR_GENERATED'
      | 'CHECKIN_COMPLETED'
      | 'CHECKOUT_COMPLETED'
      | 'SYSTEM',
    title: string,
  ): Promise<void> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking) {
      return;
    }

    const payload = {
      bookingCode: booking.bookingCode,
      bookingId: booking.id,
      lodgeId: booking.lodgeId,
      qrReady: booking.status === 'ACCEPTED' || booking.status === 'QR_GENERATED',
      status: booking.status,
      updatedAt: booking.updatedAt.toISOString(),
    };
    this.realtimeEventsService.publishToUser(booking.pilgrimUserId, event, payload);
    this.realtimeEventsService.publishToRole('ADMIN', 'dashboard:update', {
      bookingId: booking.id,
      type: event,
    });
    await this.notificationsService.create({
      body: `${title}: ${booking.bookingCode}`,
      bookingId: booking.id,
      data: payload,
      lodgeId: booking.lodgeId,
      priority: 'NORMAL',
      recipientRole: 'PILGRIM',
      recipientUserId: booking.pilgrimUserId,
      title,
      type,
    });
  }
}
