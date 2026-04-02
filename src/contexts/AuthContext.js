import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const authApi = axios.create({
  baseURL: API_BASE_URL,
});

const isAuthEndpoint = (url = '') => (
  url.includes('/auth/login')
  || url.includes('/auth/register')
  || url.includes('/auth/forgot-password')
);

const getRequestToken = (config) => {
  const authHeader = config?.headers?.Authorization || config?.headers?.authorization;
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
};

const isUnauthorizedStatus = (status) => status === 401 || status === 403;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const requestInterceptor = authApi.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    const responseInterceptor = authApi.interceptors.response.use(
      (response) => response,
      (error) => {
        const token = localStorage.getItem('token');
        const requestUrl = error.config?.url || '';
        const requestToken = getRequestToken(error.config);
        const shouldClearSession =
          error.response?.status === 401
          && token
          && requestToken
          && token === requestToken
          && !isAuthEndpoint(requestUrl);

        if (shouldClearSession) {
          localStorage.removeItem('token');
          localStorage.removeItem('latestSubmittedExamResult');
          setUser(null);
          if (window.location.pathname !== '/login') {
            toast.error('Session expired. Please login again.');
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      authApi.interceptors.request.eject(requestInterceptor);
      authApi.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const tokenAtStart = localStorage.getItem('token');
    try {
      if (tokenAtStart) {
        const response = await authApi.get('/auth/profile');
        setUser(response.data.user);
      }
    } catch (error) {
      if (
        tokenAtStart
        && isUnauthorizedStatus(error.response?.status)
        && localStorage.getItem('token') === tokenAtStart
      ) {
        localStorage.removeItem('token');
        localStorage.removeItem('latestSubmittedExamResult');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      localStorage.removeItem('token');
      const response = await authApi.post('/auth/login', {
        email: String(email || '').trim(),
        password,
      });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setUser(user);
      
      toast.success('Login successful!');
      return { success: true };
    } catch (error) {
      const message =
        error.response?.data?.message
        || error.response?.data?.errors?.[0]?.msg
        || 'Login failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      localStorage.removeItem('token');
      const response = await authApi.post('/auth/register', userData);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setUser(user);
      
      toast.success('Registration successful!');
      return { success: true };
    } catch (error) {
      const message =
        error.response?.data?.message
        || error.response?.data?.errors?.[0]?.msg
        || 'Registration failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('latestSubmittedExamResult');
    sessionStorage.removeItem('token');
    setUser(null);
    toast.success('Logged out successfully');
  };

  const forgotPassword = async (recoveryData) => {
    try {
      const response = await authApi.post('/auth/forgot-password', recoveryData);
      toast.success(response.data.message || 'Password reset successful');
      return { success: true, message: response.data.message };
    } catch (error) {
      const message = error.response?.data?.message || 'Password reset failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await authApi.put('/auth/profile', profileData);
      setUser(response.data.user);
      toast.success('Profile updated successfully!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await authApi.put('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed successfully!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Password change failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    forgotPassword,
    updateProfile,
    changePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 
