import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import splashLogo from '../assets/splash_screen_logo.jpeg';
import './Home.css';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/home', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const em = email.trim();
    if (!em || !password) {
      setError('Enter email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, em, password);
      navigate('/home', { replace: true });
    } catch (err) {
      const code = err?.code;
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Invalid email or password.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Try again later.');
      } else {
        setError(err?.message || 'Sign-in failed.');
      }
    } finally {
      setSubmitting(false);
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

  if (user) {
    return null;
  }

  return (
    <div className="home-container">
      <div className="home-card">
        <div className="home-brand">
          <img src={splashLogo} alt="" className="home-brand-logo" />
          <h1 className="home-title">VolleySync</h1>
        </div>
        <p className="home-subtitle">Sign in with your email</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className="home-input login-input-email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            disabled={submitting}
          />
          <label className="login-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            className="home-input login-input-email"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            disabled={submitting}
          />
          <button type="submit" className="home-btn home-btn-primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {error && <div className="home-error">{error}</div>}
      </div>
    </div>
  );
}
