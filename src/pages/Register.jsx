import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import './Home.css';
import './Register.css';

export default function Register() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    const displayName = name.trim();
    const em = email.trim();
    if (!displayName) {
      setError('Enter your name.');
      return;
    }
    if (!em || password.length < 6) {
      setError('Valid email and password (at least 6 characters) are required.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, em, password);
      await updateProfile(newUser, { displayName });
      navigate('/home', { replace: true });
    } catch (err) {
      const code = err?.code;
      if (code === 'auth/email-already-in-use') {
        setError('That email is already registered.');
      } else if (code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak.');
      } else {
        setError(err?.message || 'Registration failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setError('');
    try {
      await signOut(auth);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.message || 'Sign out failed.');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="home-container">
        <div className="home-loading">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="home-card register-card">
        <h1 className="home-title">Create account</h1>
        <p className="home-subtitle">Register with your name, email, and password</p>

        {user ? (
          <div className="register-signed-in">
            <p className="register-email-line">
              Signed in as <strong>{user.displayName || user.email}</strong>
            </p>
            <button
              type="button"
              className="home-btn home-btn-secondary"
              onClick={handleSignOut}
              disabled={busy}
            >
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
            <Link className="register-back-link" to="/home">
              Continue to app
            </Link>
          </div>
        ) : (
          <>
            <form className="register-form" onSubmit={handleRegister}>
              <label className="login-label" htmlFor="reg-name">Name</label>
              <input
                id="reg-name"
                type="text"
                className="home-input login-input-email"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
              <label className="login-label" htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                className="home-input login-input-email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
              <label className="login-label" htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                className="home-input login-input-email"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
              <label className="login-label" htmlFor="reg-confirm">Confirm password</label>
              <input
                id="reg-confirm"
                type="password"
                className="home-input login-input-email"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
              />
              <button type="submit" className="home-btn home-btn-primary" disabled={busy}>
                {busy ? 'Creating…' : 'Create account'}
              </button>
            </form>
            {error && <div className="home-error">{error}</div>}
            <Link className="register-back-link" to="/">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
