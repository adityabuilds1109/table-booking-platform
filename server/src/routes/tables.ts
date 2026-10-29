import { Router } from 'express';
import { assertBookable } from '../bookings/rules';
import { availabilityQuerySchema } from '../bookings/schemas';
import { listAvailableTables } from '../bookings/service';
import { validateQuery } from '../middleware/validate';

const router = Router();

const availabilityQuery = validateQuery(availabilityQuerySchema);

// Public on purpose: browsing availability needs no account; only booking does.
router.get('/availability', availabilityQuery.middleware, async (req, res) => {
  const query = availabilityQuery.get(req);
  // Same time rules as booking, so the client isn't shown "available" for a slot it could never book.
  assertBookable(query.startsAt, new Date());

  res.json({ tables: await listAvailableTables(query) });
});

export default router;
