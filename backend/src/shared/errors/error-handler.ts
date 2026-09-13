import * as Sentry from '@sentry/node';
import type { FastifyError, FastifyInstance } from 'fastify';

import {
  getLocalizedApiErrorMessage,
  resolveApiLocale,
} from '../localization/api-error-localization.js';
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
    const locale = resolveApiLocale(request.headers['accept-language']);

    if (isApiError(error)) {
      request.log.warn(
        { err: error, code: error.code, requestId: request.id },
        'Handled API error',
      );

      return reply.status(error.statusCode).send({
        message: getLocalizedApiErrorMessage(
          locale,
          error.code,
          error.statusCode,
          error.message,
        ),
        code: error.code,
        details: error.statusCode >= 500 ? {} : error.details,
      });
    }

    if (error.validation) {
      request.log.warn(
        { err: error, code: 'validation_failed', requestId: request.id },
        'Request validation failed',
      );

      return reply.status(422).send({
        message: getLocalizedApiErrorMessage(
          locale,
          'validation_failed',
          422,
          'Please check the request and try again.',
        ),
        code: 'validation_failed',
        details: toSafeValidationDetails(error),
      });
    }

    if (error.statusCode === 429) {
      request.log.warn(
        { err: error, code: 'rate_limit_exceeded', requestId: request.id },
        'Rate limit exceeded',
      );

      return reply.status(429).send({
        message: getLocalizedApiErrorMessage(
          locale,
          'rate_limit_exceeded',
          429,
          'Too many requests. Please try again later.',
        ),
        code: 'rate_limit_exceeded',
        details: {},
      });
    }

    // Only unexpected errors reach here; expected ApiErrors, validation
    // 422s, and rate-limit 429s are handled above and never reported.
    // No bodies, headers, or user data are attached.
    Sentry.captureException(error, {
      tags: { requestId: request.id },
      extra: { method: request.method, url: request.url },
    });

    request.log.error(
      { err: error, code: internalServerError.code, requestId: request.id },
      'Unhandled API error',
    );

    return reply.status(internalServerError.statusCode).send({
      message: getLocalizedApiErrorMessage(
        locale,
        internalServerError.code,
        internalServerError.statusCode,
        internalServerError.message,
      ),
      code: internalServerError.code,
      details: internalServerError.details,
    });
  });
}
