'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@/lib/types';
import { getSettings, getUsers, simpleHash, addActivityLog } from '@/lib/store';

interface AuthContextType {
  user: User | null;
  login: (id: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  isAdmin: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => ({ ok: false }),
  logout: () => {},
  isAdmin: false,
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      // Restore session from sessionStorage with safety check for mobil/incognito
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const stored = sessionStorage.getItem('re_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id) setUser(parsed);
        }
      }
    } catch (e) {
      console.warn('Storage blocked or failed', e);
    } finally {
      // Always set loading to false, even if storage failed
      setIsLoading(false);
    }
  }, []);

  const login = (id: string, password: string): { ok: boolean; error?: string } => {
    const settings = getSettings();
    const hash = simpleHash(password);

    // Admin login
    if (id.toUpperCase() === settings.adminUsername.toUpperCase()) {
      if (hash !== settings.adminPasswordHash) {
        return { ok: false, error: 'Invalid password' };
      }
      const adminUser: User = {
        id: 'ADMIN',
        name: 'Admin',
        role: 'admin',
        passwordHash: '',
        active: true,
        createdAt: '',
        lastLogin: new Date().toISOString(),
      };
      setUser(adminUser);
      sessionStorage.setItem('re_session', JSON.stringify(adminUser));
      addActivityLog({ staffId: 'ADMIN', staffName: 'Admin', action: 'LOGIN' });
      return { ok: true };
    }

    // Employee login
    const users = getUsers();
    const found = users.find(u => u.id.toUpperCase() === id.toUpperCase());
    if (!found) {
      return { ok: false, error: 'Employee ID not found' };
    }
    if (!found.active) {
      return { ok: false, error: 'Account is deactivated. Contact admin.' };
    }
    if (hash !== found.passwordHash) {
      return { ok: false, error: 'Invalid password' };
    }

    // Update last login
    const allUsers = getUsers();
    const idx = allUsers.findIndex(u => u.id === found.id);
    if (idx !== -1) {
      allUsers[idx].lastLogin = new Date().toISOString();
      import('@/lib/store').then(({ saveUsers }) => saveUsers(allUsers));
    }

    setUser(found);
    sessionStorage.setItem('re_session', JSON.stringify(found));
    addActivityLog({ staffId: found.id, staffName: found.name, action: 'LOGIN' });
    return { ok: true };
  };

  const logout = () => {
    if (user) {
      addActivityLog({ staffId: user.id, staffName: user.name, action: 'LOGOUT' });
    }
    setUser(null);
    sessionStorage.removeItem('re_session');
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAdmin: user?.role === 'admin',
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
