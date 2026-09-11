import { Link } from 'react-router-dom';
import { MdHome } from 'react-icons/md';

function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        textAlign: 'center',
        animation: 'fadeIn 0.4s ease',
        padding: '2rem',
      }}
    >
      <div
        style={{
          fontSize: '8rem',
          fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          background: 'linear-gradient(135deg, #009884, #34d399)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          lineHeight: 1,
          marginBottom: '0.5rem',
        }}
      >
        404
      </div>
      <h2
        style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          color: '#111827',
          margin: '0 0 0.5rem',
        }}
      >
        Page Not Found
      </h2>
      <p
        style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          maxWidth: '360px',
          lineHeight: 1.6,
          marginBottom: '1.5rem',
        }}
      >
        The page you're looking for doesn't exist or has been moved. Let's get you back on track.
      </p>
      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 24px',
          background: 'linear-gradient(135deg, #009884, #007a6a)',
          color: '#ffffff',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
          transition: 'all 0.25s ease',
          boxShadow: '0 4px 6px -1px rgba(0,152,132,0.3)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 15px -3px rgba(0,152,132,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,152,132,0.3)';
        }}
      >
        <MdHome size={18} />
        Back to Dashboard
      </Link>
    </div>
  );
}

export default NotFound;
