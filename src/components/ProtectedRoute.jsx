import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from '../context/AppContext';

// Use with roles={['student']} to allow only some roles.
// With children it wraps them; without children it shows the nested routes.
export default function ProtectedRoute({ roles, children }) {
  const { user, ready } = useApp();
  if (!ready) return <div className="p-4 text-center">Connecting to PingBoard…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children ? children : <Outlet />;
}
