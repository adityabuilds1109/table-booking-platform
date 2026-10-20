import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Must stay last: the 404 catch-all, then the central error middleware.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
