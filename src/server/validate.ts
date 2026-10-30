import type { z } from 'zod';

export class ValidationError extends Error {
  constructor(public readonly details: unknown) {
    super('Invalid request');
  }
}

/** Parses untrusted input with a zod schema or throws a ValidationError (400). */
export function parseBody<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error.issues);
  return result.data;
}
