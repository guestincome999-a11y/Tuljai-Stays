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
import type { AuthenticatedUser, JwtPayload } from '@tuljai/types';
import type { Server, Socket } from 'socket.io';

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
    origin: true,
    credentials: true,
  },
  namespace: 'realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  public constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  public handleConnection(client: AuthenticatedSocket): void {
    const token = this.extractToken(client);

    if (!token) {
      client.emit('connection:ready', { authenticated: false, connected: true });
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('api.jwt.accessSecret'),
      });
      const user: AuthenticatedUser = {
        id: payload.sub,
        isActive: true,
        phoneNumber: payload.phoneNumber,
        roles: payload.roles,
      };
      client.data.user = user;
      void client.join(`user:${user.id}`);
      for (const role of user.roles) {
        void client.join(`role:${role}`);
      }
      client.emit('connection:ready', { authenticated: true, connected: true });
    } catch {
      client.emit('system:error', { message: 'Invalid realtime token' });
      client.disconnect(true);
    }
  }

  public handleDisconnect(): void {
    return undefined;
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

  @SubscribeMessage('presence:update')
  public handlePresenceUpdate(client: AuthenticatedSocket, payload: Record<string, unknown>): void {
    if (!client.data.user) {
      client.emit('system:error', { message: 'Authentication required' });
      return;
    }

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
