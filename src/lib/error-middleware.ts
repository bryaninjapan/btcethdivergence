/**
 * Centralized error handling middleware for Hono.
 * Catches all errors (AppError and unknown) and returns structured responses.
 */

import { Context } from 'hono';
import { ZodError } from 'zod';
import {
  AppError,
  AuthenticationError,
  DatabaseError,
  ErrorCode,
  ExternalServiceError,
  ValidationError,
  isAppError,
} from './errors';
import { createLogger } from './logger';
import { validationMessage } from './validate';
import type { ApiResponse, Env } from '../types';

// Re-export ApiResponse for use in tests
export type { ApiResponse } from '../types';

/**
 * Structured logger for the HTTP boundary. Sinks to Workers Logs via stdout.
 */
const logger = createLogger('http');

/**
 * Centralized error handler middleware for Hono.
 * Logs full error context server-side, returns sanitized response to client.
 */
export async function errorMiddleware(
  err: Error,
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  // Convert unknown errors to AppError
  let appError: AppError;

  if (isAppError(err)) {
    appError = err;
  } else if (err instanceof ZodError) {
    // Convert Zod validation errors to ValidationError
    const firstError = err.issues[0];
    const fieldPath = firstError.path.join('.');
    appError = new ValidationError(
      fieldPath || 'unknown',
      validationMessage(err),
      {
        zodErrors: err.issues,
      },
    );
  } else {
    // Unknown error → INTERNAL_ERROR
    appError = new AppError(
      ErrorCode.INTERNAL_ERROR,
      'An unexpected error occurred',
      {
        originalMessage: err instanceof Error ? err.message : String(err),
      },
    );
  }

  // Log full error context server-side (with all details)
  logger.captureException('errorMiddleware', appError, {
    path: c.req.path,
    method: c.req.method,
    details: appError.details,
  });

  // Return sanitized response to client
  const statusCode = appError.statusCode() as 400 | 401 | 404 | 500 | 502;
  const response: ApiResponse<never> = {
    ok: false,
    error: appError.toResponse(),
  };

  return c.json(response, statusCode);
}
