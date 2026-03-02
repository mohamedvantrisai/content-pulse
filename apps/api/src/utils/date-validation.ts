import { z } from 'zod';

export const INVALID_DATE_MSG = 'Invalid date format. Use ISO 8601 (YYYY-MM-DD).';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns true only when the string is a calendar-valid ISO 8601 date.
 * Rejects regex-matching but invalid dates like 2025-13-01 or 2025-02-30
 * by round-tripping through Date and comparing the serialised output.
 */
export function isStrictIsoDate(s: string): boolean {
    if (!ISO_DATE_REGEX.test(s)) return false;
    const d = new Date(`${s}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Zod schema for a strict ISO date string (YYYY-MM-DD, calendar-valid).
 * Reusable across REST routes and GraphQL resolvers.
 */
export function strictIsoDate(requiredError?: string) {
    return z
        .string({ required_error: requiredError })
        .refine(isStrictIsoDate, { message: INVALID_DATE_MSG });
}
