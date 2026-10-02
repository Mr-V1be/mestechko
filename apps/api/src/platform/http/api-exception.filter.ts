import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { apiErrors, type ApiErrorBody, type ApiErrorCode } from '@mestechko/contracts';
import { DomainError } from '@mestechko/domain';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApplicationError } from '../../shared/application/application-error.js';

const SERVER_ERROR_THRESHOLD = 500;

export interface ErrorLogger {
  error(context: object, message: string): void;
  debug(context: object, message: string): void;
}

const httpStatusCodes: Readonly<Record<number, ApiErrorCode>> = {
  400: 'validation_failed',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  429: 'rate_limited',
};

interface ErrorResponse {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

function describe(exception: unknown): ErrorResponse {
  if (exception instanceof ApplicationError) {
    return {
      status: apiErrors[exception.code],
      code: exception.code,
      message: exception.message,
      details: exception.details,
    };
  }
  if (exception instanceof DomainError) {
    return {
      status: apiErrors.validation_failed,
      code: 'validation_failed',
      message: exception.message,
      details: { reason: exception.code },
    };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code =
      httpStatusCodes[status] ??
      (status < SERVER_ERROR_THRESHOLD ? 'validation_failed' : 'internal');
    return { status, code, message: exception.message };
  }
  return { status: apiErrors.internal, code: 'internal', message: 'Internal error' };
}

/** Renders every failure as the contract's error envelope. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: ErrorLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const response = describe(exception);
    const requestId = request.id;

    if (response.status >= SERVER_ERROR_THRESHOLD) {
      this.logger.error({ err: exception, requestId }, 'Request failed');
    } else {
      this.logger.debug({ code: response.code, requestId }, 'Request rejected');
    }

    const body: ApiErrorBody = {
      error: {
        code: response.code,
        message: response.message,
        ...(response.details === undefined ? {} : { details: response.details }),
        requestId,
      },
    };
    void reply.status(response.status).send(body);
  }
}
