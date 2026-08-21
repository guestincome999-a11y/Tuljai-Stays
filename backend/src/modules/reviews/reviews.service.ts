import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';
import type { AuthenticatedUser, PaginatedResponse, Review, ReviewReport } from '@tuljai/types';
import { normalizePagination } from '@tuljai/utils';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  CreateReviewDto,
  ListReviewsQueryDto,
  ModerateReviewDto,
  ReportReviewDto,
} from './dto/review.dto';

@Injectable()
export class ReviewsService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  public async create(dto: CreateReviewDto, user: AuthenticatedUser): Promise<Review> {
    const booking = await this.prisma.booking.findFirst({
      include: { lodge: { include: { owners: { where: { isActive: true, deletedAt: null } } } } },
      where: { deletedAt: null, id: dto.bookingId, pilgrimUserId: user.id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!['CHECKED_OUT', 'COMPLETED'].includes(booking.status)) {
      throw new BadRequestException('Only checked-out or completed stays can be reviewed');
    }

    const existingReview = await this.prisma.review.findUnique({ where: { bookingId: booking.id } });
    if (existingReview) {
      throw new BadRequestException('Feedback has already been submitted for this stay');
    }

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

    return this.toReview(review);
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

    return { items: items.map((review) => this.toReview(review)), page: pagination.page, pageSize: pagination.pageSize, totalItems, totalPages: Math.ceil(totalItems / pagination.pageSize) };
  }

  public async report(id: string, dto: ReportReviewDto, user: AuthenticatedUser): Promise<ReviewReport> {
    const review = await this.prisma.review.findFirst({ where: { deletedAt: null, id } });
    if (!review) throw new NotFoundException('Review not found');

    const report = await this.prisma.reviewReport.create({ data: { description: dto.description, reason: dto.reason, reportedByUserId: user.id, reviewId: id } });
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
    return { items: items.map((review) => this.toReview(review)), page: pagination.page, pageSize: pagination.pageSize, totalItems, totalPages: Math.ceil(totalItems / pagination.pageSize) };
  }

  public async moderate(id: string, dto: ModerateReviewDto, user: AuthenticatedUser): Promise<Review> {
    const review = await this.prisma.review.update({ data: { status: dto.status }, where: { id } });
    await this.auditLogService.create({ action: 'REVIEW_MODERATED', actorUserId: user.id, entityId: id, entityType: 'review', metadata: { status: dto.status } });
    return this.toReview(review);
  }

  private toReview(review: {
    cleanlinessRating: number | null; comment: string | null; createdAt: Date; id: string; isVerifiedStay: boolean;
    locationRating: number | null; lodgeId: string; pilgrimUserId: string; rating: number; roomTypeId: string | null;
    serviceRating: number | null; status: ReviewStatus; title: string | null; valueRating: number | null;
  }): Review {
    return { cleanlinessRating: review.cleanlinessRating, comment: review.comment, createdAt: review.createdAt.toISOString(), id: review.id, isVerifiedStay: review.isVerifiedStay, locationRating: review.locationRating, lodgeId: review.lodgeId, pilgrimUserId: review.pilgrimUserId, rating: review.rating, roomTypeId: review.roomTypeId, serviceRating: review.serviceRating, status: review.status, title: review.title, valueRating: review.valueRating };
  }

  private toReviewReport(report: { createdAt: Date; description: string | null; id: string; reason: ReviewReport['reason']; reviewId: string; status: ReviewReport['status'] }): ReviewReport {
    return { createdAt: report.createdAt.toISOString(), description: report.description, id: report.id, reason: report.reason, reviewId: report.reviewId, status: report.status };
  }
}
