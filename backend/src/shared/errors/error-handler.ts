import type { FastifyError, FastifyInstance } from 'fastify';

import { ApiError, isApiError } from './api-error.js';

type ValidationIssue = {
  instancePath?: string;
  schemaPath?: string;
  keyword?: string;
  params?: unknown;
  message?: string;
};

type FastifyValidationError = FastifyError & {
  validation?: ValidationIssue[];
  validationContext?: string;
};

const internalServerError = new ApiError(
  500,
  'internal_server_error',
  'Something went wrong. Please try again.',
);

function toSafeValidationDetails(error: FastifyValidationError) {
  return {
    context: error.validationContext ?? 'request',
    issues:
      error.validation?.map((issue) => ({
        path: issue.instancePath ?? '',
        message: issue.message ?? 'Invalid value.',
      })) ?? [],
  };
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyValidationError, request, reply) => {
    if (isApiError(error)) {
      request.log.warn(
        { err: error, code: error.code, requestId: request.id },
        'Handled API error',
      );

      return reply.status(error.statusCode).send({
        message: error.message,
        code: error.code,
        details: error.details,
      });
    }

    if (error.validation) {
      request.log.warn(
        { err: error, code: 'validation_failed', requestId: request.id },
        'Request validation failed',
      );

      return reply.status(422).send({
        message: 'Please check the request and try again.',
        code: 'validation_failed',
        details: toSafeValidationDetails(error),
      });
    }

    request.log.error(
      { err: error, code: internalServerError.code, requestId: request.id },
      'Unhandled API error',
    );

    return reply.status(internalServerError.statusCode).send({
      message: internalServerError.message,
      code: internalServerError.code,
      details: internalServerError.details,
    });
  });
}
