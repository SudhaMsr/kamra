import { ZodError } from "zod";

/** A human-readable message for anything thrown by validation or the store. */
export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? fallback;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
