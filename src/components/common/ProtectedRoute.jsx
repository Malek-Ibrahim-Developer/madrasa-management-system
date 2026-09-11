/**
 * ProtectedRoute — guards routes behind authentication
 * Shows a branded full-screen loader while auth state is resolving.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/* ------------------------------------------------------------------ */
/*  Inline Styles                                                      */
/* ------------------------------------------------------------------ */

const styles = {
  loaderWrapper: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #064e3b 0%, #0d9488 50%, #065f46 100%)',
    zIndex: 9999,
  },

  spinnerRing: {
    width: 56,
    height: 56,
    border: '4px solid rgba(255, 255, 255, 0.15)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'ak-spin 0.8s linear infinite',
  },

  brandText: {
    marginTop: 24,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 22,
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '0.5px',
    textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  },

  subtitle: {
    marginTop: 8,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 13,
    fontWeight: 400,
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },

  glassCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '48px 56px',
    borderRadius: 20,
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.15)',
  },
};

/* ------------------------------------------------------------------ */
/*  Keyframe injection (runs once)                                     */
/* ------------------------------------------------------------------ */

const KEYFRAME_ID = 'ak-protected-route-keyframes';

function injectKeyframes() {
  if (document.getElementById(KEYFRAME_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = KEYFRAME_ID;
  styleEl.textContent = `
    @keyframes ak-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes ak-pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(styleEl);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    injectKeyframes();

    return (
      <div style={styles.loaderWrapper}>
        <div style={styles.glassCard}>
          <div style={styles.spinnerRing} />
          <div style={styles.brandText}>Altus Kairos</div>
          <div style={{ ...styles.subtitle, animation: 'ak-pulse 2s ease-in-out infinite' }}>
            Madrasa Management System
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
