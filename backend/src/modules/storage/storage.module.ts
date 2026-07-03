import { Module } from '@nestjs/common';

import { SupabaseStorageService } from './providers/supabase-storage.service';

@Module({
  providers: [SupabaseStorageService],
  exports: [SupabaseStorageService],
})
export class StorageModule {}
