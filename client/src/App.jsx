import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import NewReview from './pages/NewReview';
import DocumentDetail from './pages/DocumentDetail';
import SMEReview from './pages/SMEReview';
import NotFound from './pages/NotFound';
import { useEffect, useState } from 'react';
import api from './api';

// Checks setup status once per session and redirects to /setup if needed.
// SME review links (/review/:token) are exempt so they always work.
function SetupGuard({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (location.pathname.startsWith('/review/') || location.pathname === '/setup') {
      setChecked(true);
      return;
    }
    api.get('/api/setup/status').then(data => {
      if (data.setupRequired) navigate('/setup', { replace: true });
    }).catch(() => {}).finally(() => setChecked(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!checked) return null;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SetupGuard>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/documents/new" element={
              <ProtectedRoute><NewReview /></ProtectedRoute>
            } />
            <Route path="/documents/:id" element={
              <ProtectedRoute><DocumentDetail /></ProtectedRoute>
            } />
            <Route path="/review/:token" element={<SMEReview />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SetupGuard>
      </BrowserRouter>
    </AuthProvider>
  );
}
