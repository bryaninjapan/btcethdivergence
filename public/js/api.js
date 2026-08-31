/**
 * Structured error thrown by api() function.
 * Includes error code to allow frontend to differentiate error types.
 */
export class ApiError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }
}

/**
 * Fetch wrapper that handles structured API responses.
 * Throws ApiError with error code so frontend can differentiate error types.
 */
export async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  let body;
  try {
    body = await res.json();
  } catch (e) {
    // Handle non-JSON responses (HTML error pages, etc.)
    throw new ApiError('INTERNAL_ERROR', res.statusText || 'Request failed');
  }

  // Success: ok=true
  if (body.ok === true) {
    return body.data;
  }

  // Failure: ok=false, error is structured
  const error = body.error || {};
  const code = error.code || 'INTERNAL_ERROR';
  const message = error.message || 'Request failed';
  const details = error.details;

  throw new ApiError(code, message, details);
}

/**
 * Convert ApiError to user-friendly message based on error code.
 * Centralizes error message mapping across frontend.
 */
export function describeApiError(error, fallbackMessage = 'An error occurred') {
  if (!(error instanceof ApiError)) {
    return error?.message || fallbackMessage;
  }

  if (error.code === 'VALIDATION_ERROR') {
    return error.message; // Validation errors are already user-friendly
  }
  if (error.code === 'SERVICE_ERROR') {
    return 'Service temporarily unavailable. Please try again.';
  }
  if (error.code === 'DATABASE_ERROR') {
    return 'Database error. Please try again.';
  }
  return error.message || fallbackMessage;
}