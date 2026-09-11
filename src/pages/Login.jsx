import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  MdEmail,
  MdLock,
  MdVisibility,
  MdVisibilityOff,
  MdSchool,
  MdErrorOutline,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import '../styles/login.css';

const Login = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email, password, rememberMe);
      toast.success('Welcome back! Logged in successfully.', {
        icon: '👋',
        duration: 3000,
      });
      navigate('/', { replace: true });
    } catch (err) {
      const message = err?.message || 'Invalid credentials. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render login page if user is already authenticated
  if (user) {
    return null;
  }

  return (
    <div className="login-page">
      {/* Background Effects */}
      <div className="login-bg-pattern" />
      <div className="login-orb" />
      <div className="login-orb" />
      <div className="login-orb" />

      {/* Login Card */}
      <div className="login-container">
        <div className="login-card">
          {/* Brand */}
          <div className="login-brand">
            <div className="login-brand-icon">
              <MdSchool />
            </div>
            <h1>Altus Kairos</h1>
            <p>Madrasa Management System</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="login-error">
              <MdErrorOutline size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div className="form-group">
              <label htmlFor="login-email">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <MdEmail />
                </span>
                <input
                  id="login-email"
                  type="email"
                  placeholder="admin@altuskairos.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <MdLock />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="has-toggle"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
            </div>

            {/* Options Row */}
            <div className="form-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
              <a href="#" className="forgot-password">
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="login-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="btn-spinner" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="login-demo-credentials">
            <h4>Demo Credentials</h4>
            <div className="demo-cred">
              <span>Email</span>
              <span>admin@altuskairos.com</span>
            </div>
            <div className="demo-cred">
              <span>Password</span>
              <span>admin123</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          © 2024 Altus Kairos. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Login;
