import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { setSessionExpiredHandler, api } from '../api';
import { ApiError } from '../api/client';
import type { AuthResponse } from '../api/schemas';
import { AuthContext, type AuthContextValue, type AuthState } from './authContext';
import { loginStateFor } from './loginRedirect';
import { tokenStore } from './tokenStore';

const ANONYMOUS: AuthState = { status: 'anonymous' };

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  // With no stored token there is nothing to check, so no "loading" flash for logged-out visitors.
  const [state, setState] = useState<AuthState>(() => (tokenStore.get() ? { status: 'loading' } : ANONYMOUS));
  const [checkAttempt, setCheckAttempt] = useState(0);

  // Event handlers registered once (storage events, session expiry) must see the CURRENT state and location, not the
  // values from the render that registered them, hence refs kept up to date after every render.
  const stateRef = useRef(state);
  const locationRef = useRef(location);
  useEffect(() => {
    stateRef.current = state;
    locationRef.current = location;
  });

  // On start (and on retry): if a token is stored, ask the server who it belongs to.
  useEffect(() => {
    if (!tokenStore.get()) {
      setState(ANONYMOUS);
      return;
    }
    setState({ status: 'loading' });
    const controller = new AbortController();
    api.getMe(controller.signal).then(
      (user) => setState({ status: 'authenticated', user }),
      (err: unknown) => {
        if (isAbort(err)) return;
        // UNAUTHORIZED: the API layer already cleared the stored token. The visitor simply isn't logged in; protected
        // pages will send them to /login on their own, public pages just show the logged-out view.
        if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
          setState(ANONYMOUS);
          return;
        }
        setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Something went wrong.' });
      },
    );
    return () => controller.abort();
  }, [checkAttempt]);

  // A request made while logged in came back 401 UNAUTHORIZED (the API layer has already cleared the token): the session
  // is over. Show the logged-out UI and send the user to /login, remembering the page so they return after logging in.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (stateRef.current.status !== 'authenticated') return; // the startup check handles its own 401
      // Two things now want to send the user to /login: this handler (needed on public pages) and RequireAuth (on
      // protected ones). Both read the same `expired` flag, so it does not matter which one lands last.
      setState({ status: 'anonymous', expired: true });
      void navigate('/login', { replace: true, state: loginStateFor(locationRef.current, true) });
    });
    return () => setSessionExpiredHandler(null);
  }, [navigate]);

  // The flag has done its job once /login is on screen (the notice itself lives in the navigation state, which stays
  // with that history entry). Clearing it stops a later, unrelated visit to a protected page from claiming "expired".
  useEffect(() => {
    if (state.status === 'anonymous' && state.expired && location.pathname === '/login') setState(ANONYMOUS);
  }, [state, location.pathname]);

  // Another tab logged out (token gone) or logged in (token appeared): follow it.
  useEffect(
    () =>
      tokenStore.onChangeInOtherTab(() => {
        if (!tokenStore.get()) setState(ANONYMOUS);
        else if (stateRef.current.status !== 'authenticated') setCheckAttempt((n) => n + 1);
      }),
    [],
  );

  const startSession = useCallback((response: AuthResponse) => {
    tokenStore.set(response.token);
    setState({
      status: 'authenticated',
      user: { id: response.user.id, email: response.user.email, role: response.user.role },
    });
  }, []);

  const login = useCallback<AuthContextValue['login']>(
    async (input) => startSession(await api.login(input)),
    [startSession],
  );

  const register = useCallback<AuthContextValue['register']>(
    async (input) => startSession(await api.register(input)),
    [startSession],
  );

  // Logging out takes two steps, in this order: go home, THEN forget the session. Doing both at once does not work: the
  // router applies navigation a little later than a plain state update, so for a moment the protected page would still be
  // on screen with an anonymous user, and RequireAuth would bounce them to /login (remembering the page they just left).
  // Waiting until the router reports it is on "/" removes any dependence on which update lands first.
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = useCallback(() => {
    setLoggingOut(true);
    void navigate('/', { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (loggingOut && location.pathname === '/') {
      tokenStore.clear();
      setState(ANONYMOUS);
      setLoggingOut(false);
    }
  }, [loggingOut, location.pathname]);

  const retry = useCallback(() => setCheckAttempt((n) => n + 1), []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, login, register, logout, retry }),
    [state, login, register, logout, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
