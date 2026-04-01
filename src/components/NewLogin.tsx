'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ensureSeeded } from '@/lib/store';

export default function NewLogin() {
  const { login } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  ensureSeeded();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if(!id || !password) return setError('Missing ID or Password');
    setLoading(true);
    const res = login(id, password);
    if (!res.ok) { setError(res.error || 'Login Failed'); setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: 24, fontFamily: 'system-ui' }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#1e293b', border: '1px solid #334155', padding: 40, borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, backgroundColor: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="/logo.png" style={{ width: '80%' }} alt="L" />
          </div>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: -1 }}>RAJ ELECTRONICS</span>
        </div>
        
        <h2 style={{ color: '#fff', marginBottom: 8, fontSize: 28, fontWeight: 800 }}>Sign In</h2>
        <p style={{ color: '#94a3b8', marginBottom: 32, fontSize: 14 }}>Enter your system ID to begin tracking.</p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <label style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Login ID / Username</label>
            <input value={id} onChange={e => setId(e.target.value.toUpperCase())} placeholder="ID or Username..." style={{ width: '100%', padding: 16, background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: 12, outline: 'none', fontSize: 16 }} />
          </div>
          <div>
            <label style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: 16, background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: 12, outline: 'none', fontSize: 16 }} />
          </div>
          {error && <div style={{ color: '#f87171', fontSize: 13, fontWeight: 700 }}>⚠️ {error}</div>}
          <button disabled={loading} style={{ width: '100%', padding: 18, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
            {loading ? 'Verifying...' : 'Unlock Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}
