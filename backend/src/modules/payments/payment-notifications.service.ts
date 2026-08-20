import { Injectable } from '@nestjs/common';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentNotificationsService {
  public constructor(private readonly notificationsService: NotificationsService) {}

  public async orderCreated(input: { bookingId: string; bookingCode: string; pilgrimUserId: string; lodgeId?: string; amount: number; orderId: string }): Promise<void> {
    await this.notificationsService.create({ body: `Online payment of ₹${input.amount.toLocaleString('en-IN')} is ready. Complete payment to confirm booking ${input.bookingCode}.`, bookingId: input.bookingId, data: { context: 'PAYMENT', operationallyImportant: true, paymentStatus: 'PENDING', orderId: input.orderId }, lodgeId: input.lodgeId, priority: 'NORMAL', recipientRole: 'PILGRIM', recipientUserId: input.pilgrimUserId, title: 'Payment ready', type: 'SYSTEM' });
  }

  public async successful(input: { bookingId: string; bookingCode: string; pilgrimUserId: string; lodgeId?: string; amount: number; paymentId: string; roomId: string }): Promise<void> {
    await this.notificationsService.create({ body: `₹${input.amount.toLocaleString('en-IN')} paid successfully. Booking ${input.bookingCode} is confirmed and your room is reserved.`, bookingId: input.bookingId, data: { context: 'PAYMENT', operationallyImportant: true, paymentStatus: 'PAID', paymentId: input.paymentId, roomId: input.roomId }, lodgeId: input.lodgeId, priority: 'HIGH', recipientRole: 'PILGRIM', recipientUserId: input.pilgrimUserId, title: 'Payment successful', type: 'SYSTEM' });
  }

  public async failed(input: { bookingId: string; bookingCode: string; pilgrimUserId: string; lodgeId?: string; amount?: number; lodgeId?: string; reason: string }): Promise<void> {
    await this.notificationsService.create({ body: `Payment for booking ${input.bookingCode} could not be verified. No room has been confirmed. ${input.reason}`, bookingId: input.bookingId, data: { context: 'PAYMENT', operationallyImportant: true, paymentStatus: 'FAILED' }, lodgeId: input.lodgeId, priority: 'HIGH', recipientRole: 'PILGRIM', recipientUserId: input.pilgrimUserId, title: 'Payment failed', type: 'SYSTEM' });
  }

  public async roomUnavailableAfterPayment(input: { bookingId: string; bookingCode: string; pilgrimUserId: string; lodgeId?: string; paymentId: string }): Promise<void> {
    await this.notificationsService.create({ body: `Payment was received for ${input.bookingCode}, but the room could not be reserved. Support needs to resolve this payment.`, bookingId: input.bookingId, data: { context: 'PAYMENT', operationallyImportant: true, paymentStatus: 'PAID_ROOM_UNAVAILABLE', paymentId: input.paymentId }, lodgeId: input.lodgeId, priority: 'CRITICAL', recipientRole: 'PILGRIM', recipientUserId: input.pilgrimUserId, title: 'Payment received — room unavailable', type: 'SYSTEM' });
  }
}
