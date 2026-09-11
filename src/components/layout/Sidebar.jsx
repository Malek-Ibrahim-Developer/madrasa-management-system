import { NavLink, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import {
  MdDashboard,
  MdPeople,
  MdMenuBook,
  MdFactCheck,
  MdAssignment,
  MdAccountBalance,
  MdReceipt,
  MdPayments,
  MdLocalLibrary,
  MdRestaurant,
  MdApartment,
  MdSettings,
  MdSchool,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdTune,
} from 'react-icons/md';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { icon: MdDashboard, label: 'Dashboard', path: '/' },
    ],
  },
  {
    title: 'Academics',
    items: [
      { icon: MdPeople, label: 'Students', path: '/students', end: true },
      { icon: MdTune, label: 'Student Fields', path: '/students/custom-fields' },
      { icon: MdMenuBook, label: 'Courses', path: '/courses' },
      { icon: MdFactCheck, label: 'Attendance', path: '/attendance' },
      { icon: MdAssignment, label: 'Exams', path: '/exams' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { icon: MdAccountBalance, label: 'Accounts', path: '/accounts' },
      { icon: MdReceipt, label: 'Fees', path: '/fees' },
      { icon: MdPayments, label: 'Salary', path: '/salary' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { icon: MdLocalLibrary, label: 'Library', path: '/library' },
      { icon: MdRestaurant, label: 'Kitchen', path: '/kitchen' },
      { icon: MdApartment, label: 'Hostel', path: '/hostel' },
    ],
  },
  {
    title: 'System',
    items: [
      { icon: MdSettings, label: 'Settings', path: '/settings' },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [location.pathname]);

  const classes = [
    'sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className={classes}>
      {/* ── Brand ── */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <MdSchool />
        </div>
        <div className="sidebar-brand">
          <h2>Altus Kairos</h2>
          <span>Madrasa Management</span>
        </div>
        {/* Mobile close button */}
        {mobileOpen && (
          <button
            className="sidebar-mobile-close"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <MdClose />
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div className="nav-section" key={section.title}>
            <div className="nav-section-title">{section.title}</div>

            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/' || item.end === true}
                  className={({ isActive }) =>
                    `nav-item${isActive ? ' active' : ''}`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <span className="nav-item-icon">
                    <Icon />
                  </span>
                  <span className="nav-item-label">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer Toggle (desktop only) ── */}
      <div className="sidebar-footer">
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <MdChevronRight /> : <MdChevronLeft />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
