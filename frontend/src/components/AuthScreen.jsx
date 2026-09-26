import { useState } from 'react';

export default function AuthScreen({ onLogin, onSignup, loading, error }) {
  const [mode, setMode] = useState('login');

  function handleSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const username = form.get('username')?.toString().trim();
    const password = form.get('password')?.toString() ?? '';
    if (!username || !password) return;
    if (mode === 'login') onLogin(username, password);
    else onSignup(username, password);
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <p className="eyebrow">Real-world territory, real steps</p>
        <h1>STRIDEWARS</h1>
        <p className="tagline">
          {mode === 'login' ? 'Sign in to rejoin the field.' : 'Create a callsign to enlist.'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input name="username" placeholder="Callsign" maxLength={20} autoFocus autoComplete="username" />
          <input
            name="password"
            type="password"
            placeholder="Password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {error && <p className="auth-error">{error}</p>}

        <button
          type="button"
          className="link-button"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? "New here? Create an account" : 'Already enlisted? Sign in'}
        </button>
      </div>
    </div>
  );
}
