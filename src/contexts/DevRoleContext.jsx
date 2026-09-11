import {
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react';

import {
  DEV_ROLES,
  ROLE_PERMISSIONS,
} from '../config/permissions';

const STORAGE_KEY = 'altus-kairos-dev-role';

const DevRoleContext = createContext(null);

export function DevRoleProvider({ children }) {
  const [currentRole, setCurrentRole] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);

    return Object.values(DEV_ROLES).includes(stored)
      ? stored
      : DEV_ROLES.ADMIN;
  });

  const changeRole = (role) => {
    if (!Object.values(DEV_ROLES).includes(role)) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, role);
    setCurrentRole(role);
  };

  const permissions = ROLE_PERMISSIONS[currentRole] || [];

  const value = useMemo(
    () => ({
      currentRole,
      permissions,
      changeRole,

      hasPermission: (permission) =>
        permissions.includes(permission),

      hasAnyPermission: (required) =>
        required.some((permission) =>
          permissions.includes(permission)
        ),

      hasAllPermissions: (required) =>
        required.every((permission) =>
          permissions.includes(permission)
        ),
    }),
    [currentRole, permissions]
  );

  return (
    <DevRoleContext.Provider value={value}>
      {children}
    </DevRoleContext.Provider>
  );
}

export function useDevRole() {
  const context = useContext(DevRoleContext);

  if (!context) {
    throw new Error(
      'useDevRole must be used inside DevRoleProvider'
    );
  }

  return context;
}
