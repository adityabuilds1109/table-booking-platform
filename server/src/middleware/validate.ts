import type { Request, RequestHandler } from 'express';
import type { z } from 'zod';

// Request whose body has already passed `validate`, so handlers get the schema's output type instead of `any`.
export type ValidatedRequest<T> = Request<Record<string, string>, unknown, T>;

// Parses req.body at the route boundary and replaces it with the parsed (trimmed, normalized) value.
// A failure throws a ZodError; Express 5 forwards sync throws to the central error handler, which returns 400.
export function validate<S extends z.ZodType>(schema: S): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}
