import { Route, Routes } from 'react-router';
import GuestOnly from './auth/GuestOnly';
import RequireAuth from './auth/RequireAuth';
import Layout from './components/Layout';
import Availability from './pages/Availability';
import Login from './pages/Login';
import MyBookings from './pages/MyBookings';
import NotFound from './pages/NotFound';
import Register from './pages/Register';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Availability />} />
        <Route element={<GuestOnly />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="bookings" element={<MyBookings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
