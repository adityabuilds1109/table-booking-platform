import { Navigate, Outlet, useLocation } from 'react-router';
import { pathAfterLogin } from './loginRedirect';
import { useAuth } from './useAuth';

// Wraps /login and /register. A logged-in visitor has no business there, so they are sent on to the page they wanted
// (or home). This also means a login form only has to call login(): the redirect after success happens here.
export default function GuestOnly() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'authenticated') {
    return <Navigate to={pathAfterLogin(location.state)} replace />;
  }
  return <Outlet />;
}
