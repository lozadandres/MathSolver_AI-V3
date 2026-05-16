import { Routes, Route, Navigate } from 'react-router-dom';
import ChatBox from './components/ChatBox';
import LoginView from './views/LoginView';
import RegisterView from './views/RegisterView';
import AdminDashboard from './views/AdminDashboard';
import ProfesorDashboard from './views/ProfesorDashboard';
import EstudianteDashboard from './views/EstudianteDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import './App.css';

const HomeRedirect = () => {
  const { user } = useAuth();
  if (user?.role === 'Admin') return <Navigate to="/admin" />;
  if (user?.role === 'Profesor') return <Navigate to="/profesor" />;
  return <Navigate to="/dashboard" />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />
      <Route path="/register" element={<RegisterView />} />
      <Route 
        path="/admin/*" 
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/profesor/*" 
        element={
          <ProtectedRoute allowedRoles={['Profesor']}>
            <ProfesorDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/" 
        element={
          <ProtectedRoute allowedRoles={['Estudiante', 'Profesor', 'Admin']}>
            <HomeRedirect />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['Estudiante']}>
            <EstudianteDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/chat/:groupId" 
        element={
          <ProtectedRoute allowedRoles={['Estudiante', 'Profesor']}>
            <div className="app-container">
              <ChatBox />
            </div>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/chat" 
        element={
          <ProtectedRoute allowedRoles={['Estudiante', 'Profesor']}>
            <div className="app-container">
              <ChatBox />
            </div>
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

export default App;
