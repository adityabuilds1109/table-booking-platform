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

// Express 5 makes req.query a read-only getter (assigning to it is ignored), so `validate`'s write-back trick
// doesn't work for it. These validators keep the parsed value in a WeakMap keyed by the request instead
// (entries disappear with the request, so nothing leaks), and `get` returns it with the schema's output type.
// No casts or `any` needed: the WeakMap's value type comes straight from the schema.
function requestPartValidator<S extends z.ZodType>(schema: S, pick: (req: Request) => unknown) {
  const parsed = new WeakMap<Request, z.output<S>>();

  const middleware: RequestHandler = (req, _res, next) => {
    // A failure throws a ZodError -> central error handler -> 400 VALIDATION_ERROR, same as `validate`.
    parsed.set(req, schema.parse(pick(req)));
    next();
  };

  const get = (req: Request): z.output<S> => {
    const value = parsed.get(req);
    // Reaching this means the route forgot to mount `middleware`: a programming error, so a plain Error (-> 500).
    if (value === undefined) {
      throw new Error('Validated value requested but its validation middleware did not run on this route');
    }
    return value;
  };

  return { middleware, get };
}

// Usage: const listQuery = validateQuery(schema);
//        router.get('/', listQuery.middleware, (req, res) => { const { page } = listQuery.get(req); ... });
export function validateQuery<S extends z.ZodType>(schema: S) {
  return requestPartValidator(schema, (req) => req.query);
}

export function validateParams<S extends z.ZodType>(schema: S) {
  return requestPartValidator(schema, (req) => req.params);
}
