import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser, LodgePhoto } from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { LodgeAccessService } from '../lodges/lodge-access.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';

import type { CreateLodgePhotoDto, RejectPhotoDto } from './dto/photo.dto';

@Injectable()
export class PhotosService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly lodgeAccessService: LodgeAccessService,
    private readonly notificationEventsService: NotificationEventsService,
    private readonly prisma: PrismaService,
  ) {}

  public async createLodgePhoto(
    lodgeId: string,
    dto: CreateLodgePhotoDto,
    user: AuthenticatedUser,
  ): Promise<LodgePhoto> {
    await this.lodgeAccessService.assertCanManageLodge(user, lodgeId);
    const photo = await this.prisma.lodgePhoto.create({
      data: {
        category: dto.category,
        fileUrl: dto.fileUrl,
        isCover: dto.isCover ?? false,
        lodgeId,
        roomId: dto.roomId,
        roomTypeId: dto.roomTypeId,
        sortOrder: dto.sortOrder ?? 0,
        thumbnailUrl: dto.thumbnailUrl,
        uploadedByUserId: user.id,
      },
    });
    await this.auditLogService.create({
      action: 'LODGE_PHOTO_METADATA_CREATED',
      actorUserId: user.id,
      entityId: photo.id,
      entityType: 'lodge_photo',
      metadata: { lodgeId },
    });
    return this.toPhoto(photo);
  }

  public async listPending(): Promise<LodgePhoto[]> {
    const photos = await this.prisma.lodgePhoto.findMany({
      orderBy: { createdAt: 'asc' },
      where: {
        approvalStatus: 'PENDING',
        deletedAt: null,
      },
    });

    return photos.map((photo) => this.toPhoto(photo));
  }

  public async approve(id: string, actorUserId: string): Promise<LodgePhoto> {
    const photo = await this.prisma.lodgePhoto.update({
      data: {
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedByUserId: actorUserId,
        rejectionReason: null,
      },
      where: { id },
    });
    await this.auditLogService.create({
      action: 'LODGE_PHOTO_APPROVED',
      actorUserId,
      entityId: id,
      entityType: 'lodge_photo',
    });
    await this.notificationEventsService.photoReviewed(photo.lodgeId, id, true);

    return this.toPhoto(photo);
  }

  public async reject(id: string, dto: RejectPhotoDto, actorUserId: string): Promise<LodgePhoto> {
    const photo = await this.prisma.lodgePhoto.update({
      data: {
        approvalStatus: 'REJECTED',
        approvedAt: null,
        approvedByUserId: actorUserId,
        rejectionReason: dto.rejectionReason,
      },
      where: { id },
    });
    await this.auditLogService.create({
      action: 'LODGE_PHOTO_REJECTED',
      actorUserId,
      entityId: id,
      entityType: 'lodge_photo',
      metadata: { rejectionReason: dto.rejectionReason },
    });
    await this.notificationEventsService.photoReviewed(photo.lodgeId, id, false);

    return this.toPhoto(photo);
  }

  public async listPublic(lodgeId: string): Promise<LodgePhoto[]> {
    await this.ensureVisibleLodge(lodgeId);
    const photos = await this.prisma.lodgePhoto.findMany({
      orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      where: {
        approvalStatus: 'APPROVED',
        deletedAt: null,
        lodgeId,
      },
    });

    return photos.map((photo) => this.toPhoto(photo));
  }

  private async ensureVisibleLodge(lodgeId: string): Promise<void> {
    const lodge = await this.prisma.lodge.findFirst({
      where: {
        deletedAt: null,
        id: lodgeId,
        isActive: true,
        status: 'VERIFIED',
        verificationStatus: 'VERIFIED',
      },
    });

    if (!lodge) {
      throw new NotFoundException('Lodge not found');
    }
  }

  private toPhoto(photo: {
    approvalStatus: LodgePhoto['approvalStatus'];
    category: LodgePhoto['category'];
    fileUrl: string;
    id: string;
    isCover: boolean;
    lodgeId: string;
    roomId: string | null;
    roomTypeId: string | null;
    sortOrder: number;
    thumbnailUrl: string | null;
  }): LodgePhoto {
    return {
      approvalStatus: photo.approvalStatus,
      category: photo.category,
      fileUrl: photo.fileUrl,
      id: photo.id,
      isCover: photo.isCover,
      lodgeId: photo.lodgeId,
      roomId: photo.roomId,
      roomTypeId: photo.roomTypeId,
      sortOrder: photo.sortOrder,
      thumbnailUrl: photo.thumbnailUrl,
    };
  }
}
