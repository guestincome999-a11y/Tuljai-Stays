import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: 'realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  public handleConnection(client: Socket): void {
    client.emit('connection:ready', { connected: true });
  }

  public handleDisconnect(): void {
    return undefined;
  }

  public emitSystemAnnouncement(message: string): void {
    this.server.emit('admin:announcement', { message, createdAt: new Date().toISOString() });
  }
}
