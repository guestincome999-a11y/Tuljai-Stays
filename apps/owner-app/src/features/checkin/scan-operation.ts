import type { Booking, CheckInResponse } from '@tuljai/types';

export type RecognitionStatus = 'SCANNED' | 'QR_INVALID' | 'QR_ALREADY_SCANNED_LOCALLY';
export type CheckinStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'CHECKED_IN'
  | 'ALREADY_CHECKED_IN'
  | 'BOOKING_NOT_FOUND'
  | 'BOOKING_CANCELLED'
  | 'CHECK_IN_NOT_ALLOWED'
  | 'NETWORK_ERROR'
  | 'RETRY_PENDING';
export interface RecognizedQr {
  bookingId: string;
  bookingCode: string;
  qrTokenId: string;
  qrPayload: string;
  key: string;
}
export interface ScanOperation extends RecognizedQr {
  status: CheckinStatus;
  durable: boolean;
  response?: CheckInResponse;
  message?: string;
}

// Recognition only. A syntactically correct signature is NOT a verified signature.
// No signing key is shipped to the app; the existing endpoint remains authoritative.
export function recognizeQr(qrPayload: string): RecognizedQr | null {
  if (qrPayload.length > 1800) return null;
  const opaque =
    /^tjsqr\.v2\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{40,1600})\.([A-Za-z0-9_-]{22})$/u.exec(
      qrPayload,
    );
  if (opaque)
    return {
      bookingId: '',
      bookingCode: 'Booking pass',
      qrTokenId: '',
      qrPayload,
      key: `checkin.${opaque[1]}.${opaque[3]}`,
    };
  const parts = /^tjsqr\.v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/u.exec(qrPayload);
  if (!parts) return null;
  try {
    const body: unknown = JSON.parse(atob(parts[1].replace(/-/gu, '+').replace(/_/gu, '/')));
    if (!body || typeof body !== 'object') return null;
    const value = body as Record<string, unknown>;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
    if (
      value.version !== 1 ||
      typeof value.bookingId !== 'string' ||
      !uuid.test(value.bookingId) ||
      typeof value.qrTokenId !== 'string' ||
      !uuid.test(value.qrTokenId) ||
      typeof value.bookingCode !== 'string' ||
      !value.bookingCode ||
      value.bookingCode.length > 100 ||
      typeof value.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(value.expiresAt)) ||
      !Number.isInteger(value.tokenVersion) ||
      Number(value.tokenVersion) < 1
    )
      return null;
    return {
      bookingId: value.bookingId,
      bookingCode: value.bookingCode,
      qrTokenId: value.qrTokenId,
      qrPayload,
      key: `checkin.${value.qrTokenId}`,
    };
  } catch {
    return null;
  }
}

export class ScanGate {
  private locked = false;
  capture(payload: string): { status: RecognitionStatus; qr: RecognizedQr | null } | null {
    if (this.locked) return null;
    this.locked = true;
    const qr = recognizeQr(payload);
    return { status: qr ? 'SCANNED' : 'QR_INVALID', qr };
  }
  reset() {
    this.locked = false;
  }
}

export function isPending(status: CheckinStatus): boolean {
  return ['QUEUED', 'PROCESSING', 'NETWORK_ERROR', 'RETRY_PENDING'].includes(status);
}

interface QueueDependencies {
  load(): Promise<RecognizedQr[]>;
  save(items: RecognizedQr[]): Promise<void>;
  send(qr: RecognizedQr): Promise<CheckInResponse>;
  confirmed(response: CheckInResponse): void;
}

// Lives above navigation, using the app's existing React context/event architecture.
// All disk mutations and HTTP attempts are serialized; disk commit precedes HTTP.
export class CheckinQueue {
  private operations = new Map<string, ScanOperation>();
  private listeners = new Set<() => void>();
  private writes: Promise<void> = Promise.resolve();
  private running = false;
  private online = false;
  private active = true;
  private restored = false;
  constructor(private readonly dependencies: QueueDependencies) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  get(key: string) {
    return this.operations.get(key);
  }
  updateConfirmedBooking(booking: Booking) {
    for (const operation of this.operations.values()) {
      if (operation.response?.booking.id === booking.id)
        operation.response = { ...operation.response, booking };
    }
    this.emit();
  }
  list() {
    return [...this.operations.values()];
  }
  private emit() {
    this.listeners.forEach((listener) => listener());
  }
  async restore() {
    const items = await this.dependencies.load();
    for (const item of items)
      this.operations.set(item.key, { ...item, status: 'RETRY_PENDING', durable: true });
    this.restored = true;
    this.emit();
    void this.flush();
  }
  setOnline(online: boolean) {
    this.online = online;
    if (online) void this.flush();
  }
  stop() {
    this.active = false;
  }
  async enqueue(qr: RecognizedQr) {
    if (!this.active || !this.restored) throw new Error('Check-in queue is not ready.');
    if (this.operations.has(qr.key)) return;
    if (this.list().filter((item) => isPending(item.status)).length >= 40)
      throw new Error('Pending queue is full. Connect to synchronize before scanning more.');
    this.operations.set(qr.key, { ...qr, status: 'QUEUED', durable: false });
    this.emit();
    try {
      await this.persist();
      const item = this.operations.get(qr.key);
      if (item) item.durable = true;
      this.emit();
    } catch {
      this.operations.delete(qr.key);
      this.emit();
      throw new Error('Could not save this scan. Please retry before leaving this screen.');
    }
    void this.flush();
  }
  private persist() {
    const items = this.list()
      .filter((item) => isPending(item.status))
      .map(({ bookingId, bookingCode, qrTokenId, qrPayload, key }) => ({
        bookingId,
        bookingCode,
        qrTokenId,
        qrPayload,
        key,
      }));
    const write = this.writes.then(() => this.dependencies.save(items));
    this.writes = write.catch(() => undefined);
    return write;
  }
  async flush() {
    if (this.running || !this.active || !this.online || !this.restored) return;
    this.running = true;
    try {
      await this.writes;
      for (const item of this.operations.values()) {
        if (!this.active || !this.online) break;
        if (!isPending(item.status)) continue;
        // Also retries any failed disk cleanup from a previous attempt.
        try {
          await this.persist();
        } catch {
          break;
        }
        if (!this.active || !this.online) break;
        item.status = 'PROCESSING';
        this.emit();
        try {
          const response = await this.dependencies.send(item);
          item.response = response;
          item.status = response.scanResult === 'USED' ? 'ALREADY_CHECKED_IN' : 'CHECKED_IN';
          if (this.active) this.dependencies.confirmed(response);
        } catch (error) {
          const details = error as { details?: { statusCode?: number }; message?: string };
          const code = details.details?.statusCode;
          const message = details.message ?? '';
          item.status =
            !code || code >= 500 || code === 429 || code === 408 || code === 409 || code === 401
              ? 'RETRY_PENDING'
              : code === 404
                ? 'BOOKING_NOT_FOUND'
                : /cancelled/iu.test(message)
                  ? 'BOOKING_CANCELLED'
                  : 'CHECK_IN_NOT_ALLOWED';
          item.message = isPending(item.status)
            ? 'Waiting for connection or server. Retrying automatically.'
            : message;
        }
        this.emit();
        try {
          await this.persist();
        } catch {
          /* Replaying a retained disk entry is idempotent. */
        }
      }
    } finally {
      this.running = false;
    }
  }
}
