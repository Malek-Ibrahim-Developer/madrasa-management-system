import { useState, useRef, useEffect } from 'react';
import {
  MdSearch,
  MdNotifications,
  MdPerson,
  MdSettings,
  MdLogout,
  MdMenu,
} from 'react-icons/md';

// Temporary mock user — auth will be implemented later
const mockUser = {
  name: 'Ibrahim Malek',
  role: 'admin',
  email: 'admin@altuskairos.com',
};

export default function TopBar({ sidebarCollapsed, pageTitle, onMobileMenuToggle }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Get first letter for avatar
  const avatarLetter = mockUser.name.charAt(0).toUpperCase();

  return (
    <header
      className={`topbar${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}
    >
      {/* ── Left Side ── */}
      <div className="topbar-left">
        <button
          className="mobile-menu-btn"
          onClick={onMobileMenuToggle}
          aria-label="Toggle menu"
        >
          <MdMenu />
        </button>
        <h1 className="page-title">{pageTitle}</h1>
      </div>

      {/* ── Right Side ── */}
      <div className="topbar-right">
        {/* Search */}
        <div className="topbar-search">
          <span className="topbar-search-icon">
            <MdSearch />
          </span>
          <input
            type="text"
            placeholder="Search…"
            aria-label="Search"
          />
        </div>

        {/* Notifications */}
        <button className="topbar-btn" aria-label="Notifications">
          <MdNotifications />
          <span className="notification-badge" />
        </button>

        {/* User Profile */}
        <div
          className="topbar-user"
          ref={dropdownRef}
          onClick={() => setDropdownOpen((prev) => !prev)}
        >
          <div className="topbar-avatar">{avatarLetter}</div>
          <div className="topbar-user-info">
            <div className="topbar-user-name">
              {mockUser.name}
            </div>
            <div className="topbar-user-role">
              {mockUser.role}
            </div>
          </div>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="user-dropdown">
              <button
                className="dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen(false);
                }}
              >
                <MdPerson />
                Profile
              </button>
              <button
                className="dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen(false);
                }}
              >
                <MdSettings />
                Settings
              </button>
              <div className="dropdown-divider" />
              <button
                className="dropdown-item danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen(false);
                  // Logout will be implemented with auth later
                }}
              >
                <MdLogout />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
