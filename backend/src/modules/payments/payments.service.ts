import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '@tuljai/types';

import { PrismaService } from '../prisma/prisma.service';

import type { PaymentProvider } from './payment-provider';

@Injectable()
export class PaymentsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async ensureOnlinePaymentsEnabled(): Promise<void> {
    const setting = await this.prisma.systemSetting.findUnique({
      select: { value: true },
      where: { key: 'enable_online_payments' },
    });
    const enabled = setting?.value === true;
    if (!enabled) {
      throw new BadRequestException('Online payments are currently unavailable');
    }
  }

  public async createPayment(
    provider: PaymentProvider,
    input: Parameters<PaymentProvider['createPayment']>[0],
    user: AuthenticatedUser,
  ) {
    await this.ensureOnlinePaymentsEnabled();
    const booking = await this.assertBookingAccess(input.bookingId, user);
    const requestedAmount = new Prisma.Decimal(input.amount).dividedBy(100);
    const totalAmount = booking.totalAmount ?? new Prisma.Decimal(0);
    const paidAggregate = await this.prisma.paymentCollection.aggregate({
      _sum: { amount: true },
      where: { bookingId: booking.id, status: 'PAID' },
    });
    const remaining = totalAmount.minus(paidAggregate._sum.amount ?? 0);
    if (requestedAmount.greaterThan(remaining) || requestedAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Payment amount must not exceed the outstanding booking balance');
    }

    const order = await provider.createPayment(input);
    await this.prisma.paymentCollection.create({
      data: {
        amount: requestedAmount,
        bookingId: booking.id,
        method: 'ONLINE',
        provider: provider.name,
        providerOrderId: order.orderId,
        status: 'PENDING',
      },
    });
    return order;
  }

  public async verifyPayment(
    provider: PaymentProvider,
    input: Parameters<PaymentProvider['verifyPayment']>[0],
    user: AuthenticatedUser,
  ) {
    const collection = await this.prisma.paymentCollection.findFirst({
      include: { booking: { select: { pilgrimUserId: true, totalAmount: true } } },
      where: { providerOrderId: input.orderId, status: 'PENDING' },
    });
    if (!collection) throw new NotFoundException('Payment order not found or is no longer pending');
    this.assertUserCanAccessBooking(collection.booking.pilgrimUserId, user);

    const result = await provider.verifyPayment(input);
    await this.prisma.$transaction(async (tx) => {
      await tx.paymentCollection.update({
        data: { paidAt: new Date(), providerPaymentId: result.providerPaymentId, status: 'PAID' },
        where: { id: collection.id },
      });
      const paidAggregate = await tx.paymentCollection.aggregate({
        _sum: { amount: true },
        where: { bookingId: collection.bookingId, status: 'PAID' },
      });
      const paid = paidAggregate._sum.amount ?? new Prisma.Decimal(0);
      await tx.booking.update({
        data: { paymentStatus: paid.greaterThanOrEqualTo(collection.booking.totalAmount ?? 0) ? 'FULLY_PAID' : 'ADVANCE_PAID' },
        where: { id: collection.bookingId },
      });
    });
    return result;
  }

  public async refundPayment(provider: PaymentProvider, paymentId: string, amount?: number) {
    return provider.refundPayment(paymentId, amount);
  }

  private async assertBookingAccess(bookingId: string, user: AuthenticatedUser) {
    const booking = await this.prisma.booking.findFirst({
      select: { id: true, pilgrimUserId: true, totalAmount: true },
      where: { deletedAt: null, id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    this.assertUserCanAccessBooking(booking.pilgrimUserId, user);
    return booking;
  }

  private assertUserCanAccessBooking(pilgrimUserId: string, user: AuthenticatedUser): void {
    if (user.id !== pilgrimUserId && !user.roles.includes('ADMIN') && !user.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('You cannot collect payment for this booking');
    }
  }
}
