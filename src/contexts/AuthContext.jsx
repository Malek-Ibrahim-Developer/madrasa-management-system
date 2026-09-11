/**
 * Auth Context — global authentication state for Altus Kairos
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import storageService from '../services/storageService';
import authService from '../services/authService';

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const AuthContext = createContext(null);

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  /* ---- Bootstrap: seed data & restore session on mount ---- */
  useEffect(() => {
    try {
      // Seed default users if this is the first load
      storageService.initializeData(() => {
        authService.seedDefaultUsers();
      });

      // Attempt to restore an existing session
      if (authService.isSessionValid()) {
        const session = authService.getSession();
        setUser(session.user);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('[AuthContext] Bootstrap error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ---- Login ---- */
  const login = useCallback(
    async (email, password) => {
      try {
        const authenticatedUser = authService.authenticate(email, password);
        authService.createSession(authenticatedUser);
        setUser(authenticatedUser);
        setIsAuthenticated(true);

        toast.success(`Welcome back, ${authenticatedUser.name}!`, {
          icon: '🌟',
          duration: 3000,
        });

        return authenticatedUser;
      } catch (error) {
        toast.error(error.message || 'Login failed. Please try again.', {
          duration: 4000,
        });
        throw error;
      }
    },
    []
  );

  /* ---- Logout ---- */
  const logout = useCallback(() => {
    const userName = user?.name || 'User';
    authService.clearSession();
    setUser(null);
    setIsAuthenticated(false);

    toast.success(`Goodbye, ${userName}. See you soon!`, {
      icon: '👋',
      duration: 3000,
    });

    navigate('/login');
  }, [user, navigate]);

  /* ---- Context value ---- */
  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom Hook                                                        */
/* ------------------------------------------------------------------ */

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}

export default AuthContext;
