import { Router } from 'express';
import { createBookingSchema, type CreateBookingInput } from '../bookings/schemas';
import { createBooking } from '../bookings/service';
import { authenticate, currentUser } from '../middleware/auth';
import { validate, type ValidatedRequest } from '../middleware/validate';

const router = Router();

// authenticate runs before validate: an anonymous caller gets 401 and learns nothing about the expected body.
router.post('/', authenticate, validate(createBookingSchema), async (req: ValidatedRequest<CreateBookingInput>, res) => {
  // The booking's owner is the authenticated user, never a field of the request body.
  const booking = await createBooking(req.body, currentUser(req).id);

  res.status(201).json({ booking });
});

export default router;
