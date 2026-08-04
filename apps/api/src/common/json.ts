import type { Prisma } from '@prisma/client';

/**
 * Reads a Prisma JSON column as the shape the application expects.
 *
 * Prisma types JSON columns as `JsonValue`, which is honest — the database
 * makes no promise about what is in there. The application does: writes go
 * through zod schemas, so the column holds what those schemas allowed.
 *
 * That gap has to be crossed somewhere. Crossing it here, once, with a name,
 * beats fifteen scattered `as unknown as` expressions: the assumption is stated
 * in one place, every crossing is greppable, and the day these columns get
 * runtime validation there is a single function to change.
 *
 * This is not validation. It asserts. Use it only where a schema governs the
 * write side.
 */
export function fromJson<T>(value: Prisma.JsonValue | null | undefined): T {
  // eslint-disable-next-line no-restricted-syntax -- this function is the boundary
  return value as unknown as T;
}

/** The inverse: hands an application object to Prisma as a JSON column value. */
export function toJson(value: unknown): Prisma.InputJsonValue {
  // eslint-disable-next-line no-restricted-syntax -- same boundary, other direction
  return value as unknown as Prisma.InputJsonValue;
}
