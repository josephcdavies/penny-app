import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewReview from './pages/NewReview';
import DocumentDetail from './pages/DocumentDetail';
import SMEReview from './pages/SMEReview';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
      </BrowserRouter>
    </AuthProvider>
  );
}
