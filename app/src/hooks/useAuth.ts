// ClockMate Pro - Authentication Hook
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useOrgStore } from '@/store';
import { startPasswordAuth, registerUser, logout as logoutApi } from '@/lib/api';
import type { LoginCredentials, RegisterData, User } from '@/types';

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const navigate = useNavigate();
  const { user, isAuthenticated, setUser, setAuthenticated, setLoading } = useAuthStore();
  const { setOrgs } = useOrgStore();
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setLoading(true);
    setError(null);

    try {
      const response = await startPasswordAuth(credentials.email, credentials.password);
      
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      setUser(response.user);
      setAuthenticated(true);
      
      // Navigate to orgs page
      navigate('/orgs');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [navigate, setUser, setAuthenticated, setLoading]);

  const register = useCallback(async (data: RegisterData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await registerUser(data.name, data.email, data.password);
      
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      setUser(response.user);
      setAuthenticated(true);
      
      // Navigate to orgs page
      navigate('/orgs');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [navigate, setUser, setAuthenticated, setLoading]);

  const logout = useCallback(async () => {
    setLoading(true);

    try {
      await logoutApi();
      setUser(null);
      setAuthenticated(false);
      setOrgs([]);
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Logout failed.');
    } finally {
      setLoading(false);
    }
  }, [navigate, setUser, setAuthenticated, setOrgs, setLoading]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading: useAuthStore.getState().isLoading,
    login,
    register,
    logout,
    error,
    clearError,
  };
}
