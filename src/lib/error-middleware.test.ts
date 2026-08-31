import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { ZodError, z } from 'zod';
import { errorMiddleware, type ApiResponse } from './error-middleware';
import {
  AppError,
  AuthenticationError,
  DatabaseError,
  ErrorCode,
  ExternalServiceError,
  ValidationError,
} from './errors';
import type { Env } from '../types';

// Mock Env
const mockEnv: Env = {
  DB: {} as D1Database,
  INGEST_TOKEN: 'test-token',
};

describe('Error Middleware', () => {
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    app.onError((err, c) => errorMiddleware(err, c));
  });

  describe('ValidationError handling', () => {
    it('catches ValidationError and returns 400', async () => {
      app.get('/test', () => {
        throw new ValidationError('id', 'must be a positive integer');
      });

      const res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(400);

      const body = (await res.json()) as ApiResponse<never>;
      expect(body.ok).toBe(false);
      expect(body.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(body.error?.message).toContain('id');
    });

    it('sanitizes details from client response', async () => {
      app.get('/test', () => {
        throw new ValidationError('email', 'already exists', {
          userId: 123,
          timestamp: '2026-09-01',
        });
      });

      const res = await app.request(new Request('http://localhost/test'));
      const body = (await res.json()) as ApiResponse<never>;
      expect(body.error?.details).toBeUndefined();
    });
  });

  describe('DatabaseError handling', () => {
    it('catches DatabaseError and returns 500', async () => {
      app.get('/test', () => {
        throw new DatabaseError('Connection timeout');
      });

      const res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(500);

      const body = (await res.json()) as ApiResponse<never>;
      expect(body.ok).toBe(false);
      expect(body.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });

  describe('ExternalServiceError handling', () => {
    it('catches ExternalServiceError and returns 502', async () => {
      app.get('/test', () => {
        throw new ExternalServiceError('Binance API', 'Rate limit exceeded');
      });

      const res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(502);

      const body = (await res.json()) as ApiResponse<never>;
      expect(body.ok).toBe(false);
      expect(body.error?.code).toBe(ErrorCode.SERVICE_ERROR);
    });
  });

  describe('AuthenticationError handling', () => {
    it('catches AuthenticationError and returns 401', async () => {
      app.get('/test', () => {
        throw new AuthenticationError('Invalid token');
      });

      const res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(401);

      const body = (await res.json()) as ApiResponse<never>;
      expect(body.ok).toBe(false);
      expect(body.error?.code).toBe(ErrorCode.AUTH_ERROR);
    });
  });

  describe('ZodError handling', () => {
    it('converts ZodError to ValidationError', async () => {
      app.get('/test', () => {
        const schema = z.object({
          id: z.number().int().positive(),
          email: z.string().email(),
        });
        const invalid = { id: 'not-a-number', email: 'invalid' };
        schema.parse(invalid); // Will throw ZodError
      });

      const res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(400);

      const body = (await res.json()) as ApiResponse<never>;
      expect(body.ok).toBe(false);
      expect(body.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(body.error?.message).toContain('Validation');
    });
  });

  describe('Unknown error handling', () => {
    it('converts unknown Error to INTERNAL_ERROR', async () => {
      app.get('/test', () => {
        throw new Error('Unexpected error');
      });

      const res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(500);

      const body = (await res.json()) as ApiResponse<never>;
      expect(body.ok).toBe(false);
      expect(body.error?.code).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it('handles custom Error subclasses', async () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      app.get('/test', () => {
        throw new CustomError('Something custom went wrong');
      });

      const res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(500);

      const body = (await res.json()) as ApiResponse<never>;
      expect(body.ok).toBe(false);
      expect(body.error?.code).toBe(ErrorCode.INTERNAL_ERROR);
    });
  });

  describe('Response envelope format', () => {
    it('returns proper ApiResponse structure', async () => {
      app.get('/test', () => {
        throw new ValidationError('field', 'invalid');
      });

      const res = await app.request(new Request('http://localhost/test'));
      const body = (await res.json()) as ApiResponse<never>;

      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
      expect(body).not.toHaveProperty('data');
    });

    it('includes error code in machine-readable format', async () => {
      app.get('/test', () => {
        throw new ValidationError('id', 'must be positive');
      });

      const res = await app.request(new Request('http://localhost/test'));
      const body = (await res.json()) as ApiResponse<never>;

      expect(body.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(typeof body.error?.code).toBe('string');
    });

    it('includes user-friendly message', async () => {
      app.get('/test', () => {
        throw new ValidationError('email', 'must be a valid email address');
      });

      const res = await app.request(new Request('http://localhost/test'));
      const body = (await res.json()) as ApiResponse<never>;

      expect(body.error?.message).toBeTruthy();
      expect(body.error?.message).toContain('email');
    });
  });

  describe('HTTP status code mapping', () => {
    const testCases = [
      {
        name: 'ValidationError',
        error: () => new ValidationError('field', 'invalid'),
        expectedStatus: 400,
      },
      {
        name: 'DatabaseError',
        error: () => new DatabaseError('failed'),
        expectedStatus: 500,
      },
      {
        name: 'ExternalServiceError',
        error: () => new ExternalServiceError('API', 'timeout'),
        expectedStatus: 502,
      },
      {
        name: 'AuthenticationError',
        error: () => new AuthenticationError('invalid'),
        expectedStatus: 401,
      },
      {
        name: 'Unknown Error',
        error: () => new Error('unknown'),
        expectedStatus: 500,
      },
    ];

    for (const testCase of testCases) {
      it(`returns correct status code for ${testCase.name}`, async () => {
        app.get('/test', () => {
          throw testCase.error();
        });

        const res = await app.request(new Request('http://localhost/test'));
        expect(res.status).toBe(testCase.expectedStatus);
      });
    }
  });
});
