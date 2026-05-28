import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuthStore } from './stores/authStore';

import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import EventSetup from './pages/admin/EventSetup';
import Registration from './pages/admin/Registration';
import Draw from './pages/admin/Draw';
import Judging from './pages/admin/Judging';
import ResultsAdmin from './pages/admin/ResultsAdmin';

import Register from './pages/public/Register';
import Results from './pages/public/Results';
import Privacy from './pages/public/Privacy';
import About from './pages/public/About';
import Unsubscribe from './pages/public/Unsubscribe';

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/events/:id/register" element={<Register />} />
      <Route path="/events/:id/results" element={<Results />} />
      <Route path="/unsubscribe/:token" element={<Unsubscribe />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/about" element={<About />} />

      {/* Auth */}
      <Route path="/login" element={<Login />} />

      {/* Admin (protected) */}
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/events/:id/setup" element={<RequireAuth><EventSetup /></RequireAuth>} />
      <Route path="/events/:id/registration" element={<RequireAuth><Registration /></RequireAuth>} />
      <Route path="/events/:id/draw" element={<RequireAuth><Draw /></RequireAuth>} />
      <Route path="/events/:id/judging" element={<RequireAuth><Judging /></RequireAuth>} />
      <Route path="/events/:id/results-admin" element={<RequireAuth><ResultsAdmin /></RequireAuth>} />

      {/* Default */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
