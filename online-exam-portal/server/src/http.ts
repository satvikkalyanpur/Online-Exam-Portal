// Small helpers shared by the route handlers.

/** An error with an HTTP status. Thrown by handlers and turned into JSON in app.ts. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Extra fields sent along with the error message. */
    public extra: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

export function isOptionKey(value: unknown): value is OptionKey {
  return typeof value === 'string' && (OPTION_KEYS as readonly string[]).includes(value);
}

/** Returns the trimmed string, or throws 400 if it is missing, empty or too long. */
export function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${field} is required.`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new HttpError(400, `${field} must be at most ${maxLength} characters.`);
  }
  return text;
}

/** Returns the trimmed string or null, or throws 400 if it is too long. */
export function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireText(value, field, maxLength);
}

/** Accepts whole numbers sent as numbers or numeric strings (form fields). */
export function requireInt(value: unknown, field: string, min: number, max: number): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `${field} must be a whole number between ${min} and ${max}.`);
  }
  return n;
}

export function requireDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new HttpError(400, `${field} is required.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${field} is not a valid date and time.`);
  }
  return date;
}

/** A list of ids (e.g. exam ids). Missing means an empty list. */
export function idList(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !id)) {
    throw new HttpError(400, `${field} must be a list of ids.`);
  }
  return [...new Set(value as string[])];
}

/** Score as a percentage with one decimal place. */
export function percentage(score: number, maxScore: number): number {
  return maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0;
}
