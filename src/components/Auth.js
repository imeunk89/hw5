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

    const doFetch = async () => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const t = await r.text();
      return { res: r, text: t };
    };

    try {
      let res, text;
      try {
        ({ res, text } = await doFetch());
      } catch (fetchErr) {
        throw new Error(`URL: ${url}\nFetch threw: ${fetchErr.message || 'Request failed'}`);
      }

      // Retry once if 200 with empty body (Render cold start)
      if (res.ok && !(text ?? '').trim()) {
        await new Promise((r) => setTimeout(r, 2500));
        try {
          ({ res, text } = await doFetch());
        } catch {}
      }

      if (!res.ok) {
        let msg = buildErrorDetail(url, res, text);
        try {
          const j = JSON.parse(text);
          if (j?.error) msg = `${j.error}\n\n--- Debug ---\n${msg}`;
        } catch {}
        throw new Error(msg);
      }

      if ((text ?? '').trim().startsWith('<')) {
        throw new Error(
          `백엔드 URL이 잘못되었습니다. HTML이 반환되었습니다.\nURL: ${url}\nREACT_APP_API_URL이 실제 백엔드 주소를 가리키는지 확인하세요.`
        );
      }
      const data = (text ?? '').trim() ? JSON.parse(text) : {};
      if (mode === 'create') {
        setError('');
        setMode('login');
        setPassword('');
        setEmail('');
        setFirstName('');
        setLastName('');
      } else {
        if (!data.ok) {
          const detail = buildErrorDetail(url, res, text);
          const hint =
            res.ok && !(text ?? '').trim()
              ? '\n\n백엔드가 응답을 보내지 않았습니다. Render 무료 티어는 15분 비활성 후 슬립됩니다. 잠시 후 다시 시도하거나, 백엔드 URL(REACT_APP_API_URL)을 확인하세요.'
              : '';
          throw new Error(detail + hint);
        }
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
