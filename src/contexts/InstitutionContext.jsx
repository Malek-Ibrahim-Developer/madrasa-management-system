import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getInstitutionProfile, getInstitutionConfiguration } from '../services/api';

const DEFAULT_CONFIGURATION = {
  studentsEnabled: true,
  coursesEnabled: true,
  attendanceEnabled: true,
  examsEnabled: true,
  feesEnabled: false,
  accountsEnabled: false,
  salaryEnabled: false,
  libraryEnabled: false,
  hostelEnabled: false,
  kitchenEnabled: false,
  requireAcademicYear: true,
  allowMultipleSections: true,
  allowAttendanceEdit: true,
  attendanceLockDays: 7,
};

const InstitutionContext = createContext(null);

export function InstitutionProvider({ children }) {
  const [institution, setInstitution] = useState(null);
  const [configuration, setConfiguration] = useState(DEFAULT_CONFIGURATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshConfiguration = async () => {
    setLoading(true);
    setError(null);

    try {
      const [profileRes, configRes] = await Promise.allSettled([
        getInstitutionProfile(),
        getInstitutionConfiguration(),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value) {
        setInstitution(profileRes.value.data || profileRes.value);
      }

      if (configRes.status === 'fulfilled' && configRes.value) {
        const configData = configRes.value.data || configRes.value;
        setConfiguration((prev) => ({ ...prev, ...configData }));
      } else if (configRes.status === 'rejected') {
        setError(configRes.reason);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshConfiguration();
  }, []);

  const value = useMemo(
    () => ({
      institution,
      configuration,
      loading,
      error,
      refreshConfiguration,
      hasModule: (key) => configuration?.[key] === true,
    }),
    [institution, configuration, loading, error]
  );

  return (
    <InstitutionContext.Provider value={value}>
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution() {
  const context = useContext(InstitutionContext);

  if (!context) {
    throw new Error(
      'useInstitution must be used inside InstitutionProvider'
    );
  }

  return context;
}
