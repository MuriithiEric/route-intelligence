import React, { useState } from 'react';

interface LoginPageProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
}

export default function LoginPage({ onSignIn, onSignUp }: LoginPageProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await onSignUp(email.trim(), password);
        setNotice('Account created! You can now sign in.');
        setMode('signin');
        setPassword('');
        setConfirm('');
      } else {
        await onSignIn(email.trim(), password);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 8,
    fontSize: 13,
    color: '#1E3A5F',
    fontFamily: 'Inter, system-ui, sans-serif',
    outline: 'none',
    background: '#F9FAFB',
    transition: 'border-color 0.15s',
  };

  return (
    <div
      style={{
        height: '100vh',
        background: 'linear-gradient(135deg, #1E3A5F 0%, #0F2240 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: 16,
      }}
    >
      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: '#1E3A5F',
            padding: '28px 32px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
              <path d="M3 14L9 4L15 14H3Z" fill="#C9963E" />
              <circle cx="9" cy="10" r="2" fill="white" />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: 1.2,
              }}
            >
              BIDCO Route Intelligence
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 2 }}>
              Kenya Field Operations
            </div>
          </div>
        </div>

        {/* Gold accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #C9963E, #E0B86A)' }} />

        {/* Form */}
        <div style={{ padding: '28px 32px 32px' }}>
          <div style={{ marginBottom: 20 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#1E3A5F',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {mode === 'signin' ? 'Sign in to your account' : 'Create an account'}
            </h2>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '6px 0 0', lineHeight: 1.5 }}>
              {mode === 'signin'
                ? 'Enter your credentials to access the dashboard.'
                : 'Set up access to the route intelligence dashboard.'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 12,
                color: '#DC2626',
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* Notice */}
          {notice && (
            <div
              style={{
                background: '#F0FDF4',
                border: '1px solid #86EFAC',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 12,
                color: '#15803D',
                marginBottom: 16,
              }}
            >
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@bidco.com"
                autoComplete="email"
                disabled={loading}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#1E3A5F')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: mode === 'signup' ? 14 : 20 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                disabled={loading}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#1E3A5F')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
              />
            </div>

            {/* Confirm password (signup only) */}
            {mode === 'signup' && (
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={loading}
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#1E3A5F')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
                />
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px',
                background: loading ? '#9CA3AF' : '#1E3A5F',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                letterSpacing: '0.03em',
                transition: 'background 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
                </>
              ) : (
                mode === 'signin' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            </span>
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setNotice(null); }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                color: '#C9963E',
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                padding: 0,
              }}
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
