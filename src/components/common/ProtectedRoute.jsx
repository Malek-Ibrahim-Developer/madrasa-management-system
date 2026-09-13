/**
 * ProtectedRoute — Phase 2A
 * Guards routes behind permission and module checks.
 * 
 * In development: Uses DevRoleContext for permission checks
 * In production (future): Uses AuthContext for authentication + permissions
 */

import { Navigate } from 'react-router-dom';
import { useDevRole } from '../../contexts/DevRoleContext';
import { useInstitution } from '../../contexts/InstitutionContext';

/**
 * @param {Object} props
 * @param {string} [props.permission] - Required permission code (e.g. 'settings.view')
 * @param {string} [props.module] - Required module flag (e.g. 'studentsEnabled')
 * @param {string} [props.redirectTo] - Where to redirect on denial (default: '/')
 * @param {React.ReactNode} props.children
 */
function ProtectedRoute({ permission, module, redirectTo = '/', children }) {
  const { hasPermission } = useDevRole();
  const { configuration, loading } = useInstitution();

  // Show nothing while loading configuration
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: '#9ba5b0',
        fontSize: '14px',
      }}>
        Loading...
      </div>
    );
  }

  // Check permission
  if (permission && !hasPermission(permission)) {
    return <Navigate to={redirectTo} replace />;
  }

  // Check module
  if (module && configuration?.[module] === false) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

export default ProtectedRoute;
