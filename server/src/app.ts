import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);

// Must stay last: the 404 catch-all, then the central error middleware.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
