import { useState, useEffect } from 'react';
import { AuthUser } from '../types/pump';
import { authService } from '../services/authService';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(authService.getCurrentUser());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = authService.subscribe((newUser) => {
      setUser(newUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login: (e: string, p: string) => authService.login(e, p),
    signUp: (e: string, p: string) => authService.signUp(e, p),
    loginAsDemo: () => authService.loginAsDemo(),
    logout: () => authService.logout(),
  };
}
