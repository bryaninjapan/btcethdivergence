import { describe, it, expect } from 'vitest';
import {
  AppError,
  AuthenticationError,
  DatabaseError,
  ErrorCode,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
  isAppError,
} from './errors';

describe('Error Type Hierarchy', () => {
  describe('AppError', () => {
    it('creates error with code and message', () => {
      const error = new AppError(
        ErrorCode.INTERNAL_ERROR,
        'Something went wrong',
      );
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('AppError');
    });

    it('includes details when provided', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid input', details);
      expect(error.details).toEqual(details);
    });

    it('returns correct HTTP status code', () => {
      const validationError = new ValidationError('id', 'must be positive');
      const dbError = new DatabaseError('connection failed');
      const serviceError = new ExternalServiceError('Binance', 'timeout');
      const authError = new AuthenticationError('invalid token');
      const notFoundError = new NotFoundError('User');

      expect(validationError.statusCode()).toBe(400);
      expect(dbError.statusCode()).toBe(500);
      expect(serviceError.statusCode()).toBe(502);
      expect(authError.statusCode()).toBe(401);
      expect(notFoundError.statusCode()).toBe(404);
    });

    it('toResponse() returns client-safe error details', () => {
      const error = new AppError(
        ErrorCode.DATABASE_ERROR,
        'Database connection failed',
        { connectionString: 'secret-url' }, // Should NOT be in response
      );
      const response = error.toResponse();
      expect(response).toEqual({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Database connection failed',
      });
      expect(response.details).toBeUndefined();
    });
  });

  describe('ValidationError', () => {
    it('formats message with field name', () => {
      const error = new ValidationError('email', 'must be a valid email');
      expect(error.message).toContain('email');
      expect(error.message).toContain('must be a valid email');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('includes details when provided', () => {
      const details = { pattern: '^[a-z]+$' };
      const error = new ValidationError('username', 'invalid format', details);
      expect(error.details).toEqual(details);
    });

    it('returns 400 status code', () => {
      const error = new ValidationError('id', 'must be positive');
      expect(error.statusCode()).toBe(400);
    });
  });

  describe('DatabaseError', () => {
    it('includes database context in message', () => {
      const error = new DatabaseError('UNIQUE constraint failed on email');
      expect(error.message).toContain('Database error');
      expect(error.message).toContain('UNIQUE constraint');
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
    });

    it('includes details for debugging', () => {
      const details = { table: 'users', constraint: 'email_unique' };
      const error = new DatabaseError('constraint violation', details);
      expect(error.details).toEqual(details);
    });

    it('returns 500 status code', () => {
      const error = new DatabaseError('connection failed');
      expect(error.statusCode()).toBe(500);
    });
  });

  describe('ExternalServiceError', () => {
    it('includes service name in message', () => {
      const error = new ExternalServiceError('Binance API', 'rate limit exceeded');
      expect(error.message).toContain('Binance API');
      expect(error.message).toContain('rate limit exceeded');
      expect(error.code).toBe(ErrorCode.SERVICE_ERROR);
    });

    it('includes retry information in details', () => {
      const details = { status: 429, retryAfter: 60 };
      const error = new ExternalServiceError('Binance API', 'rate limited', details);
      expect(error.details).toEqual(details);
    });

    it('returns 502 status code', () => {
      const error = new ExternalServiceError('API', 'timeout');
      expect(error.statusCode()).toBe(502);
    });
  });

  describe('AuthenticationError', () => {
    it('indicates authentication failure', () => {
      const error = new AuthenticationError('invalid token');
      expect(error.message).toContain('Authentication failed');
      expect(error.message).toContain('invalid token');
      expect(error.code).toBe(ErrorCode.AUTH_ERROR);
    });

    it('returns 401 status code', () => {
      const error = new AuthenticationError('missing credentials');
      expect(error.statusCode()).toBe(401);
    });
  });

  describe('isAppError type guard', () => {
    it('returns true for AppError and subclasses', () => {
      expect(isAppError(new AppError(ErrorCode.INTERNAL_ERROR, 'error'))).toBe(true);
      expect(isAppError(new ValidationError('field', 'invalid'))).toBe(true);
      expect(isAppError(new DatabaseError('failed'))).toBe(true);
      expect(isAppError(new ExternalServiceError('API', 'timeout'))).toBe(true);
      expect(isAppError(new AuthenticationError('failed'))).toBe(true);
    });

    it('returns false for non-AppError values', () => {
      expect(isAppError(new Error('regular error'))).toBe(false);
      expect(isAppError('string')).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError({})).toBe(false);
    });
  });

  describe('ErrorCode enum uniqueness', () => {
    it('has unique error codes', () => {
      const codes = Object.values(ErrorCode);
      const unique = new Set(codes);
      expect(unique.size).toBe(codes.length);
    });

    it('covers all required error types', () => {
      expect(ErrorCode.VALIDATION_ERROR).toBeDefined();
      expect(ErrorCode.DATABASE_ERROR).toBeDefined();
      expect(ErrorCode.SERVICE_ERROR).toBeDefined();
      expect(ErrorCode.AUTH_ERROR).toBeDefined();
      expect(ErrorCode.INTERNAL_ERROR).toBeDefined();
    });
  });
});
