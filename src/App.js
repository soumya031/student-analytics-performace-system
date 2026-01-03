import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { Toaster } from 'react-hot-toast';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components
import Navbar from './components/Navbar';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/Dashboard';
import ExamList from './components/exam/ExamList';
import ExamTaking from './components/exam/ExamTaking';
import CreateExam from './components/exam/CreateExam';
import EditExam from './components/exam/EditExam';
import Profile from './components/Profile';
import Analytics from './components/Analytics';

// Theme
const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
    background: { default: '#f5f5f5' },
  },
});

// ---------- ROUTE GUARDS ----------

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

const TeacherRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'teacher') return <Navigate to="/dashboard" />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? <Navigate to="/dashboard" /> : children;
};

// ---------- APP ----------

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Navbar />
          <Box sx={{ pt: 8 }}>
            <Routes>

              {/* PUBLIC */}
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

              {/* PROTECTED */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/exam" element={<ProtectedRoute><ExamList /></ProtectedRoute>} />
              <Route path="/exam/:examId" element={<ProtectedRoute><ExamTaking /></ProtectedRoute>} />

              {/* TEACHER */}
              <Route path="/exam/create" element={<TeacherRoute><CreateExam /></TeacherRoute>} />
              <Route path="/exam/edit/:examId" element={<TeacherRoute><EditExam /></TeacherRoute>} />

              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </Box>
        </Router>

        <Toaster position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
