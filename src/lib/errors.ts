/**
 * Structured error types for centralized error handling.
 * All errors inherit from AppError base class for type-safe middleware processing.
 */

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Base class for all application errors.
 * Each subclass maps to a specific HTTP status code and error response format.
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Returns a client-safe representation of the error (no sensitive details leaked).
   */
  toResponse(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      // Details intentionally excluded from client response
    };
  }

  /**
   * Returns the HTTP status code for this error type.
   */
  statusCode(): number {
    return statusCodeMap[this.code];
  }
}

/**
 * Validation error: Invalid input, malformed request, schema violation.
 * HTTP Status: 400 Bad Request
 */
export class ValidationError extends AppError {
  constructor(field: string, message: string, details?: Record<string, unknown>) {
    super(
      ErrorCode.VALIDATION_ERROR,
      `Validation failed on field '${field}': ${message}`,
      details,
    );
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Database error: Query failure, constraint violation, connection error.
 * HTTP Status: 500 Internal Server Error
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.DATABASE_ERROR, `Database error: ${message}`, details);
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * External service error: Binance API timeout, rate limit, invalid response.
 * HTTP Status: 502 Bad Gateway
 */
export class ExternalServiceError extends AppError {
  constructor(
    serviceName: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(
      ErrorCode.SERVICE_ERROR,
      `Service error from ${serviceName}: ${message}`,
      details,
    );
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

/**
 * Authentication error: Invalid credentials, missing auth, token expired.
 * HTTP Status: 401 Unauthorized
 */
export class AuthenticationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.AUTH_ERROR, `Authentication failed: ${message}`, details);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Not found error: Resource does not exist.
 * HTTP Status: 404 Not Found
 * Note: Uses VALIDATION_ERROR code but returns 404 status code.
 */
export class NotFoundError extends AppError {
  constructor(resource: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, `${resource} not found`, details);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }

  override statusCode(): number {
    return 404; // Override to return 404 instead of 400
  }
}

/**
 * Maps ErrorCode to HTTP status codes.
 * Used by middleware to set response status.
 */
const statusCodeMap: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.SERVICE_ERROR]: 502,
  [ErrorCode.AUTH_ERROR]: 401,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.NOT_IMPLEMENTED]: 501,
};

/**
 * Type guard: Check if an unknown error is an AppError instance.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
