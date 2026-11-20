import { Link } from 'react-router';
import { pageSearch } from '@table-booking/shared/booking';

type PaginationProps = { page: number; totalPages: number };

const LINK_BASE =
  'inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const SECONDARY_LINK = `${LINK_BASE} border border-field bg-white text-ink hover:bg-paper`;
const PRIMARY_LINK = `${LINK_BASE} bg-ink text-white hover:bg-ink-raised`;

// Previous / "Page 2 of 3" / Next, as real links (so Back, reload and bookmarks work). Not shown when everything fits on one
// page. A page number past the end (a hand-edited URL) still gets a Previous link, to the last real page.
export default function Pagination({ page, totalPages }: PaginationProps) {
  if (totalPages <= 1) return null;
  const previous = Math.min(page - 1, totalPages);

  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <span aria-current="page" className="text-sm font-semibold text-muted">
        Page {Math.min(page, totalPages)} of {totalPages}
      </span>
      <div className="flex items-center gap-3">
        {previous >= 1 && (
          <Link to={pageSearch(previous)} className={SECONDARY_LINK}>
            Previous
          </Link>
        )}
        {page < totalPages && (
          <Link to={pageSearch(page + 1)} className={PRIMARY_LINK}>
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}
