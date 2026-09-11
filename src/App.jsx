/**
 * App.jsx — Root application component with routing
 * Altus Kairos — Madrasa Management System
 * 
 * NOTE: Auth/login is bypassed for now — will be implemented in depth later.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentProfile from './pages/StudentProfile';
import CustomFieldsManager from './pages/CustomFieldsManager';
import Courses from './pages/Courses';
import Attendance from './pages/Attendance';
import NotFound from './pages/NotFound';

/* Import global styles */
import './styles/globals.css';
import './styles/layout.css';

export default function App() {
  return (
    <BrowserRouter>
      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1e293b',
            color: '#f1f4f6',
            borderRadius: '10px',
            fontSize: '14px',
            fontFamily: "'Inter', sans-serif",
            padding: '12px 16px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#f1f4f6',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#f1f4f6',
            },
          },
        }}
      />

      <Routes>
        {/* Main app layout — no auth required for now */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />

          {/* Active Modules */}
          <Route path="/students" element={<Students />} />
          <Route path="/students/custom-fields" element={<CustomFieldsManager />} />
          <Route path="/students/:id" element={<StudentProfile />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/attendance" element={<Attendance />} />

          {/* Placeholder routes for future modules */}
          <Route path="/exams" element={<ComingSoon title="Exams & Results" />} />
          <Route path="/accounts" element={<ComingSoon title="Accounts" />} />
          <Route path="/fees" element={<ComingSoon title="Fees & Stipends" />} />
          <Route path="/salary" element={<ComingSoon title="Salary Management" />} />
          <Route path="/library" element={<ComingSoon title="Library" />} />
          <Route path="/kitchen" element={<ComingSoon title="Kitchen" />} />
          <Route path="/hostel" element={<ComingSoon title="Hostel" />} />
          <Route path="/settings" element={<ComingSoon title="Settings" />} />
        </Route>

        {/* Catch-all */}
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * Temporary placeholder for modules not yet built.
 */
function ComingSoon({ title }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '16px',
      animation: 'fadeInUp 0.5s ease',
    }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '20px',
        background: 'linear-gradient(135deg, rgba(0,152,132,0.08), rgba(0,152,132,0.04))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '36px',
      }}>
        🚧
      </div>
      <h2 style={{
        fontSize: '24px',
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: '-0.5px',
      }}>
        {title}
      </h2>
      <p style={{
        fontSize: '14px',
        color: '#6b7785',
        maxWidth: '360px',
        textAlign: 'center',
        lineHeight: '1.6',
      }}>
        This module is coming soon in the next phase. Stay tuned for updates!
      </p>
      <div style={{
        marginTop: '8px',
        padding: '6px 16px',
        borderRadius: '9999px',
        background: 'rgba(0,152,132,0.06)',
        color: '#009884',
        fontSize: '12px',
        fontWeight: '600',
        letterSpacing: '0.5px',
      }}>
        COMING SOON
      </div>
    </div>
  );
}
