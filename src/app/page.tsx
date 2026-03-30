'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';

// Dynamically import everything to completely isolate the boot process
const NewLogin = dynamic(() => import('@/components/NewLogin'), { ssr: false });
const AppShell = dynamic(() => import('@/components/AppShell'), { ssr: false });

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Use a second "mounted" check to bypass any hydration hangs on mobile browsers
  useEffect(() => {
    setMounted(true);
  }, []);

  // Show the loader only while truly in an unknown state
  if (!mounted || authLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0f172a'
      }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💎 Initializing...</div>
          <div style={{ fontSize: 13, opacity: 0.6 }}>Booting system core...</div>
        </div>
      </div>
    );
  }

  // Once mounted and auth resolved, switch components
  if (!user) {
    return <NewLogin />;
  }

  return <AppShell />;
}
