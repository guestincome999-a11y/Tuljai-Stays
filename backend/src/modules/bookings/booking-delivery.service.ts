import { randomUUID } from 'node:crypto';

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { BookingDeliveryJob } from '@prisma/client';

import { EmailService, isEmailRecipient } from '../../shared/email/email.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';

import {
  confirmationEmail,
  generateBookingPass,
  passLogo,
  type BookingPassDetails,
} from './booking-pass';
import {
  deliveryFailure,
  DELIVERY_LEASE_MS,
  DELIVERY_MAX_ATTEMPTS,
  retryDelayMs,
} from './confirmation-outbox';
import { QrCheckinService } from './qr-checkin.service';

@Injectable()
export class BookingDeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingDeliveryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly activeJobs = new Map<string, { type: string; promise: Promise<void> }>();
  public constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly qr: QrCheckinService,
    private readonly events: NotificationEventsService,
  ) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.drain();
    }, 1_000);
    this.timer.unref();
    void this.drain();
  }
  public async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([...this.activeJobs.values()].map((job) => job.promise));
  }

  public async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      // Email providers have no submission idempotency key. Never resend possibly accepted mail.
      const expired = await this.prisma.bookingDeliveryJob.updateMany({
        where: { status: 'SUBMITTING', leaseUntil: { lt: now } },
        data: {
          status: 'FAILED',
          lastError: 'SUBMISSION_UNKNOWN',
          leaseToken: null,
          leaseUntil: null,
        },
      });
      if (expired.count)
        this.logger.error({
          operation: 'booking_delivery_recovery',
          status: 'FAILED',
          error: 'SUBMISSION_UNKNOWN',
          count: expired.count,
        });
      const enabled = process.env.BOOKING_EMAIL_ENABLED === 'true';
      const active = [...this.activeJobs.values()];
      let eventSlots = 10 - active.filter((job) => job.type === 'CONFIRMATION_EVENTS').length;
      let emailSlots = 4 - active.filter((job) => job.type === 'CONFIRMATION_EMAIL').length;
      if (eventSlots <= 0 && (!enabled || emailSlots <= 0)) return;
      const allowlist = process.env.BOOKING_EMAIL_ALLOWED_RECIPIENTS?.split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const due = {
        OR: [
          { status: { in: ['PENDING', 'RETRYING'] }, nextAttemptAt: { lte: now } },
          { status: 'PROCESSING', leaseUntil: { lt: now } },
        ],
      };
      // Separate bounded reads prevent an older email backlog from starving new alerts.
      const batches = await Promise.all([
        eventSlots > 0
          ? this.prisma.bookingDeliveryJob.findMany({
              where: { ...due, type: 'CONFIRMATION_EVENTS' },
              orderBy: { nextAttemptAt: 'asc' },
              take: eventSlots,
            })
          : [],
        enabled && emailSlots > 0
          ? this.prisma.bookingDeliveryJob.findMany({
              where: {
                ...due,
                type: 'CONFIRMATION_EMAIL',
                ...(allowlist?.length ? { recipient: { in: allowlist } } : {}),
              },
              orderBy: { nextAttemptAt: 'asc' },
              take: emailSlots,
            })
          : [],
      ]);
      const jobs = batches.flat();
      // Keep notification capacity available while earlier emails await an external provider.
      for (const job of jobs) {
        if (this.activeJobs.has(job.id)) continue;
        if (job.type === 'CONFIRMATION_EVENTS') {
          if (eventSlots-- <= 0) continue;
        } else if (emailSlots-- <= 0) continue;
        const promise = this.claimAndProcess(job)
          .catch(() => {
            this.logger.error({ operation: 'booking_delivery_job_failed', jobId: job.id });
          })
          .finally(() => {
            this.activeJobs.delete(job.id);
          });
        this.activeJobs.set(job.id, { type: job.type, promise });
      }
    } catch {
      this.logger.error({
        operation: 'booking_delivery_cycle',
        error: 'DATABASE_OR_WORKER_FAILURE',
      });
    } finally {
      this.running = false;
    }
  }

  public async claimAndProcess(job: BookingDeliveryJob): Promise<void> {
    if (job.attempts >= DELIVERY_MAX_ATTEMPTS) {
      await this.prisma.bookingDeliveryJob.updateMany({
        where: {
          id: job.id,
          status: job.status,
          attempts: job.attempts,
          leaseToken: job.leaseToken,
        },
        data: {
          status: 'FAILED',
          lastError: 'RETRY_LIMIT_REACHED',
          leaseUntil: null,
          leaseToken: null,
        },
      });
      return;
    }
    const leaseToken = randomUUID();
    const claim = await this.prisma.bookingDeliveryJob.updateMany({
      where: {
        id: job.id,
        status: job.status,
        attempts: job.attempts,
        leaseToken: job.leaseToken,
        ...(job.status === 'PROCESSING' ? { leaseUntil: { lt: new Date() } } : {}),
      },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        leaseToken,
        leaseUntil: new Date(Date.now() + DELIVERY_LEASE_MS),
        submissionStartedAt: null,
      },
    });
    if (!claim.count) return;
    const started = performance.now();
    let submitting = false;
    const owned = { id: job.id, leaseToken };
    const heartbeat = setInterval(() => {
      void this.prisma.bookingDeliveryJob
        .updateMany({
          where: { ...owned, status: { in: ['PROCESSING', 'SUBMITTING'] } },
          data: { leaseUntil: new Date(Date.now() + DELIVERY_LEASE_MS) },
        })
        .catch(() => this.logger.warn({ operation: 'booking_delivery_lease', jobId: job.id }));
    }, 30_000);
    heartbeat.unref();
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: job.bookingId },
        include: { lodge: { include: { address: true } }, roomType: true, room: true },
      });
      if (
        !booking ||
        booking.deletedAt ||
        !['ACCEPTED', 'QR_GENERATED'].includes(booking.status) ||
        booking.paymentStatus === 'REFUNDED'
      ) {
        await this.prisma.bookingDeliveryJob.updateMany({
          where: owned,
          data: {
            status: 'SKIPPED',
            lastError: 'BOOKING_NO_LONGER_ELIGIBLE',
            leaseToken: null,
            leaseUntil: null,
          },
        });
        return;
      }
      if (job.type === 'CONFIRMATION_EVENTS') {
        this.events.bookingCommitted(booking);
        await this.events.bookingAccepted(booking.id);
        if (booking.paymentStatus === 'FULLY_PAID') {
          await this.events.prepaidBookingConfirmed(booking.id);
          await this.events.bookingPaymentConfirmed(booking.id);
        }
        await this.prisma.bookingDeliveryJob.updateMany({
          where: owned,
          data: {
            status: 'SENT',
            sentAt: new Date(),
            lastError: null,
            leaseToken: null,
            leaseUntil: null,
          },
        });
        return;
      }
      if (!job.recipient) {
        await this.prisma.bookingDeliveryJob.updateMany({
          where: owned,
          data: {
            status: 'SKIPPED',
            lastError: 'NO_RECIPIENT',
            leaseToken: null,
            leaseUntil: null,
          },
        });
        return;
      }
      if (!isEmailRecipient(job.recipient))
        throw Object.assign(new Error('Invalid recipient'), { code: 'INVALID_RECIPIENT' });
      const metadata = await this.qr.getQrMetadata(
        booking.id,
        { id: booking.pilgrimUserId, roles: ['PILGRIM'], isActive: true, phoneNumber: null },
        true,
      );
      const address = booking.lodge.address;
      const atTime = (date: Date, time: string | null) =>
        `${date.toISOString().slice(0, 10)}${time ? ` at ${time}` : ' (confirm arrival time with lodge)'}`;
      const details: BookingPassDetails = {
        bookingCode: booking.bookingCode,
        guestName: booking.guestName,
        lodgeName: booking.lodge.name,
        address: address
          ? [
              address.addressLine1,
              address.addressLine2,
              address.landmark,
              address.city,
              address.district,
              address.state,
              address.pincode,
              address.country,
            ]
              .filter(Boolean)
              .join(', ')
          : 'Address not provided by lodge',
        checkIn: atTime(
          booking.checkInDate,
          booking.expectedCheckInTime ?? booking.lodge.checkInTime,
        ),
        checkOut: atTime(
          booking.checkOutDate,
          booking.expectedCheckOutTime ?? booking.lodge.checkOutTime,
        ),
        room: [
          booking.roomType.name,
          booking.room?.roomNumber ? `Room ${booking.room.roomNumber}` : null,
        ]
          .filter(Boolean)
          .join(' - '),
        guests: booking.totalGuests,
        amount:
          booking.totalAmount === null
            ? 'Not recorded'
            : `INR ${Number(booking.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        paymentStatus:
          booking.paymentStatus === 'PAY_AT_LODGE'
            ? 'Pending - pay at lodge'
            : booking.paymentStatus.replace(/_/g, ' '),
        paymentMethod:
          booking.paymentStatus === 'PAY_AT_LODGE' ? 'Pay at lodge' : 'Online - Razorpay',
        instructions: `Bring your original photo ID and this booking pass.\n${booking.lodge.rules ?? 'Follow the lodge check-in and guest policies.'}`,
        support: process.env.EMAIL_SUPPORT_ADDRESS
          ? `Booking support: ${process.env.EMAIL_SUPPORT_ADDRESS}`
          : 'For assistance, open your booking in the Tuljai Stays app and contact the lodge.',
        bookingUrl: process.env.BOOKING_WEB_URL_TEMPLATE?.replace(
          '{bookingId}',
          encodeURIComponent(booking.id),
        ),
        qrPayload: metadata.qrPayload,
      };
      const { pdf, qr } = await generateBookingPass(details);
      // Recheck cancellation/refund after potentially slow PDF work, before provider submission.
      const current = await this.prisma.booking.findUnique({
        where: { id: booking.id },
        select: { status: true, paymentStatus: true, deletedAt: true },
      });
      if (
        !current ||
        current.deletedAt ||
        !['ACCEPTED', 'QR_GENERATED'].includes(current.status) ||
        current.paymentStatus === 'REFUNDED'
      ) {
        await this.prisma.bookingDeliveryJob.updateMany({
          where: owned,
          data: {
            status: 'SKIPPED',
            lastError: 'BOOKING_NO_LONGER_ELIGIBLE',
            leaseToken: null,
            leaseUntil: null,
          },
        });
        return;
      }
      const message = {
        ...confirmationEmail(details),
        to: job.recipient,
        subject: 'Your Tuljai Stays Booking is Confirmed!',
        messageId: `<booking-${job.id}@tuljai-stays.invalid>`,
        attachments: [
          {
            filename: `Tuljai-Stays-${booking.bookingCode.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
          { cid: 'booking-qr', content: qr, contentType: 'image/png' },
          { cid: 'tuljai-logo', content: passLogo(), contentType: 'image/png' },
        ],
      };
      const marked = await this.prisma.bookingDeliveryJob.updateMany({
        where: { ...owned, status: 'PROCESSING', leaseUntil: { gt: new Date() } },
        data: {
          status: 'SUBMITTING',
          submissionStartedAt: new Date(),
          leaseUntil: new Date(Date.now() + DELIVERY_LEASE_MS),
        },
      });
      if (!marked.count) return;
      submitting = true;
      const result = await this.email.submit(message);
      this.logger.log({
        operation: 'booking_email_provider_accepted',
        bookingId: booking.id,
        jobId: job.id,
        providerMessageId: result.messageId,
      });
      await this.prisma.bookingDeliveryJob.updateMany({
        where: owned,
        data: {
          status: 'SENT',
          sentAt: new Date(),
          providerMessageId: result.messageId,
          lastError: null,
          leaseToken: null,
          leaseUntil: null,
        },
      });
    } catch (error) {
      const failure = submitting
        ? deliveryFailure(error)
        : {
            reason:
              (error as { code?: string })?.code === 'INVALID_RECIPIENT'
                ? 'INVALID_RECIPIENT'
                : 'PASS_OR_NOTIFICATION_FAILED',
            permanent: (error as { code?: string })?.code === 'INVALID_RECIPIENT',
            uncertain: false,
          };
      const failed = failure.permanent || job.attempts + 1 >= DELIVERY_MAX_ATTEMPTS;
      await this.prisma.bookingDeliveryJob.updateMany({
        where: owned,
        data: {
          status: failed ? 'FAILED' : 'RETRYING',
          lastError: failure.reason,
          nextAttemptAt: new Date(Date.now() + retryDelayMs(job.attempts + 1)),
          leaseToken: null,
          leaseUntil: null,
          ...(!failure.uncertain ? { submissionStartedAt: null } : {}),
        },
      });
      this.logger.warn({
        operation: 'booking_delivery_attempt',
        bookingId: job.bookingId,
        jobId: job.id,
        type: job.type,
        attempt: job.attempts + 1,
        status: failed ? 'FAILED' : 'RETRYING',
        error: failure.reason,
      });
    } finally {
      clearInterval(heartbeat);
      this.logger.log({
        operation: 'booking_background_completed',
        bookingId: job.bookingId,
        type: job.type,
        durationMs: Math.round(performance.now() - started),
      });
    }
  }
}
