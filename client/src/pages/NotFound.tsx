import { Link } from 'react-router';

export default function NotFound() {
  return (
    <section className="mx-auto max-w-page px-4 py-16 sm:px-8">
      <h1 className="font-display text-4xl leading-tight font-bold tracking-[-0.03em]">Page not found</h1>
      <p className="mt-3 text-muted">There is nothing at this address.</p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-ink px-5 font-semibold text-white hover:bg-ink-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Go to the home page
      </Link>
    </section>
  );
}
