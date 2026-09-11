import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  MdSchool,
  MdViewModule,
  MdRule,
  MdSave,
  MdCheckCircle,
  MdError,
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
  MdAccessTime,
} from 'react-icons/md';

import { useInstitution } from '../../context/InstitutionContext';
import {
  getInstitutionProfile,
  updateInstitutionProfile,
  updateInstitutionConfiguration,
} from '../../services/api';

import '../../styles/settings.css';

export default function InstitutionSettings() {
  const { configuration, refreshConfiguration } = useInstitution();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // { type: 'success'|'error', message: string }

  // Form states
  const [profile, setProfile] = useState({
    name: 'Darul Uloom Altus Kairos',
    code: 'ALTUS-MAIN',
    description: '',
    phone: '',
    email: '',
    address: '',
    logoUrl: '',
  });

  const [config, setConfig] = useState({
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
  });

  // Load initial data
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const profileRes = await getInstitutionProfile();
        if (isMounted && profileRes?.data) {
          setProfile((prev) => ({ ...prev, ...profileRes.data }));
        }
      } catch (err) {
        console.warn('Could not load institution profile from backend:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync config from context once loaded
  useEffect(() => {
    if (configuration) {
      setConfig((prev) => ({
        ...prev,
        ...configuration,
      }));
    }
  }, [configuration]);

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setSaveStatus(null);
  };

  const handleToggleModule = (key) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaveStatus(null);
  };

  const handleConfigChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setSaveStatus(null);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setSaveStatus(null);

    try {
      // Client validation
      const lockDays = parseInt(config.attendanceLockDays, 10);
      if (isNaN(lockDays) || lockDays < 0 || lockDays > 365) {
        throw new Error('Attendance lock days must be an integer between 0 and 365');
      }

      if (!profile.name || profile.name.trim().length === 0) {
        throw new Error('Institution name is required');
      }

      const cleanConfig = {
        ...config,
        attendanceLockDays: lockDays,
      };

      // Execute updates
      await Promise.all([
        updateInstitutionConfiguration(cleanConfig),
        updateInstitutionProfile({
          name: profile.name.trim(),
          description: profile.description || null,
          phone: profile.phone || null,
          email: profile.email || null,
          address: profile.address || null,
          logoUrl: profile.logoUrl || null,
        }),
      ]);

      // Refresh shared context
      await refreshConfiguration();

      setSaveStatus({
        type: 'success',
        message: 'Institution settings and module configurations saved successfully!',
      });
      toast.success('Configuration saved');
    } catch (err) {
      const errorMsg = err.message || 'Failed to save configuration';
      setSaveStatus({
        type: 'error',
        message: errorMsg,
      });
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const modulesList = [
    { key: 'studentsEnabled', label: 'Students Module', desc: 'Admissions, profiles, enrollments, and custom fields', icon: MdPeople },
    { key: 'coursesEnabled', label: 'Courses Module', desc: 'Classes, curriculum, course terms, and syllabus', icon: MdMenuBook },
    { key: 'attendanceEnabled', label: 'Attendance Module', desc: 'Daily class attendance, marking, and statistics', icon: MdFactCheck },
    { key: 'examsEnabled', label: 'Exams Module', desc: 'Exam schedules, hall tickets, mark entries, and grading', icon: MdAssignment },
    { key: 'feesEnabled', label: 'Fees Module', desc: 'Fee structures, vouchers, collection, and receipts', icon: MdReceipt },
    { key: 'accountsEnabled', label: 'Accounts Module', desc: 'General ledger, expenses, cashbooks, and balances', icon: MdAccountBalance },
    { key: 'salaryEnabled', label: 'Salary Module', desc: 'Staff payroll, allowances, deductions, and payslips', icon: MdPayments },
    { key: 'libraryEnabled', label: 'Library Module', desc: 'Book catalog, book issue/return, and cataloging', icon: MdLocalLibrary },
    { key: 'hostelEnabled', label: 'Hostel Module', desc: 'Dormitories, bed allocations, and maintenance', icon: MdApartment },
    { key: 'kitchenEnabled', label: 'Kitchen Module', desc: 'Mess inventory, meal logs, and daily food items', icon: MdRestaurant },
  ];

  return (
    <div className="settings-page">
      {/* ── Header ── */}
      <div className="settings-header">
        <div className="settings-header-title">
          <h1>Institution Settings</h1>
          <p>Configure institution profile, enable or disable core modules, and set academic policies.</p>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            <MdSave style={{ fontSize: '18px' }} />
            <span>{saving ? 'Saving Changes…' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* ── Status Feedback Banner ── */}
      {saveStatus && (
        <div className={`settings-alert ${saveStatus.type}`}>
          {saveStatus.type === 'success' ? (
            <MdCheckCircle style={{ fontSize: '20px' }} />
          ) : (
            <MdError style={{ fontSize: '20px' }} />
          )}
          <span>{saveStatus.message}</span>
        </div>
      )}

      {/* ── 1. Institution Profile Card ── */}
      <div className="settings-section-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <MdSchool />
          </div>
          <div className="settings-card-title">
            <h2>Institution Profile</h2>
            <p>Official identity and contact information for this institution</p>
          </div>
        </div>

        <div className="form-grid-2">
          <div className="settings-field-group">
            <label>Institution Name *</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => handleProfileChange('name', e.target.value)}
              placeholder="e.g. Darul Uloom Altus Kairos"
              disabled={loading || saving}
            />
          </div>

          <div className="settings-field-group">
            <label>Institution Code (Permanent ID)</label>
            <input
              type="text"
              value={profile.code}
              disabled
              title="Institution Code cannot be modified"
            />
            <span className="field-hint">Permanent unique system identifier</span>
          </div>

          <div className="settings-field-group">
            <label>Official Phone</label>
            <input
              type="text"
              value={profile.phone || ''}
              onChange={(e) => handleProfileChange('phone', e.target.value)}
              placeholder="+91 9876543210"
              disabled={loading || saving}
            />
          </div>

          <div className="settings-field-group">
            <label>Official Email</label>
            <input
              type="email"
              value={profile.email || ''}
              onChange={(e) => handleProfileChange('email', e.target.value)}
              placeholder="admin@institution.edu"
              disabled={loading || saving}
            />
          </div>

          <div className="settings-field-group form-grid-full">
            <label>Campus Address</label>
            <textarea
              rows={2}
              value={profile.address || ''}
              onChange={(e) => handleProfileChange('address', e.target.value)}
              placeholder="Physical campus address..."
              disabled={loading || saving}
            />
          </div>

          <div className="settings-field-group form-grid-full">
            <label>Description / Seminary Focus</label>
            <textarea
              rows={2}
              value={profile.description || ''}
              onChange={(e) => handleProfileChange('description', e.target.value)}
              placeholder="Brief overview of the institution..."
              disabled={loading || saving}
            />
          </div>
        </div>
      </div>

      {/* ── 2. Module Availability Switches Card ── */}
      <div className="settings-section-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <MdViewModule />
          </div>
          <div className="settings-card-title">
            <h2>Module Availability Switches</h2>
            <p>Control which modules are active. Disabled modules are removed from navigation across all roles.</p>
          </div>
        </div>

        <div className="module-grid">
          {modulesList.map((m) => {
            const Icon = m.icon;
            const isEnabled = config[m.key] === true;

            return (
              <div className="module-card" key={m.key}>
                <div className="module-info">
                  <div className="module-icon">
                    <Icon />
                  </div>
                  <div className="module-text">
                    <h3>{m.label}</h3>
                    <p>{m.desc}</p>
                  </div>
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => handleToggleModule(m.key)}
                    disabled={saving}
                  />
                  <span className="slider" />
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. Academic & Attendance Rules Card ── */}
      <div className="settings-section-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <MdRule />
          </div>
          <div className="settings-card-title">
            <h2>Academic & Attendance Rules</h2>
            <p>Institutional integrity rules governing academic years and attendance recording policies</p>
          </div>
        </div>

        <div className="rule-list">
          {/* Require Academic Year */}
          <div className="rule-row">
            <div className="rule-info">
              <h4>Require Active Academic Year</h4>
              <p>Strictly prevent creating classes or admitting students when there is no active academic year session.</p>
            </div>
            <div className="rule-control">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={config.requireAcademicYear === true}
                  onChange={() => handleConfigChange('requireAcademicYear', !config.requireAcademicYear)}
                  disabled={saving}
                />
                <span className="slider" />
              </label>
            </div>
          </div>

          {/* Allow Multiple Sections */}
          <div className="rule-row">
            <div className="rule-info">
              <h4>Allow Multiple Class Sections</h4>
              <p>Permit classes of the same grade to branch into parallel sections (e.g., Section A, Section B).</p>
            </div>
            <div className="rule-control">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={config.allowMultipleSections === true}
                  onChange={() => handleConfigChange('allowMultipleSections', !config.allowMultipleSections)}
                  disabled={saving}
                />
                <span className="slider" />
              </label>
            </div>
          </div>

          {/* Allow Attendance Edit */}
          <div className="rule-row">
            <div className="rule-info">
              <h4>Allow Attendance Edit</h4>
              <p>Permit teachers and staff to update or unmark past attendance records within the allowed lock window.</p>
            </div>
            <div className="rule-control">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={config.allowAttendanceEdit === true}
                  onChange={() => handleConfigChange('allowAttendanceEdit', !config.allowAttendanceEdit)}
                  disabled={saving}
                />
                <span className="slider" />
              </label>
            </div>
          </div>

          {/* Attendance Lock Days */}
          <div className="rule-row">
            <div className="rule-info">
              <h4>Attendance Lock Window (Days)</h4>
              <p>Number of days after which marked attendance records become locked from editing (0 = same day only, max 365).</p>
            </div>
            <div className="rule-control">
              <div className="number-input-wrap">
                <MdAccessTime style={{ color: '#6b7785', fontSize: '18px' }} />
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={config.attendanceLockDays}
                  onChange={(e) => handleConfigChange('attendanceLockDays', e.target.value)}
                  disabled={saving}
                />
                <span style={{ fontSize: '13px', color: '#6b7785' }}>days</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
