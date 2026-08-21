import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';
import type { AuthenticatedUser, PaginatedResponse, Review, ReviewReport } from '@tuljai/types';
import { normalizePagination } from '@tuljai/utils';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { LodgeAccessService } from '../lodges/lodge-access.service';

import type {
  CreateReviewDto,
  ListReviewsQueryDto,
  ModerateReviewDto,
  OwnerReviewResponseDto,
  ReportReviewDto,
} from './dto/review.dto';

interface OwnerResponseRow {
  review_id: string;
  response: string;
  updated_at: Date;
}

@Injectable()
export class ReviewsService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly lodgeAccessService: LodgeAccessService,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  public async create(dto: CreateReviewDto, user: AuthenticatedUser): Promise<Review> {
    const booking = await this.prisma.booking.findFirst({
      include: { lodge: { include: { owners: { where: { isActive: true, deletedAt: null } } } } },
      where: { deletedAt: null, id: dto.bookingId, pilgrimUserId: user.id },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (!['CHECKED_OUT', 'COMPLETED'].includes(booking.status)) {
      throw new BadRequestException('Only checked-out or completed stays can be reviewed');
    }

    const existingReview = await this.prisma.review.findUnique({ where: { bookingId: booking.id } });
    if (existingReview) throw new BadRequestException('Feedback has already been submitted for this stay');

    const review = await this.prisma.review.create({
      data: {
        bookingId: booking.id,
        cleanlinessRating: dto.cleanlinessRating,
        comment: dto.comment,
        isVerifiedStay: Boolean(booking.checkedInAt),
        locationRating: dto.locationRating,
        lodgeId: booking.lodgeId,
        pilgrimUserId: user.id,
        rating: dto.rating,
        roomTypeId: booking.roomTypeId,
        serviceRating: dto.serviceRating,
        status: 'PUBLISHED',
        title: dto.title,
        valueRating: dto.valueRating,
      },
    });

    await this.auditLogService.create({
      action: 'REVIEW_CREATED',
      actorUserId: user.id,
      entityId: review.id,
      entityType: 'review',
      metadata: { bookingId: booking.id, lodgeId: booking.lodgeId, rating: review.rating },
    });

    await Promise.all(
      booking.lodge.owners.map((owner) =>
        this.notificationsService.create({
          body: `A guest left a ${review.rating}/5 rating${review.comment ? ' and written feedback' : ''}.`,
          bookingId: booking.id,
          data: { reviewId: review.id },
          lodgeId: booking.lodgeId,
          priority: 'NORMAL',
          recipientRole: 'OWNER',
          recipientUserId: owner.userId,
          title: 'New guest feedback',
          type: 'REVIEW_RECEIVED',
        }),
      ),
    );

    return this.toReview(review, null);
  }

  public async getBookingReview(bookingId: string, user: AuthenticatedUser): Promise<Review | null> {
    const booking = await this.prisma.booking.findFirst({
      select: { id: true },
      where: { deletedAt: null, id: bookingId, pilgrimUserId: user.id },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const review = await this.prisma.review.findUnique({ where: { bookingId } });
    if (!review) return null;
    const response = await this.getOwnerResponse(review.id);
    return this.toReview(review, response);
  }

  public async listPublic(
    lodgeId: string,
    query: ListReviewsQueryDto,
  ): Promise<PaginatedResponse<Review>> {
    const pagination = normalizePagination(query.page, query.limit);
    const where: Prisma.ReviewWhereInput = { deletedAt: null, lodgeId, status: 'PUBLISHED' };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.review.findMany({ orderBy: { createdAt: 'desc' }, skip: pagination.skip, take: pagination.take, where }),
      this.prisma.review.count({ where }),
    ]);
    const responses = await this.getOwnerResponses(items.map((review) => review.id));

    return {
      items: items.map((review) => this.toReview(review, responses.get(review.id) ?? null)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  public async report(id: string, dto: ReportReviewDto, user: AuthenticatedUser): Promise<ReviewReport> {
    const review = await this.prisma.review.findFirst({ where: { deletedAt: null, id } });
    if (!review) throw new NotFoundException('Review not found');

    const report = await this.prisma.reviewReport.create({
      data: { description: dto.description, reason: dto.reason, reportedByUserId: user.id, reviewId: id },
    });
    await this.prisma.review.update({ data: { status: 'REPORTED' }, where: { id } });
    return this.toReviewReport(report);
  }

  public async listAdmin(query: ListReviewsQueryDto): Promise<PaginatedResponse<Review>> {
    const pagination = normalizePagination(query.page, query.limit);
    const where: Prisma.ReviewWhereInput = { deletedAt: null, ...(query.status ? { status: query.status } : {}) };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.review.findMany({ orderBy: { createdAt: 'desc' }, skip: pagination.skip, take: pagination.take, where }),
      this.prisma.review.count({ where }),
    ]);
    const responses = await this.getOwnerResponses(items.map((review) => review.id));
    return {
      items: items.map((review) => this.toReview(review, responses.get(review.id) ?? null)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  public async moderate(id: string, dto: ModerateReviewDto, user: AuthenticatedUser): Promise<Review> {
    const existing = await this.prisma.review.findFirst({ where: { deletedAt: null, id } });
    if (!existing) throw new NotFoundException('Review not found');

    const review = await this.prisma.review.update({ data: { status: dto.status }, where: { id } });
    await this.auditLogService.create({
      action: 'REVIEW_MODERATED',
      actorUserId: user.id,
      entityId: id,
      entityType: 'review',
      metadata: { status: dto.status },
    });
    const response = await this.getOwnerResponse(id);
    return this.toReview(review, response);
  }

  public async listOwnerReviews(
    query: ListReviewsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<Review>> {
    const pagination = normalizePagination(query.page, query.limit);
    const lodgeIds = this.lodgeAccessService.isAdmin(user)
      ? undefined
      : (await this.prisma.lodgeOwner.findMany({
          select: { lodgeId: true },
          where: { deletedAt: null, isActive: true, userId: user.id },
        })).map((assignment) => assignment.lodgeId);

    if (lodgeIds && lodgeIds.length === 0) {
      return { items: [], page: pagination.page, pageSize: pagination.pageSize, totalItems: 0, totalPages: 0 };
    }

    const where: Prisma.ReviewWhereInput = {
      deletedAt: null,
      ...(lodgeIds ? { lodgeId: { in: lodgeIds } } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.review.findMany({ orderBy: { createdAt: 'desc' }, skip: pagination.skip, take: pagination.take, where }),
      this.prisma.review.count({ where }),
    ]);
    const responses = await this.getOwnerResponses(items.map((review) => review.id));
    return {
      items: items.map((review) => this.toReview(review, responses.get(review.id) ?? null)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  public async respondAsOwner(
    id: string,
    dto: OwnerReviewResponseDto,
    user: AuthenticatedUser,
  ): Promise<Review> {
    const response = dto.response.trim();
    if (response.length < 2) throw new BadRequestException('Response must contain at least 2 characters');

    const review = await this.prisma.review.findFirst({ where: { deletedAt: null, id } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.status !== ReviewStatus.PUBLISHED) {
      throw new BadRequestException('Only published reviews can receive an owner response');
    }

    await this.lodgeAccessService.assertCanManageLodge(user, review.lodgeId);
    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "review_owner_responses" ("review_id", "owner_user_id", "response", "updated_at")
        VALUES (${review.id}, ${user.id}, ${response}, CURRENT_TIMESTAMP)
        ON CONFLICT ("review_id")
        DO UPDATE SET "owner_user_id" = EXCLUDED."owner_user_id", "response" = EXCLUDED."response", "updated_at" = CURRENT_TIMESTAMP
      `,
    );

    await this.auditLogService.create({
      action: 'REVIEW_OWNER_RESPONDED',
      actorUserId: user.id,
      entityId: review.id,
      entityType: 'review',
      metadata: { lodgeId: review.lodgeId, responseLength: response.length },
    });

    return this.toReview(review, { response, updatedAt: new Date() });
  }

  private async getOwnerResponse(reviewId: string): Promise<{ response: string; updatedAt: Date } | null> {
    const rows = await this.getOwnerResponses([reviewId]);
    return rows.get(reviewId) ?? null;
  }

  private async getOwnerResponses(reviewIds: string[]): Promise<Map<string, { response: string; updatedAt: Date }>> {
    if (reviewIds.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<OwnerResponseRow[]>(
      Prisma.sql`
        SELECT "review_id", "response", "updated_at"
        FROM "review_owner_responses"
        WHERE "review_id" IN (${Prisma.join(reviewIds)})
      `,
    );
    return new Map(rows.map((row) => [row.review_id, { response: row.response, updatedAt: row.updated_at }]));
  }

  private toReview(
    review: {
      cleanlinessRating: number | null;
      comment: string | null;
      createdAt: Date;
      id: string;
      isVerifiedStay: boolean;
      locationRating: number | null;
      lodgeId: string;
      pilgrimUserId: string;
      rating: number;
      roomTypeId: string | null;
      serviceRating: number | null;
      status: ReviewStatus;
      title: string | null;
      valueRating: number | null;
    },
    ownerResponse: { response: string; updatedAt: Date } | null,
  ): Review {
    return {
      cleanlinessRating: review.cleanlinessRating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
      id: review.id,
      isVerifiedStay: review.isVerifiedStay,
      locationRating: review.locationRating,
      lodgeId: review.lodgeId,
      ownerResponse: ownerResponse?.response ?? null,
      ownerResponseAt: ownerResponse?.updatedAt.toISOString() ?? null,
      pilgrimUserId: review.pilgrimUserId,
      rating: review.rating,
      roomTypeId: review.roomTypeId,
      serviceRating: review.serviceRating,
      status: review.status,
      title: review.title,
      valueRating: review.valueRating,
    };
  }

  private toReviewReport(report: {
    createdAt: Date;
    description: string | null;
    id: string;
    reason: ReviewReport['reason'];
    reviewId: string;
    status: ReviewReport['status'];
  }): ReviewReport {
    return {
      createdAt: report.createdAt.toISOString(),
      description: report.description,
      id: report.id,
      reason: report.reason,
      reviewId: report.reviewId,
      status: report.status,
    };
  }
}
