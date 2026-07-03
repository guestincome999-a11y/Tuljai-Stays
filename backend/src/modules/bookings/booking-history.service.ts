import { Injectable } from '@nestjs/common';

import { BookingStatus, Prisma } from '../../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

interface CreateBookingHistoryInput {
  action: string;
  actorUserId?: string | null;
  bookingId: string;
  fromStatus?: BookingStatus | null;
  metadata?: Prisma.InputJsonValue;
  notes?: string | null;
  toStatus: BookingStatus;
}

@Injectable()
export class BookingHistoryService {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreateBookingHistoryInput): Promise<void> {
    await this.prisma.bookingHistory.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId,
        bookingId: input.bookingId,
        fromStatus: input.fromStatus,
        metadata: input.metadata,
        notes: input.notes,
        toStatus: input.toStatus,
      },
    });
  }
}
