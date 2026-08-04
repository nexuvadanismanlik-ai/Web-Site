/**
 * The single response shape every Nexuva API endpoint answers with.
 *
 * Applied centrally by the API's TransformInterceptor rather than by each
 * handler, so a controller returns its payload and nothing else. Clients unwrap
 * once, in their fetch helper.
 */
export interface ApiResponse<T = void> {
  success: true;
  /** Human-readable note for the caller to display. Empty when there is none. */
  message: string;
  data: T;
}

/**
 * Stable, machine-readable reason a request failed.
 *
 * `message` is written for a person and may be reworded at any time; clients
 * that need to branch on the kind of failure must read `errorCode` instead.
 */
export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR';

export interface ApiError {
  success: false;
  statusCode: number;
  errorCode: ApiErrorCode;
  message: string;
  errors?: Record<string, string[]>;
  timestamp: string;
  path: string;
}
