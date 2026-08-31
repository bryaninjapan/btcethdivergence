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