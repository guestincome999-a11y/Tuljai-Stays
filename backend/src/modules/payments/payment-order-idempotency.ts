import { createHash } from 'node:crypto';

import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';

import type { CreatePaymentInput, PaymentOrder } from './payment-provider';
import {
  RazorpayOrderRejectedException,
  type RazorpayProvider,
} from './providers/razorpay.provider';

/** A durable claim survives both a process crash and a rolled-back booking transaction. */
export async function createIdempotentPaymentOrder(
  prisma: PrismaService,
  provider: RazorpayProvider,
  reference: string,
  input: CreatePaymentInput,
): Promise<PaymentOrder> {
  const receipt = `tjs_${createHash('sha256').update(reference).digest('hex').slice(0, 36)}`;
  const request = await prisma.paymentOrderRequest
    .upsert({
      where: { reference },
      update: {},
      create: { reference, receipt, amount: input.amount, currency: input.currency },
    })
    .catch((error: unknown) => {
      // Empty-update upserts can race during Prisma's SELECT/INSERT emulation.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return prisma.paymentOrderRequest.findUniqueOrThrow({ where: { reference } });
      }
      throw error;
    });
  if (request.amount !== input.amount || request.currency !== input.currency) {
    throw new ConflictException('Payment attempt amount changed; check its status before retrying');
  }
  const asOrder = (orderId: string): PaymentOrder => ({
    provider: 'RAZORPAY',
    orderId,
    amount: request.amount,
    currency: request.currency,
    status: 'CREATED',
  });
  if (request.providerOrderId) return asOrder(request.providerOrderId);

  const claim = await prisma.paymentOrderRequest.updateMany({
    where: { reference, status: 'NEW' },
    data: { status: 'CREATING' },
  });
  let order: PaymentOrder;
  if (claim.count) {
    try {
      order = await provider.createPayment({ ...input, receipt });
    } catch (error) {
      // Only an explicit gateway rejection proves that retrying the POST is safe.
      // Timeouts, 5xx, malformed responses and process crashes require receipt lookup.
      await prisma.paymentOrderRequest.updateMany({
        where: { reference, status: 'CREATING' },
        data: { status: error instanceof RazorpayOrderRejectedException ? 'NEW' : 'UNKNOWN' },
      });
      throw error;
    }
  } else {
    const orders = await provider.getOrdersByReceipt(receipt);
    if (orders.length > 1) {
      throw new ConflictException(
        'Multiple gateway orders match this attempt; payment needs review',
      );
    }
    const existing = orders[0];
    if (!existing) {
      throw new ServiceUnavailableException(
        'Payment order creation is pending verification. Retry this same attempt; do not start another payment.',
      );
    }
    if (existing.receipt !== receipt) {
      throw new ConflictException('Gateway order receipt does not match this attempt');
    }
    order = { ...asOrder(existing.id), amount: existing.amount, currency: existing.currency };
  }
  if (!order.orderId || order.amount !== request.amount || order.currency !== request.currency) {
    throw new ConflictException('Gateway order amount or currency does not match this attempt');
  }
  await prisma.paymentOrderRequest.update({
    where: { reference },
    data: { status: 'CREATED', providerOrderId: order.orderId },
  });
  return order;
}
