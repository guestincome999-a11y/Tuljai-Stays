export interface ApplicationErrorDetails {
  metadata?: Record<string, unknown>;
  requestId?: string;
  statusCode?: number;
}

export class ApplicationError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly details: ApplicationErrorDetails = {},
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}

/** Show safe API validation messages and a support reference, never raw server errors. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!isApplicationError(error)) return fallback;
  const { statusCode, requestId } = error.details;
  const message = statusCode && statusCode >= 400 && statusCode < 500 ? error.message : fallback;
  return requestId ? `${message} (Reference: ${requestId})` : message;
}
