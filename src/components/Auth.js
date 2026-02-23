import { useState } from 'react';
import { apiUrl } from '../services/mongoApi';
import './Auth.css';

function buildErrorDetail(url, res, text) {
  const status = res?.status ?? 'N/A';
  const contentType = res?.headers?.get?.('content-type') ?? 'unknown';
  const bodyPreview = (text ?? '').slice(0, 300);
  return `URL: ${url}\nStatus: ${status}\nContent-Type: ${contentType}\nBody: ${bodyPreview || '(empty)'}`;
}

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const name = username.trim().toLowerCase();
    const url = mode === 'create' ? apiUrl('/api/users') : apiUrl('/api/users/login');
    const body =
      mode === 'create'
        ? { username: name, password, email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim() }
        : { username: name, password };

    try {
      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (fetchErr) {
        throw new Error(`URL: ${url}\nFetch threw: ${fetchErr.message || 'Request failed'}`);
      }
      const text = await res.text();

      if (!res.ok) {
        let msg = buildErrorDetail(url, res, text);
        try {
          const j = JSON.parse(text);
          if (j?.error) msg = `${j.error}\n\n--- Debug ---\n${msg}`;
        } catch {}
        throw new Error(msg);
      }

      const data = text ? JSON.parse(text) : {};
      if (mode === 'create') {
        setError('');
        setMode('login');
        setPassword('');
        setEmail('');
        setFirstName('');
        setLastName('');
      } else {
        if (!data.ok)
          throw new Error(buildErrorDetail(url, res, text));
        onLogin({
          username: data.username,
          firstName: data.firstName ?? null,
          lastName: data.lastName ?? null,
        });
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Chat</h1>
          <p className="auth-subtitle">Yale · Modern</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
          {mode === 'create' && (
            <>
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
              />
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </>
          )}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
          />
          {error && (
        <p className="auth-error">
          {error}
          {error.includes('already exists') && ' Try logging in instead.'}
        </p>
      )}
          <button type="submit" disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'create' : 'login'));
            setError('');
          }}
        >
          {mode === 'login' ? 'Create an account' : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  );
}
