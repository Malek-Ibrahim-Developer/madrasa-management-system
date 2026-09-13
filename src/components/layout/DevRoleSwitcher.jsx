import { useState, useRef, useEffect } from 'react';
import { MdAdminPanelSettings, MdExpandMore, MdCheck } from 'react-icons/md';
import { useDevRole } from '../../contexts/DevRoleContext';
import { DEV_ROLES } from '../../config/permissions';

const ROLE_LABELS = {
  [DEV_ROLES.ADMIN]: 'Admin',
  [DEV_ROLES.TEACHER]: 'Teacher',
  [DEV_ROLES.ACCOUNTANT]: 'Accountant',
  [DEV_ROLES.LIBRARIAN]: 'Librarian',
  [DEV_ROLES.HOSTEL_WARDEN]: 'Hostel Warden',
  [DEV_ROLES.KITCHEN_MANAGER]: 'Kitchen Manager',
  [DEV_ROLES.STAFF]: 'Staff',
};

export default function DevRoleSwitcher() {
  const { currentRole, changeRole } = useDevRole();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="dev-role-switcher" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="dev-role-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Switch Development Role Context"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'rgba(0, 152, 132, 0.08)',
          border: '1px solid rgba(0, 152, 132, 0.25)',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '500',
          color: '#007a67',
          transition: 'all 0.2s ease',
        }}
      >
        <MdAdminPanelSettings style={{ fontSize: '16px', color: '#009884' }} />
        <span style={{ color: '#6b7785', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Role:
        </span>
        <span style={{ fontWeight: '600', color: '#0f172a' }}>
          {ROLE_LABELS[currentRole] || currentRole}
        </span>
        <MdExpandMore style={{ fontSize: '16px', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
      </button>

      {isOpen && (
        <div
          className="dev-role-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '180px',
            background: '#ffffff',
            border: '1px solid #e3e8ec',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            padding: '6px',
            zIndex: 1000,
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            style={{
              padding: '6px 8px 4px',
              fontSize: '11px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: '#9ba5b0',
            }}
          >
            Simulate Role
          </div>
          {Object.entries(ROLE_LABELS).map(([roleKey, label]) => {
            const isSelected = currentRole === roleKey;
            return (
              <button
                key={roleKey}
                type="button"
                onClick={() => {
                  changeRole(roleKey);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isSelected ? 'rgba(0, 152, 132, 0.08)' : 'transparent',
                  color: isSelected ? '#009884' : '#364152',
                  fontSize: '13px',
                  fontWeight: isSelected ? '600' : '400',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = '#f8fafb';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span>{label}</span>
                {isSelected && <MdCheck style={{ fontSize: '15px', color: '#009884' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
