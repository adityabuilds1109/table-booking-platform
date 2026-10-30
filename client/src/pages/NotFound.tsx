import { Link } from 'react-router';

export default function NotFound() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600">
        There is nothing at this address.{' '}
        <Link to="/" className="text-emerald-700 underline">
          Go to the home page
        </Link>
        .
      </p>
    </section>
  );
}
