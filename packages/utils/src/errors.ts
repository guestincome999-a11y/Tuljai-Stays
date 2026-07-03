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
