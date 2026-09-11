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
import { useDevRole } from '../../context/DevRoleContext';
import { useInstitution } from '../../context/InstitutionContext';
import { PERMISSIONS } from '../../config/permissions';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      {
        icon: MdDashboard,
        label: 'Dashboard',
        path: '/',
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
    ],
  },
  {
    title: 'Academics',
    items: [
      {
        icon: MdPeople,
        label: 'Students',
        path: '/students',
        end: true,
        permission: PERMISSIONS.STUDENTS_VIEW,
        module: 'studentsEnabled',
      },
      {
        icon: MdTune,
        label: 'Student Fields',
        path: '/students/custom-fields',
        permission: PERMISSIONS.STUDENTS_EDIT,
        module: 'studentsEnabled',
      },
      {
        icon: MdMenuBook,
        label: 'Courses',
        path: '/courses',
        permission: PERMISSIONS.COURSES_VIEW,
        module: 'coursesEnabled',
      },
      {
        icon: MdFactCheck,
        label: 'Attendance',
        path: '/attendance',
        permission: PERMISSIONS.ATTENDANCE_VIEW,
        module: 'attendanceEnabled',
      },
      {
        icon: MdAssignment,
        label: 'Exams',
        path: '/exams',
        permission: PERMISSIONS.EXAMS_VIEW,
        module: 'examsEnabled',
      },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        icon: MdAccountBalance,
        label: 'Accounts',
        path: '/accounts',
        permission: PERMISSIONS.ACCOUNTS_VIEW,
        module: 'accountsEnabled',
      },
      {
        icon: MdReceipt,
        label: 'Fees',
        path: '/fees',
        permission: PERMISSIONS.FEES_VIEW,
        module: 'feesEnabled',
      },
      {
        icon: MdPayments,
        label: 'Salary',
        path: '/salary',
        permission: PERMISSIONS.SALARY_VIEW,
        module: 'salaryEnabled',
      },
    ],
  },
  {
    title: 'Resources',
    items: [
      {
        icon: MdLocalLibrary,
        label: 'Library',
        path: '/library',
        permission: PERMISSIONS.LIBRARY_VIEW,
        module: 'libraryEnabled',
      },
      {
        icon: MdRestaurant,
        label: 'Kitchen',
        path: '/kitchen',
        permission: PERMISSIONS.KITCHEN_VIEW,
        module: 'kitchenEnabled',
      },
      {
        icon: MdApartment,
        label: 'Hostel',
        path: '/hostel',
        permission: PERMISSIONS.HOSTEL_VIEW,
        module: 'hostelEnabled',
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        icon: MdSettings,
        label: 'Settings',
        path: '/settings',
        permission: PERMISSIONS.SETTINGS_VIEW,
      },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();
  const { hasPermission } = useDevRole();
  const { configuration } = useInstitution();

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [location.pathname]);

  // Dynamic permission and module filtering
  const visibleSections = NAV_SECTIONS
    .map((section) => {
      const visibleItems = section.items.filter((item) => {
        const permissionAllowed =
          !item.permission || hasPermission(item.permission);

        const moduleAllowed =
          !item.module || configuration?.[item.module] !== false;

        return permissionAllowed && moduleAllowed;
      });

      return {
        ...section,
        items: visibleItems,
      };
    })
    .filter((section) => section.items.length > 0);

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
        {visibleSections.map((section) => (
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
