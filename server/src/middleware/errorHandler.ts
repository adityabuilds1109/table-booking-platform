import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors';

// Names of database objects whose violations we translate into specific API errors.
// 'booking_no_overlap' lives in the init migration; 'User_email_key' is Prisma's name for User.email @unique.
export const SLOT_OVERLAP_CONSTRAINT = 'booking_no_overlap';
export const USER_EMAIL_UNIQUE_INDEX = 'User_email_key';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Prisma 7 + adapter-pg wraps the driver error as err.meta.driverAdapterError.cause
// for both model queries (P2039/P2002) and raw queries (P2010). Returns undefined if any link is missing.
function getDriverCause(err: unknown): Record<string, unknown> | undefined {
  if (!isRecord(err) || !isRecord(err.meta)) return undefined;
  const adapterError = err.meta.driverAdapterError;
  if (!isRecord(adapterError)) return undefined;
  return isRecord(adapterError.cause) ? adapterError.cause : undefined;
}

function isSlotTaken(err: unknown): boolean {
  const cause = getDriverCause(err);
  return (
    cause !== undefined &&
    cause.code === '23P01' &&
    typeof cause.message === 'string' &&
    // Quoted, so a future constraint like "booking_no_overlap_v2" doesn't match.
    cause.message.includes(`"${SLOT_OVERLAP_CONSTRAINT}"`)
  );
}

function isEmailTaken(err: unknown): boolean {
  const cause = getDriverCause(err);
  if (!isRecord(err) || err.code !== 'P2002' || cause === undefined) return false;
  return isRecord(cause.constraint) && cause.constraint.index === USER_EMAIL_UNIQUE_INDEX;
}

// body-parser (inside express.json) throws errors carrying `type` and `status`.
function getBodyParserErrorType(err: unknown): string | undefined {
  if (!isRecord(err) || typeof err.status !== 'number' || typeof err.type !== 'string') {
    return undefined;
  }
  return err.type;
}

function send(res: Parameters<ErrorRequestHandler>[2], status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}

export const notFoundHandler: RequestHandler = () => {
  throw new AppError(404, 'NOT_FOUND', 'Route not found');
};

// Express recognises an error handler by its 4 parameters, so `_next` must stay even though it's unused.
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    send(res, err.status, err.code, err.message);
    return;
  }

  if (err instanceof ZodError) {
    const message = err.issues
      .map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
      .join('; ');
    send(res, 400, 'VALIDATION_ERROR', message);
    return;
  }

  const bodyErrorType = getBodyParserErrorType(err);
  if (bodyErrorType === 'entity.parse.failed') {
    send(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
    return;
  }
  if (bodyErrorType === 'entity.too.large') {
    send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    return;
  }

  if (isEmailTaken(err)) {
    send(res, 409, 'EMAIL_TAKEN', 'An account with this email already exists');
    return;
  }

  if (isSlotTaken(err)) {
    // The driver's message/detail contain table ids and times, so log them but never send them.
    console.error('Booking overlap rejected by database:', err);
    send(res, 409, 'SLOT_TAKEN', 'This table is already booked for the requested time');
    return;
  }

  console.error('Unhandled error:', err);
  send(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
};
