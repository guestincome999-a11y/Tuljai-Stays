import { randomUUID } from 'node:crypto';

import type { MultipartFile } from '@fastify/multipart';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser, BookingGuestIdProofUpload, BookingStatus } from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { LodgeAccessService } from '../lodges/lodge-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/providers/supabase-storage.service';

const MAX_ID_PROOF_SIZE_BYTES = 5 * 1024 * 1024;
const OWNER_VISIBLE_PROOF_STATUSES: BookingStatus[] = ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'];

interface GuestIdProofDownload {
  contents: Buffer;
  mimeType: string;
  originalName: string;
}

@Injectable()
export class GuestIdProofService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly lodgeAccessService: LodgeAccessService,
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  public async upload(
    file: MultipartFile,
    user: AuthenticatedUser,
  ): Promise<BookingGuestIdProofUpload> {
    const contents = await file.toBuffer();
    if (contents.length === 0) {
      throw new BadRequestException('The selected ID proof is empty');
    }
    if (contents.length > MAX_ID_PROOF_SIZE_BYTES) {
      throw new BadRequestException('ID proof must be 5 MB or smaller');
    }

    const detectedFile = this.detectFileType(contents);
    if (!detectedFile) {
      throw new BadRequestException('Upload a JPEG, PNG or PDF government ID proof');
    }

    const originalName = this.sanitizeFileName(file.filename);
    const storagePath = this.buildStoragePath(user.id, detectedFile.extension);
    if (this.storageService.getClient()) {
      await this.storageService.uploadPrivateObject(storagePath, contents, detectedFile.mimeType);
    }

    // Keep a durable private copy so a booking remains downloadable if its
    // storage object is moved, removed, or temporarily unavailable later.
    await this.prisma.guestIdProofUpload.create({
      data: {
        contents: Uint8Array.from(contents),
        mimeType: detectedFile.mimeType,
        originalName,
        sizeBytes: contents.length,
        storagePath,
        userId: user.id,
      },
    });

    await this.auditLogService.create({
      action: 'GUEST_ID_PROOF_UPLOADED',
      actorUserId: user.id,
      entityType: 'guest_id_proof',
      metadata: {
        mimeType: detectedFile.mimeType,
        sizeBytes: contents.length,
        storagePath,
      },
    });

    return {
      mimeType: detectedFile.mimeType,
      originalName,
      sizeBytes: contents.length,
      storagePath,
    };
  }

  public async assertOwnedUpload(
    userId: string,
    storagePath: string,
    mimeType: string,
  ): Promise<void> {
    if (await this.isDatabaseUploadOwnedByUser(userId, storagePath, mimeType)) {
      return;
    }

    const expectedPrefix = `guest-id-proofs/${userId}/`;
    if (!storagePath.startsWith(expectedPrefix) || storagePath.includes('..')) {
      throw new BadRequestException('The uploaded ID proof is invalid');
    }
    const expectedExtension: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
    };
    if (!expectedExtension[mimeType] || !storagePath.endsWith(expectedExtension[mimeType])) {
      throw new BadRequestException('The uploaded ID proof type is invalid');
    }
    if (!(await this.storageService.privateObjectExists(storagePath))) {
      throw new BadRequestException('Upload the guest ID proof again');
    }
  }

  public async downloadBookingProofForAdmin(bookingId: string): Promise<GuestIdProofDownload> {
    return this.downloadBookingProof(bookingId);
  }

  public async downloadBookingProofForOwner(
    bookingId: string,
    user: AuthenticatedUser,
  ): Promise<GuestIdProofDownload> {
    const booking = await this.prisma.booking.findFirst({
      select: {
        lodgeId: true,
        status: true,
      },
      where: {
        deletedAt: null,
        id: bookingId,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    await this.lodgeAccessService.assertCanManageLodge(user, booking.lodgeId);
    if (!OWNER_VISIBLE_PROOF_STATUSES.includes(booking.status)) {
      throw new BadRequestException('Guest ID proof is available after check-in');
    }

    return this.downloadBookingProof(bookingId);
  }

  private async downloadBookingProof(bookingId: string): Promise<GuestIdProofDownload> {
    const guest = await this.prisma.bookingGuest.findFirst({
      where: {
        bookingId,
        deletedAt: null,
        idProofMimeType: { not: null },
        idProofOriginalName: { not: null },
        idProofStoragePath: { not: null },
        isPrimaryGuest: true,
      },
    });

    if (!guest?.idProofStoragePath || !guest.idProofMimeType || !guest.idProofOriginalName) {
      throw new NotFoundException('ID proof is not available for this booking');
    }

    const databaseUpload = await this.prisma.guestIdProofUpload.findUnique({
      where: { storagePath: guest.idProofStoragePath },
    });

    return {
      contents: databaseUpload
        ? Buffer.from(databaseUpload.contents)
        : await this.storageService.downloadPrivateObject(guest.idProofStoragePath),
      mimeType: guest.idProofMimeType,
      originalName: guest.idProofOriginalName,
    };
  }

  private buildStoragePath(userId: string, extension: 'jpg' | 'pdf' | 'png'): string {
    return `guest-id-proofs/${userId}/${randomUUID()}.${extension}`;
  }

  private async isDatabaseUploadOwnedByUser(
    userId: string,
    storagePath: string,
    mimeType: string,
  ): Promise<boolean> {
    const upload = await this.prisma.guestIdProofUpload.findFirst({
      where: {
        deletedAt: null,
        mimeType,
        storagePath,
        userId,
      },
    });

    return Boolean(upload);
  }

  private detectFileType(
    contents: Buffer,
  ):
    | { extension: 'jpg'; mimeType: 'image/jpeg' }
    | { extension: 'pdf'; mimeType: 'application/pdf' }
    | { extension: 'png'; mimeType: 'image/png' }
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
    if (contents.length >= 5 && contents.subarray(0, 5).toString('ascii') === '%PDF-') {
      return { extension: 'pdf', mimeType: 'application/pdf' };
    }

    return null;
  }

  private sanitizeFileName(value: string): string {
    const sanitized = Array.from(value, (character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return character === '\\' || character === '/' || codePoint <= 0x1f || codePoint === 0x7f
        ? '_'
        : character;
    })
      .join('')
      .trim();
    return (sanitized || 'guest-id-proof').slice(0, 255);
  }
}
