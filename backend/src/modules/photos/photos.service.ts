import { randomUUID } from 'node:crypto';

import type { MultipartFile } from '@fastify/multipart';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser, LodgePhoto } from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { LodgeAccessService } from '../lodges/lodge-access.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/providers/supabase-storage.service';

import type { CreateLodgePhotoDto, RejectPhotoDto } from './dto/photo.dto';

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class PhotosService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly lodgeAccessService: LodgeAccessService,
    private readonly notificationEventsService: NotificationEventsService,
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  public async uploadLodgePhoto(
    file: MultipartFile,
    lodgeId: string,
    user: AuthenticatedUser,
  ): Promise<{ fileUrl: string }> {
    await this.lodgeAccessService.assertCanManageLodge(user, lodgeId);

    const contents = await file.toBuffer();
    if (contents.length === 0) {
      throw new BadRequestException('The selected photo is empty');
    }
    if (contents.length > MAX_PHOTO_SIZE_BYTES) {
      throw new BadRequestException('Photos must be 5 MB or smaller');
    }

    const detectedImage = this.detectImageType(contents);
    if (!detectedImage) {
      throw new BadRequestException('Upload a JPEG, PNG, or WebP photo');
    }

    const storagePath = `lodges/${lodgeId}/${randomUUID()}.${detectedImage.extension}`;
    const fileUrl = await this.storageService.uploadPublicObject(
      storagePath,
      contents,
      detectedImage.mimeType,
      this.storageService.getLodgePhotosBucketName(),
    );

    await this.auditLogService.create({
      action: 'LODGE_PHOTO_UPLOADED',
      actorUserId: user.id,
      entityType: 'lodge_photo',
      metadata: { lodgeId, mimeType: detectedImage.mimeType, sizeBytes: contents.length, storagePath },
    });

    return { fileUrl };
  }

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

  public async listOwnerPhotos(lodgeId: string, user: AuthenticatedUser): Promise<LodgePhoto[]> {
    await this.lodgeAccessService.assertCanManageLodge(user, lodgeId);
    const photos = await this.prisma.lodgePhoto.findMany({
      orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      where: {
        deletedAt: null,
        lodgeId,
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

  private detectImageType(
    contents: Buffer,
  ):
    | { extension: 'jpg'; mimeType: 'image/jpeg' }
    | { extension: 'png'; mimeType: 'image/png' }
    | { extension: 'webp'; mimeType: 'image/webp' }
    | null {
    if (
      contents.length >= 3 &&
      contents[0] === 0xff &&
      contents[1] === 0xd8 &&
      contents[2] === 0xff
    ) {
      return { extension: 'jpg', mimeType: 'image/jpeg' };
    }
    if (
      contents.length >= 8 &&
      contents.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return { extension: 'png', mimeType: 'image/png' };
    }
    if (
      contents.length >= 12 &&
      contents.subarray(0, 4).toString('ascii') === 'RIFF' &&
      contents.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { extension: 'webp', mimeType: 'image/webp' };
    }

    return null;
  }

  private toPhoto(photo: {
    approvalStatus: LodgePhoto['approvalStatus'];
    category: LodgePhoto['category'];
    fileUrl: string;
    id: string;
    isCover: boolean;
    lodgeId: string;
    rejectionReason?: string | null;
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
      rejectionReason: photo.rejectionReason ?? null,
      roomId: photo.roomId,
      roomTypeId: photo.roomTypeId,
      sortOrder: photo.sortOrder,
      thumbnailUrl: photo.thumbnailUrl,
    };
  }
}
