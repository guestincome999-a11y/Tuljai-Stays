import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { AuthenticatedUser, JwtPayload, PresenceSummary } from '@tuljai/types';
import type { Server, Socket } from 'socket.io';

import { resolveSocketCorsOrigins } from '../../shared/security/cors.config';
import { PrismaService } from '../prisma/prisma.service';

interface RealtimeSocketData {
  user?: AuthenticatedUser;
}

interface RealtimeEvents {
  [event: string]: (payload: Record<string, unknown>) => void;
}

type AuthenticatedSocket = Socket<
  RealtimeEvents,
  RealtimeEvents,
  Record<string, never>,
  RealtimeSocketData
>;

@WebSocketGateway({
  cors: {
    origin: resolveSocketCorsOrigins(),
    credentials: true,
  },
  namespace: 'realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly presence = new Map<
    string,
    { connectedAt: Date; lastSeenAt: Date; user: AuthenticatedUser }
  >();

  @WebSocketServer()
  private server!: Server;

  public constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  public async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = this.extractToken(client);

    if (!token) {
      client.emit('system:error', { message: 'Realtime authentication required' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('api.jwt.accessSecret'),
      });
      const activeUser = await this.prisma.user.findFirst({
        select: { id: true, isActive: true, phoneNumber: true, roles: true },
        where: { deletedAt: null, id: payload.sub, isActive: true },
      });

      if (!activeUser) {
        client.emit('system:error', { message: 'Realtime user is no longer active' });
        client.disconnect(true);
        return;
      }

      const user: AuthenticatedUser = {
        id: activeUser.id,
        isActive: activeUser.isActive,
        phoneNumber: activeUser.phoneNumber,
        roles: activeUser.roles,
      };
      client.data.user = user;
      this.presence.set(client.id, { connectedAt: new Date(), lastSeenAt: new Date(), user });
      await client.join(`user:${user.id}`);
      for (const role of user.roles) {
        await client.join(`role:${role}`);
      }
      const lodgeIds = await this.joinAuthorizedLodgeRooms(client, user);
      client.emit('connection:ready', {
        authenticated: true,
        connected: true,
        lodgeIds,
      });
    } catch (error) {
      this.logger.warn(
        `Rejected realtime connection ${client.id}: ${
          error instanceof Error ? error.message : 'unknown authentication error'
        }`,
      );
      client.emit('system:error', { message: 'Invalid realtime token' });
      client.disconnect(true);
    }
  }

  public handleDisconnect(client: AuthenticatedSocket): void {
    this.presence.delete(client.id);
  }

  public emitToRoom(room: string, event: string, payload: Record<string, unknown>): void {
    try {
      this.server.to(room).emit(event, payload);
    } catch (error) {
      this.logger.error(`Failed to publish realtime event ${event}`, error);
    }
  }

  public emitToRooms(rooms: string[], event: string, payload: Record<string, unknown>): void {
    for (const room of rooms) {
      this.emitToRoom(room, event, payload);
    }
  }

  public emitSystemAnnouncement(message: string): void {
    this.server.emit('announcement:new', { message, createdAt: new Date().toISOString() });
  }

  public getPresenceSummary(): PresenceSummary {
    let onlineAdmins = 0;
    let onlineOwners = 0;
    let onlinePilgrims = 0;

    for (const item of this.presence.values()) {
      if (item.user.roles.includes('ADMIN') || item.user.roles.includes('SUPER_ADMIN')) {
        onlineAdmins += 1;
      }

      if (item.user.roles.includes('OWNER')) {
        onlineOwners += 1;
      }

      if (item.user.roles.includes('PILGRIM')) {
        onlinePilgrims += 1;
      }
    }

    return { onlineAdmins, onlineOwners, onlinePilgrims, totalOnline: this.presence.size };
  }

  @SubscribeMessage('presence:update')
  public handlePresenceUpdate(client: AuthenticatedSocket, payload: Record<string, unknown>): void {
    if (!client.data.user) {
      client.emit('system:error', { message: 'Authentication required' });
      return;
    }

    this.presence.set(client.id, {
      connectedAt: this.presence.get(client.id)?.connectedAt ?? new Date(),
      lastSeenAt: new Date(),
      user: client.data.user,
    });
    client.emit('presence:update', { ...payload, userId: client.data.user.id });
  }

  @SubscribeMessage('owner:status-update')
  public handleOwnerStatusUpdate(
    client: AuthenticatedSocket,
    payload: Record<string, unknown>,
  ): void {
    if (!client.data.user?.roles.includes('OWNER')) {
      client.emit('system:error', { message: 'Owner access required' });
      return;
    }

    client.emit('owner:status-update', payload);
  }

  @SubscribeMessage('lodge:join')
  public async handleLodgeJoin(
    client: AuthenticatedSocket,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const user = client.data.user;
    const lodgeId = payload.lodgeId;

    if (!user) {
      client.emit('system:error', { message: 'Authentication required' });
      return;
    }

    if (typeof lodgeId !== 'string' || !lodgeId) {
      client.emit('system:error', { message: 'A lodge ID is required' });
      return;
    }

    const authorized = await this.canAccessLodgeRoom(user, lodgeId);

    if (!authorized) {
      client.emit('system:error', { message: 'Lodge realtime access denied' });
      return;
    }

    await client.join(`lodge:${lodgeId}`);
    client.emit('lodge:joined', { lodgeId });
  }

  private async joinAuthorizedLodgeRooms(
    client: AuthenticatedSocket,
    user: AuthenticatedUser,
  ): Promise<string[]> {
    let lodgeIds: string[] = [];

    if (this.isAdmin(user)) {
      const lodges = await this.prisma.lodge.findMany({
        select: { id: true },
        where: { deletedAt: null },
      });
      lodgeIds = lodges.map((lodge) => lodge.id);
    } else if (user.roles.includes('OWNER')) {
      const assignments = await this.prisma.lodgeOwner.findMany({
        select: { lodgeId: true },
        where: {
          deletedAt: null,
          isActive: true,
          lodge: { deletedAt: null },
          userId: user.id,
        },
      });
      lodgeIds = assignments.map((assignment) => assignment.lodgeId);
    }

    for (const lodgeId of lodgeIds) {
      await client.join(`lodge:${lodgeId}`);
    }
    return lodgeIds;
  }

  private async canAccessLodgeRoom(user: AuthenticatedUser, lodgeId: string): Promise<boolean> {
    if (this.isAdmin(user)) {
      const lodge = await this.prisma.lodge.findFirst({
        select: { id: true },
        where: { deletedAt: null, id: lodgeId },
      });
      return Boolean(lodge);
    }

    if (!user.roles.includes('OWNER')) {
      return false;
    }

    const assignment = await this.prisma.lodgeOwner.findFirst({
      select: { id: true },
      where: {
        deletedAt: null,
        isActive: true,
        lodge: { deletedAt: null },
        lodgeId,
        userId: user.id,
      },
    });
    return Boolean(assignment);
  }

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');
  }

  private extractToken(client: AuthenticatedSocket): string | null {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    const authToken = auth?.token;

    if (typeof authToken === 'string') {
      return authToken.replace(/^Bearer\s+/i, '');
    }

    const header = client.handshake.headers.authorization;

    if (typeof header === 'string') {
      return header.replace(/^Bearer\s+/i, '');
    }

    return null;
  }
}
