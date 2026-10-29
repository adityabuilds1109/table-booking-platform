import cors from 'cors';
import express from 'express';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import bookingsRouter from './routes/bookings';
import tablesRouter from './routes/tables';

const app = express();

// CORS lets the browser app (a different origin) read this API's responses. It stays the FIRST middleware:
//  - a preflight (the browser's automatic OPTIONS request before a call with an Authorization header or PATCH) carries
//    no token, so it must be answered before any authentication runs;
//  - error responses (401, 404, 409, ...) must carry the headers too, or the browser hides their JSON body from the app.
// The API uses a Bearer header, not cookies, so credentials stay off. That also keeps a fixed allow-list valid: with
// credentials on, the browser would demand much stricter handling. Only the methods and headers the API really uses
// are allowed, and origins come from CORS_ORIGINS (exact matches, never "*").
// CORS is enforced by browsers only; it does not stop curl or another server from calling the API.
app.use(
  cors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    maxAge: 600,
  }),
);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/bookings', bookingsRouter);
app.use('/tables', tablesRouter);

// Must stay last: the 404 catch-all, then the central error middleware.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
