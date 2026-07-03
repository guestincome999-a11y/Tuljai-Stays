import { Controller, Get } from '@nestjs/common';

import { FcmService } from '../notifications/providers/fcm.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { SupabaseStorageService } from '../storage/providers/supabase-storage.service';

interface HealthResponse {
  database: 'ok' | 'error';
  firebaseConfigured: boolean;
  realtime: 'ok';
  service: 'tuljai-stays-api';
  status: 'ok' | 'degraded';
  storageConfigured: boolean;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  public constructor(
    private readonly fcmService: FcmService,
    private readonly prisma: PrismaService,
    private readonly realtimeEventsService: RealtimeEventsService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  @Get()
  public async check(): Promise<HealthResponse> {
    let database: HealthResponse['database'] = 'ok';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'error';
    }

    const realtime = this.realtimeEventsService.getPresenceSummary();

    return {
      database,
      firebaseConfigured: Boolean(this.fcmService.getMessagingClient()),
      realtime: realtime.totalOnline >= 0 ? 'ok' : 'ok',
      service: 'tuljai-stays-api',
      status: database === 'ok' ? 'ok' : 'degraded',
      storageConfigured: Boolean(this.storageService.getClient()),
      timestamp: new Date().toISOString(),
    };
  }
}
