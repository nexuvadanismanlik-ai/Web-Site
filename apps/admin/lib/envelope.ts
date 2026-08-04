/**
 * Takes the payload out of the API's standard response envelope.
 *
 * Every endpoint answers `{success, message, data}`, applied centrally by the
 * API's TransformInterceptor. Callers want the payload, so unwrapping happens
 * in the two transport helpers rather than at each call site.
 *
 * Its own module because both lib/api.ts and lib/auth.ts need it, and auth.ts
 * cannot import api.ts — api.ts reads the session from it.
 */
export function unwrap<T>(body: unknown): T {
  if (body !== null && typeof body === 'object' && 'success' in body && 'data' in body) {
    return (body as { data: T }).data;
  }
  // Sent with @NoEnvelope(), or by something that is not our API.
  return body as T;
}
