import type { Response } from "express";
import { z } from "zod";

export const idSchema = z.coerce.number().int().positive();
export const shortText = z.string().trim().min(1).max(200);
export const optionalText = (max = 5000) => z.string().trim().max(max).optional().nullable();
export const colourSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
}).refine((value) => (value.latitude == null) === (value.longitude == null), {
  message: "Latitude and longitude must be supplied together",
});

/** A strict YYYY-MM-DD calendar date that must exist (rejects e.g. 2026-02-31). */
export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, "That calendar date does not exist");

export const strongPassword = z.string().min(14).max(128)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a symbol");

export function validationError(res: Response, error?: z.ZodError): void {
  const flattened = error?.flatten();
  res.status(400).json({
    error: error?.issues[0]?.message ?? "Invalid request",
    details: {
      fields: flattened?.fieldErrors ?? {},
      form: flattened?.formErrors ?? [],
    },
  });
}

export function isPostgresError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
