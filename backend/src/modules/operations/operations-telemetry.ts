import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { FestivalTelemetry } from '@tuljai/types';
import { finalize, tap, type Observable } from 'rxjs';

interface Bucket {
  minute: number;
  requests: number;
  errors: number;
  duration: number;
  bookingErrors: number;
  routes: Map<string, { requests: number; errors: number; duration: number }>;
}

/** Bounded process-local counters. No request bodies, query strings, IDs or exception text. */
@Injectable()
export class OperationsTelemetry implements NestInterceptor {
  private buckets: Bucket[] = [];
  private recentErrors: FestivalTelemetry['recentErrors'] = [];
  private activeBookingRequests = 0;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ method: string; routeOptions?: { url?: string } }>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const route = `${request.method} ${request.routeOptions?.url ?? 'unmatched'}`;
    const booking = request.method === 'POST' && /booking|prepaid|qr\/scan/.test(route);
    const started = performance.now();
    let errorStatus = 0;
    if (booking) this.activeBookingRequests++;
    return next.handle().pipe(
      tap({
        error: (error: unknown) => {
          const candidate = error as { getStatus?: () => number };
          errorStatus = candidate.getStatus?.() ?? 500;
        },
      }),
      finalize(() => {
        if (booking) this.activeBookingRequests--;
        this.record(
          route,
          performance.now() - started,
          errorStatus || response.statusCode,
          booking,
        );
      }),
    );
  }

  record(route: string, duration: number, status: number, booking: boolean): void {
    const minute = Math.floor(Date.now() / 60000);
    this.buckets = this.buckets.filter((bucket) => bucket.minute >= minute - 4);
    let bucket = this.buckets.find((entry) => entry.minute === minute);
    if (!bucket) {
      bucket = { minute, requests: 0, errors: 0, duration: 0, bookingErrors: 0, routes: new Map() };
      this.buckets.push(bucket);
    }
    const failed = status >= 400;
    bucket.requests++;
    bucket.duration += duration;
    if (failed) bucket.errors++;
    if (failed && booking) bucket.bookingErrors++;
    // Route templates are finite; cap defensively if an adapter does not expose one.
    const key = bucket.routes.has(route) || bucket.routes.size < 100 ? route : 'other';
    const endpoint = bucket.routes.get(key) ?? { requests: 0, errors: 0, duration: 0 };
    endpoint.requests++;
    endpoint.duration += duration;
    if (failed) endpoint.errors++;
    bucket.routes.set(key, endpoint);
    if (failed)
      this.recentErrors = [
        { route, status, at: new Date().toISOString() },
        ...this.recentErrors,
      ].slice(0, 20);
  }

  snapshot(): FestivalTelemetry {
    const cutoff = Math.floor(Date.now() / 60000) - 4;
    const buckets = this.buckets.filter((bucket) => bucket.minute >= cutoff);
    const endpoints = new Map<string, { requests: number; errors: number; duration: number }>();
    for (const bucket of buckets)
      for (const [route, values] of bucket.routes) {
        const aggregate = endpoints.get(route) ?? { requests: 0, errors: 0, duration: 0 };
        aggregate.requests += values.requests;
        aggregate.errors += values.errors;
        aggregate.duration += values.duration;
        endpoints.set(route, aggregate);
      }
    const requests = buckets.reduce((sum, b) => sum + b.requests, 0);
    return {
      scope:
        'Controller requests in this backend process; rolling five calendar minutes; 4xx/5xx after authorization',
      windowSeconds: 300,
      requests,
      errors: buckets.reduce((sum, b) => sum + b.errors, 0),
      averageLatencyMs: requests
        ? Math.round(buckets.reduce((sum, b) => sum + b.duration, 0) / requests)
        : null,
      activeBookingRequests: this.activeBookingRequests,
      failedBookingRequests: buckets.reduce((sum, b) => sum + b.bookingErrors, 0),
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      endpoints: [...endpoints]
        .map(([route, e]) => ({
          route,
          requests: e.requests,
          errors: e.errors,
          averageLatencyMs: Math.round(e.duration / e.requests),
        }))
        .sort((a, b) => b.averageLatencyMs - a.averageLatencyMs)
        .slice(0, 8),
      recentErrors: this.recentErrors.filter(
        (error) => Date.parse(error.at) >= Date.now() - 300000,
      ),
    };
  }
}
