import { createContext } from 'react';
import type { LoginInput, RegisterInput } from '../api/endpoints';
import type { CurrentUser } from '../api/schemas';

// loading:       a stored token is being checked with the server (GET /auth/me).
// anonymous:     nobody is logged in. `expired` is set when a live session was just ended by the server (401), so every
//                redirect to /login, whichever code path makes it, carries the same "your session expired" notice.
// authenticated: the server confirmed the token; `user` comes from the server, never from decoding the JWT.
// error:         the check could not finish (server unreachable, 5xx). The token is kept, so a retry can succeed;
//                logging the user out because the network blinked would be wrong.
export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; expired?: boolean }
  | { status: 'authenticated'; user: CurrentUser }
  | { status: 'error'; message: string };

export type AuthContextValue = {
  state: AuthState;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  retry: () => void;
};

// React context lets any component read "who is logged in" without passing it down through every parent as props.
export const AuthContext = createContext<AuthContextValue | null>(null);
