'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ensureSeeded } from '@/lib/store';

export default function LoginPage() {
  const { login } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  ensureSeeded();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !password.trim()) {
      setError('Enter both ID and Password');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      const result = await login(id.trim(), password);
      // login handles the redirection/state on success
      if (!result.ok) {
        setError(result.error || 'Invalid credentials');
        setLoading(false);
      }
    } catch (err: any) {
      setError('Login connection error');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top left, #eff6ff, transparent), #f8fafc',
      padding: '20px',
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div style={{ 
            width: '54px', height: '54px', borderRadius: '12px', background: '#fff', 
            boxShadow: '0 8px 20px rgba(0,0,0,0.08)', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #eee'
          }}>
            <img src="/logo.png" alt="Raj Electronics" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#2563eb', lineHeight: 1 }}>RAJ ELECTRONICS</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginTop: '4px', letterSpacing: '0.05em' }}>STOCK TRACKER PRO</div>
          </div>
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '8px', marginTop: 0 }}>Welcome Back</h1>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px', fontWeight: 500, lineHeight: 1.5 }}>Sign in with your professional Employee ID to access the inventory system.</p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User ID / Employee ID</label>
              <input
                style={{ width: '100%', padding: '18px 22px', border: '2.5px solid #e2e8f0', borderRadius: '16px', fontSize: '18px', fontWeight: 700, outline: 'none', background: '#f8fafc' }}
                type="text"
                placeholder="RE-2025-XXXX"
                value={id}
                onChange={e => { setId(e.target.value.toUpperCase()); setError(''); }}
                autoFocus
                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Secure Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ width: '100%', padding: '18px 22px', paddingRight: '54px', border: '2.5px solid #e2e8f0', borderRadius: '16px', fontSize: '18px', fontWeight: 700, outline: 'none', background: '#f8fafc' }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: 0
                  }}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ 
                background: '#fef2f2', border: '1px solid #fecaca', 
                borderRadius: '12px', padding: '12px 16px', color: '#dc2626', 
                fontSize: '13px', fontWeight: 800, textAlign: 'center' 
              }}>
                🚨 {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ padding: '20px', fontSize: '16px', fontWeight: 900, background: '#2563eb', color: '#fff', border: 'none', borderRadius: '16px', cursor: 'pointer', boxShadow: '0 10px 25px rgba(37, 99, 235, 0.4)' }}
            >
              {loading ? 'Authenticating...' : 'Sign In Now →'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '11px', color: '#64748b', opacity: 0.6 }}>
          Controlled Access System. Unauthorized attempts are logged.<br/>
          Default: [ADMIN / admin123]
        </div>
      </div>
    </div>
  );
}
