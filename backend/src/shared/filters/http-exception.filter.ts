import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorResponse } from '@tuljai/types';
import type { FastifyReply, FastifyRequest } from 'fastify';

interface HttpExceptionBody {
  error?: string;
  message?: string | string[];
  statusCode?: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<FastifyReply>();
    const request = context.getRequest<FastifyRequest>();
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    const body = this.normalizeBody(exceptionResponse);

    const payload: ApiErrorResponse = {
      errorCode: body.error ?? this.toErrorCode(statusCode),
      message: body.message,
      requestId: request.id,
      statusCode,
    };

    void response.status(statusCode).send(payload);
  }

  private normalizeBody(exceptionResponse: string | object): { error?: string; message: string } {
    if (typeof exceptionResponse === 'string') {
      return { message: exceptionResponse };
    }

    const body = exceptionResponse as HttpExceptionBody;
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;

    return {
      error: body.error,
      message: message ?? 'Request failed',
    };
  }

  private toErrorCode(statusCode: number): string {
    if (statusCode >= 500) {
      return 'INTERNAL_SERVER_ERROR';
    }

    return 'REQUEST_FAILED';
  }
}
