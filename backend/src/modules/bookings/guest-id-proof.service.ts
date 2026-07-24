import { randomUUID } from 'node:crypto';

import type { MultipartFile } from '@fastify/multipart';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser, BookingGuestIdProofUpload } from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { SupabaseStorageService } from '../storage/providers/supabase-storage.service';

const MAX_ID_PROOF_SIZE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class GuestIdProofService {
  public constructor(
    private readonly auditLogService: AuditLogService,
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
    const storagePath = `guest-id-proofs/${user.id}/${randomUUID()}.${detectedFile.extension}`;
    await this.storageService.uploadPrivateObject(storagePath, contents, detectedFile.mimeType);
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
