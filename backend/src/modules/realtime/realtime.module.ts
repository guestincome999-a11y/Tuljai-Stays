import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { RealtimeEventsService } from './realtime-events.service';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [JwtModule.register({})],
  providers: [RealtimeGateway, RealtimeEventsService],
  exports: [RealtimeGateway, RealtimeEventsService],
})
export class RealtimeModule {}
