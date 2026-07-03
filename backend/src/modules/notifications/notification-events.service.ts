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
        recipientUserId: owner.userId,
        title: 'New booking request',
        type: 'BOOKING_REQUEST',
      });
    }
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

  public async checkinCompleted(bookingId: string, lodgeId: string): Promise<void> {
    await this.notifyPilgrimBookingStatus(
      bookingId,
      'checkin:completed',
      'CHECKIN_COMPLETED',
      'Check-in completed',
    );
    this.realtimeEventsService.publishToLodge(lodgeId, 'checkin:completed', { bookingId, lodgeId });
    this.realtimeEventsService.publishToRole('ADMIN', 'dashboard:update', {
      bookingId,
      type: 'checkin:completed',
    });
  }

  public qrScanFailed(userId: string, bookingId?: string): void {
    this.realtimeEventsService.publishToUser(userId, 'qr:scan-failed', { bookingId });
  }

  public async checkoutCompleted(bookingId: string, lodgeId: string): Promise<void> {
    await this.notifyPilgrimBookingStatus(
      bookingId,
      'checkout:completed',
      'CHECKOUT_COMPLETED',
      'Checkout completed',
    );
    this.realtimeEventsService.publishToLodge(lodgeId, 'checkout:completed', {
      bookingId,
      lodgeId,
    });
    this.realtimeEventsService.publishToLodge(lodgeId, 'room:availability-updated', {
      bookingId,
      lodgeId,
    });
    this.realtimeEventsService.publishToRole('ADMIN', 'dashboard:update', {
      bookingId,
      type: 'checkout:completed',
    });
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
      status: booking.status,
    };
    this.realtimeEventsService.publishToUser(booking.pilgrimUserId, event, payload);
    await this.notificationsService.create({
      body: `${title}: ${booking.bookingCode}`,
      bookingId: booking.id,
      data: payload,
      lodgeId: booking.lodgeId,
      priority: 'NORMAL',
      recipientUserId: booking.pilgrimUserId,
      title,
      type,
    });
  }
}
