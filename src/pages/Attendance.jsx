import React, { useState, useEffect, useCallback } from 'react';
import { 
  MdFactCheck, MdCheck, MdClose, MdSchedule, MdInfo, 
  MdChevronLeft, MdChevronRight, MdSave, MdCalendarMonth, 
  MdSelectAll, MdWarning, MdAssessment 
} from 'react-icons/md';
import { toast } from 'react-hot-toast';
import { getClasses, getAttendance, markAttendance, getAttendanceStats } from '../services/api';
import '../styles/attendance.css';

const STATUS_CONFIG = {
  present: { label: 'Present', icon: <MdCheck />, class: 'present' },
  absent: { label: 'Absent', icon: <MdClose />, class: 'absent' },
  late: { label: 'Late', icon: <MdSchedule />, class: 'late' },
  excused: { label: 'Excused', icon: <MdInfo />, class: 'excused' }
};

const Attendance = () => {
  const [view, setView] = useState('mark'); // 'mark' or 'stats'
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Stats view state
  const [statsMonth, setStatsMonth] = useState(new Date().toISOString().substring(0, 7));
  const [monthlyStats, setMonthlyStats] = useState([]);

  // Fetch classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await getClasses();
        const classList = Array.isArray(response) ? response : (response?.data || []);
        setClasses(classList);
      } catch (error) {
        toast.error('Failed to load classes');
        setClasses([]);
      }
    };
    fetchClasses();
  }, []);

  // Fetch attendance data when class or date changes
  const loadAttendance = useCallback(async () => {
    if (!selectedClass) return;
    
    if (hasUnsavedChanges) {
      const confirm = window.confirm('You have unsaved changes. Discard them?');
      if (!confirm) return;
    }

    setLoading(true);
    setHasUnsavedChanges(false);
    try {
      const response = await getAttendance(selectedClass, date);
      const data = response?.data || response || {};
      const recordsList = data.records || [];

      setStudents(recordsList.map(r => ({
        id: r.studentId,
        name: r.studentName,
        admissionNo: r.admissionNo
      })));
      
      // Map API response to local state (e.g. 'PRESENT' -> 'present')
      const records = {};
      recordsList.forEach(record => {
        if (record.status) {
          records[record.studentId] = {
            status: record.status.toLowerCase(),
            remarks: record.remarks || ''
          };
        }
      });
      setAttendanceRecords(records);
    } catch (error) {
      toast.error('Failed to load attendance data');
      setStudents([]);
      setAttendanceRecords({});
    } finally {
      setLoading(false);
    }
  }, [selectedClass, date, hasUnsavedChanges]);

  useEffect(() => {
    if (view === 'mark') {
      loadAttendance();
    }
  }, [loadAttendance, view]);

  // Fetch monthly stats
  useEffect(() => {
    const loadStats = async () => {
      if (!selectedClass || view !== 'stats') return;
      setLoading(true);
      try {
        const [year, month] = statsMonth.split('-');
        const response = await getAttendanceStats(selectedClass, month, year);
        const statsData = response?.data?.dailyStats || (Array.isArray(response?.data) ? response.data : []);
        setMonthlyStats(statsData);
      } catch (error) {
        toast.error('Failed to load attendance statistics');
        setMonthlyStats([]);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [selectedClass, statsMonth, view]);

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleStatusChange = (studentId, status) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status
      }
    }));
    setHasUnsavedChanges(true);
  };

  const handleRemarksChange = (studentId, remarks) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks
      }
    }));
    setHasUnsavedChanges(true);
  };

  const markAll = (status) => {
    const newRecords = { ...attendanceRecords };
    students.forEach(student => {
      newRecords[student.id] = {
        ...newRecords[student.id],
        status
      };
    });
    setAttendanceRecords(newRecords);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const recordsToSave = Object.keys(attendanceRecords).map(studentId => ({
        studentId,
        status: attendanceRecords[studentId].status ? attendanceRecords[studentId].status.toUpperCase() : null,
        remarks: attendanceRecords[studentId].remarks
      })).filter(r => r.status); // Only save marked ones

      if (recordsToSave.length === 0) {
        toast.error('No attendance marked');
        setSaving(false);
        return;
      }

      await markAttendance({
        classId: selectedClass,
        date,
        records: recordsToSave
      });
      toast.success('Attendance saved successfully');
      setHasUnsavedChanges(false);
    } catch (error) {
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const changeDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  // Stats calculation
  const totalStudents = students.length;
  const markedCount = Object.keys(attendanceRecords).filter(id => attendanceRecords[id]?.status).length;
  const presentCount = Object.values(attendanceRecords).filter(r => r?.status === 'present').length;
  const absentCount = Object.values(attendanceRecords).filter(r => r?.status === 'absent').length;
  const lateCount = Object.values(attendanceRecords).filter(r => r?.status === 'late').length;
  const presentPercentage = totalStudents ? Math.round((presentCount / totalStudents) * 100) : 0;

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="attendance-page">
      <div className="attendance-header">
        <div className="header-title">
          <MdFactCheck className="header-icon" />
          <h1>Attendance Management</h1>
        </div>
        <div className="view-toggle">
          <button 
            className={`toggle-btn ${view === 'mark' ? 'active' : ''}`}
            onClick={() => setView('mark')}
          >
            <MdFactCheck /> Mark Daily
          </button>
          <button 
            className={`toggle-btn ${view === 'stats' ? 'active' : ''}`}
            onClick={() => setView('stats')}
          >
            <MdAssessment /> Monthly Stats
          </button>
        </div>
      </div>

      <div className="attendance-controls">
        <div className="control-group">
          <label>Select Class</label>
          <select 
            value={selectedClass} 
            onChange={(e) => setSelectedClass(e.target.value)}
            className="class-selector"
          >
            <option value="">-- Select Class --</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>

        {view === 'mark' && (
          <div className="control-group">
            <label>Date</label>
            <div className="date-picker-group">
              <button className="icon-btn" onClick={() => changeDate(-1)}><MdChevronLeft /></button>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
              <button className="icon-btn" onClick={() => changeDate(1)} disabled={date === new Date().toISOString().split('T')[0]}><MdChevronRight /></button>
            </div>
          </div>
        )}

        {view === 'stats' && (
          <div className="control-group">
            <label>Month</label>
            <input 
              type="month" 
              value={statsMonth}
              onChange={(e) => setStatsMonth(e.target.value)}
            />
          </div>
        )}
      </div>

      {!selectedClass ? (
        <div className="empty-state">
          <MdFactCheck className="empty-icon" />
          <h2>No Class Selected</h2>
          <p>Please select a class from the dropdown above to manage attendance.</p>
        </div>
      ) : loading ? (
        <div className="loading-skeleton">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-row"></div>
          ))}
        </div>
      ) : view === 'mark' ? (
        <>
          <div className="stats-summary-card">
            <div className="stat-item">
              <span className="stat-label">Total</span>
              <span className="stat-value">{totalStudents}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Marked</span>
              <span className="stat-value">{markedCount}/{totalStudents}</span>
            </div>
            <div className="stat-item highlight-present">
              <span className="stat-label">Present</span>
              <span className="stat-value">{presentPercentage}%</span>
            </div>
            <div className="stat-item highlight-absent">
              <span className="stat-label">Absent</span>
              <span className="stat-value">{absentCount}</span>
            </div>
            <div className="stat-item highlight-late">
              <span className="stat-label">Late</span>
              <span className="stat-value">{lateCount}</span>
            </div>
          </div>

          <div className="bulk-actions-bar">
            <button className="bulk-btn mark-present" onClick={() => markAll('present')}>
              <MdSelectAll /> Mark All Present
            </button>
            <button className="bulk-btn mark-absent" onClick={() => markAll('absent')}>
              <MdSelectAll /> Mark All Absent
            </button>
          </div>

          <div className="attendance-table-container">
            {students.length === 0 ? (
              <div className="empty-state">
                <p>No students found in this class.</p>
              </div>
            ) : (
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Attendance Status</th>
                    <th>Remarks (Optional)</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => {
                    const record = attendanceRecords[student.id] || {};
                    return (
                      <tr key={student.id} className={record.status ? `marked-${record.status}` : 'unmarked'}>
                        <td>
                          <div className="student-info">
                            <div className="student-avatar">{getInitials(student.name)}</div>
                            <div className="student-details">
                              <span className="student-name">{student.name}</span>
                              <span className="student-admin">Adm: {student.admissionNo}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="status-toggle-group">
                            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                              <button
                                key={status}
                                className={`status-btn ${config.class} ${record.status === status ? 'active' : ''}`}
                                onClick={() => handleStatusChange(student.id, status)}
                                title={config.label}
                              >
                                {config.icon}
                                <span>{config.label}</span>
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="remarks-input"
                            placeholder="Add remarks..."
                            value={record.remarks || ''}
                            onChange={(e) => handleRemarksChange(student.id, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {students.length > 0 && (
            <div className="save-bar">
              {hasUnsavedChanges && (
                <span className="unsaved-warning">
                  <MdWarning /> Unsaved changes
                </span>
              )}
              <button 
                className={`btn-save ${saving ? 'saving' : ''}`} 
                onClick={handleSave}
                disabled={saving || markedCount === 0}
              >
                <MdSave /> {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="monthly-stats-view">
          <h3>Attendance for {new Date(statsMonth + '-01').toLocaleDateString('default', { month: 'long', year: 'numeric' })}</h3>
          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="cal-header">{day}</div>
            ))}
            {monthlyStats.map((dayStat, idx) => (
              <div key={idx} className={`cal-cell ${dayStat.isCurrentMonth ? '' : 'other-month'}`}>
                <span className="cal-date">{new Date(dayStat.date).getDate()}</span>
                {dayStat.percentage !== null && (
                  <div 
                    className="cal-percentage" 
                    style={{
                      backgroundColor: dayStat.percentage >= 90 ? '#10b981' : 
                                      dayStat.percentage >= 75 ? '#f59e0b' : '#ef4444'
                    }}
                  >
                    {dayStat.percentage}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
