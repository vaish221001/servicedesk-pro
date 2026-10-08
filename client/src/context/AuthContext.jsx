import { useState, useEffect } from 'react';
import api, { getToken, setToken, clearToken } from '../services/apiClient';
import { AuthContext } from './AuthContextInstance';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tokenState, setTokenState] = useState(getToken());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function restoreSession() {
      const existingToken = getToken();
      if (!existingToken) {
        if (!ignore) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await api.get('/auth/me');
        if (!ignore && response && response.user) {
          setUser(response.user);
          setTokenState(existingToken);
        } else if (!ignore) {
          clearToken();
          setUser(null);
          setTokenState(null);
        }
      } catch (err) {
        if (!ignore) {
          console.warn('Session restoration failed:', err.message);
          clearToken();
          setUser(null);
          setTokenState(null);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    // Listen for 401 unauthorized events emitted by apiClient
    const handleUnauthorized = () => {
      clearToken();
      setUser(null);
      setTokenState(null);
      setError('Your session has expired. Please sign in again.');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      ignore = true;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  /**
   * Authenticates user with email and password.
   *
   * @param {string} email
   * @param {string} password
   */
  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });

      if (!response.success || !response.token) {
        throw new Error(response.message || 'Login failed. Invalid response from server.');
      }

      setToken(response.token);
      setTokenState(response.token);
      setUser(response.user);
      return { success: true, user: response.user };
    } catch (err) {
      const msg = err.message || 'Unable to connect to the authentication service.';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logs out the user and clears all cached credentials.
   */
  const logout = () => {
    clearToken();
    setUser(null);
    setTokenState(null);
    setError(null);
  };

  /**
   * Refreshes the currently loaded user profile.
   */
  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response && response.user) {
        setUser(response.user);
      }
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  const value = {
    user,
    token: tokenState,
    isAuthenticated: !!user && !!tokenState,
    isLoading,
    error,
    login,
    logout,
    refreshUser,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
