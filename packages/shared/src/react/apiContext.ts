import { createContext } from 'react';
import type { CreateApiResult } from '../api';

// React context lets any component read the API object without it being passed down through every parent as props.
// The value is what createApi() returned; it is created once by the app (see client/src/main.tsx) and never changes.
export const ApiContext = createContext<CreateApiResult | null>(null);
