import { Router } from 'express';
import { createBookingSchema, type CreateBookingInput } from '../bookings/schemas';
import { createBooking, listMyBookings } from '../bookings/service';
import { paginationQuerySchema } from '../lib/pagination';
import { authenticate, currentUser } from '../middleware/auth';
import { validate, validateQuery, type ValidatedRequest } from '../middleware/validate';

const router = Router();

const listQuery = validateQuery(paginationQuerySchema);

// authenticate runs before validation: an anonymous caller gets 401 and learns nothing about the expected input.
router.post('/', authenticate, validate(createBookingSchema), async (req: ValidatedRequest<CreateBookingInput>, res) => {
  // The booking's owner is the authenticated user, never a field of the request body.
  const booking = await createBooking(req.body, currentUser(req).id);

  res.status(201).json({ booking });
});

// Always the caller's own bookings: the user id comes from the token, there is no way to ask for someone else's.
router.get('/me', authenticate, listQuery.middleware, async (req, res) => {
  res.json(await listMyBookings(currentUser(req).id, listQuery.get(req)));
});

export default router;
