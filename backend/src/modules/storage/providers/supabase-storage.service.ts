import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly bucket: string;
  private readonly client: SupabaseClient | null;

  public constructor(configService: ConfigService) {
    const configuredUrl = configService.get<string>('api.supabase.url');
    const url = configuredUrl?.replace(/\/rest\/v1\/?$/u, '');
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

  public async uploadPrivateObject(
    storagePath: string,
    contents: Buffer,
    contentType: string,
  ): Promise<void> {
    const client = this.getRequiredClient();
    const { error } = await client.storage.from(this.bucket).upload(storagePath, contents, {
      cacheControl: '3600',
      contentType,
      upsert: false,
    });

    if (error) {
      this.logger.error(`Supabase upload failed: ${error.message}`);
      throw new InternalServerErrorException('Unable to store the uploaded file');
    }
  }

  public async privateObjectExists(storagePath: string): Promise<boolean> {
    const client = this.getRequiredClient();
    const separatorIndex = storagePath.lastIndexOf('/');
    const folder = separatorIndex >= 0 ? storagePath.slice(0, separatorIndex) : '';
    const fileName = separatorIndex >= 0 ? storagePath.slice(separatorIndex + 1) : storagePath;

    const { data, error } = await client.storage.from(this.bucket).list(folder, {
      limit: 100,
      search: fileName,
    });

    if (error) {
      this.logger.error(`Supabase lookup failed: ${error.message}`);
      throw new InternalServerErrorException('Unable to verify the uploaded file');
    }

    return data.some((object) => object.name === fileName);
  }

  public async downloadPrivateObject(storagePath: string): Promise<Buffer> {
    const client = this.getRequiredClient();
    const { data, error } = await client.storage.from(this.bucket).download(storagePath);

    if (error) {
      this.logger.error(`Supabase download failed: ${error.message}`);
      throw new InternalServerErrorException('Unable to download the uploaded file');
    }

    return Buffer.from(await data.arrayBuffer());
  }

  private getRequiredClient(): SupabaseClient {
    if (!this.client) {
      throw new ServiceUnavailableException('File storage is not configured');
    }

    return this.client;
  }
}
