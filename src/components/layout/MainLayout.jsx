import { useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

/**
 * Derive a human-readable page title from the current pathname.
 * '/'         → 'Dashboard'
 * '/students' → 'Students'
 * '/fees'     → 'Fees'
 */
function getPageTitle(pathname) {
  if (pathname === '/') return 'Dashboard';

  const segment = pathname.split('/').filter(Boolean)[0] || '';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const pageTitle = getPageTitle(location.pathname);

  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleMobileMenuToggle = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const handleOverlayClick = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${mobileOpen ? ' visible' : ''}`}
        onClick={handleOverlayClick}
      />

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
      />

      {/* Main area */}
      <div
        className={`main-wrapper${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}
      >
        <TopBar
          sidebarCollapsed={sidebarCollapsed}
          pageTitle={pageTitle}
          onMobileMenuToggle={handleMobileMenuToggle}
        />

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
