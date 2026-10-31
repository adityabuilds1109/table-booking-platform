import { Link } from 'react-router';
import { pageSearch } from '../booking/myBookings';

type PaginationProps = { page: number; totalPages: number };

const linkClass =
  'inline-flex min-h-10 items-center rounded border border-slate-500 bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';

// Previous / "Page 2 of 3" / Next, as real links (so Back, reload and bookmarks work). Not shown when everything fits on one
// page. A page number past the end (a hand-edited URL) still gets a Previous link, to the last real page.
export default function Pagination({ page, totalPages }: PaginationProps) {
  if (totalPages <= 1) return null;
  const previous = Math.min(page - 1, totalPages);

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      {previous >= 1 ? (
        <Link to={pageSearch(previous)} className={linkClass}>
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span aria-current="page" className="text-slate-800">
        Page {Math.min(page, totalPages)} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link to={pageSearch(page + 1)} className={linkClass}>
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
