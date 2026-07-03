import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly bucket: string;
  private readonly client: SupabaseClient | null;

  public constructor(configService: ConfigService) {
    const url = configService.get<string>('api.supabase.url');
    const serviceRoleKey = configService.get<string>('api.supabase.serviceRoleKey');
    this.bucket = configService.getOrThrow<string>('api.supabase.storageBucket');

    if (!url || !serviceRoleKey) {
      this.client = null;
      this.logger.warn('Supabase Storage is not configured. File operations are disabled.');
      return;
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  public getBucketName(): string {
    return this.bucket;
  }
}
