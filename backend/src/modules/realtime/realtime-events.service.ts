import { Injectable } from '@nestjs/common';

import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeEventsService {
  public constructor(private readonly realtimeGateway: RealtimeGateway) {}

  public publishToUser(userId: string, event: string, payload: Record<string, unknown>): void {
    this.realtimeGateway.emitToRoom(`user:${userId}`, event, payload);
  }

  public publishToRole(role: string, event: string, payload: Record<string, unknown>): void {
    this.realtimeGateway.emitToRoom(`role:${role}`, event, payload);
  }

  public publishToLodge(lodgeId: string, event: string, payload: Record<string, unknown>): void {
    this.realtimeGateway.emitToRoom(`lodge:${lodgeId}`, event, payload);
  }

  public publishToBooking(
    bookingId: string,
    event: string,
    payload: Record<string, unknown>,
  ): void {
    this.realtimeGateway.emitToRoom(`booking:${bookingId}`, event, payload);
  }

  public publishToCity(cityId: string, event: string, payload: Record<string, unknown>): void {
    this.realtimeGateway.emitToRoom(`city:${cityId}`, event, payload);
  }
}
