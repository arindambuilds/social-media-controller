import { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";

/**
 * Generic request validation middleware
 * Usage: validateRequest({ body: mySchema })
 */
export function validateRequest(schemas: {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input data",
            details: error.errors.map((e) => ({
              path: e.path.join("."),
              message: e.message
            }))
          }
        });
      } else {
        next(error);
      }
    }
  };
}

/**
 * Common validation schemas for reuse across routes
 */
export const commonSchemas = {
  phoneNumber: z
    .string()
    .regex(/^\+[\d\s]{8,20}$/, "Phone number must start with + and contain 8-20 digits"),

  email: z.string().email("Invalid email address").toLowerCase(),

  url: z.string().url("Invalid URL").max(2048),

  objectId: z.string().cuid("Invalid ID format"),

  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  }),

  dateRange: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  }).refine(
    (data) => new Date(data.endDate) > new Date(data.startDate),
    { message: "End date must be after start date" }
  ),

  whatsappNumber: z
    .string()
    .max(40)
    .nullable()
    .optional()
    .refine(
      (val) =>
        val === undefined ||
        val === null ||
        val === "" ||
        (/^\+[\d\s]+$/.test(val) && /\d/.test(val.replace(/\s/g, ""))),
      { message: "WhatsApp number must start with + and use only digits and spaces" }
    ),

  instagramHandle: z
    .string()
    .regex(/^@?[a-zA-Z0-9._]+$/, "Invalid Instagram handle format")
    .transform((val) => val.replace(/^@/, "")),

  caption: z.string().max(2200, "Caption too long (max 2200 characters)").trim(),

  mediaUrl: z.string().url("Invalid media URL").max(2048),

  timezone: z.string().refine(
    (tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid timezone" }
  )
};

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim();
}

/**
 * Validate and sanitize all string fields in request body
 */
export function sanitizeRequestBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === "string") {
        req.body[key] = sanitizeInput(value);
      }
    }
  }
  next();
}
