import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MdAdd, MdSearch, MdEdit, MdDelete, MdVisibility, MdClose,
  MdChevronLeft, MdChevronRight, MdPeople, MdFilterList,
  MdArrowUpward, MdArrowDownward, MdFileDownload, MdFileUpload,
  MdExpandMore, MdClear, MdWarning, MdRefresh,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import {
  getStudents, createStudent, updateStudent, deleteStudent,
  getClasses, getCustomFields,
} from '../services/api';
import ImportModal from '../components/students/ImportModal';
import '../styles/students.css';

// ── Default form state ──
const DEFAULT_FORM = {
  admissionNo: '', firstName: '', lastName: '', fatherName: '', motherName: '',
  email: '', phone: '', dateOfBirth: '', gender: 'MALE', address: '',
  classId: '', status: 'ACTIVE',
  guardianName: '', guardianPhone: '', guardianEmail: '', guardianRelation: '',
  bloodGroup: '', nationality: 'Indian', idNumber: '', previousSchool: '',
  emergencyContact: '', medicalNotes: '',
};

function Students() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Data & loading state
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination state (server-side source of truth)
  const [page, setPage] = useState(() => parseInt(searchParams.get('page') || '1', 10));
  const [pageSize, setPageSize] = useState(() => parseInt(searchParams.get('pageSize') || '25', 10));
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter state (synced with URL)
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('search') || '');
  const [filterClass, setFilterClass] = useState(() => searchParams.get('classId') || '');
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') || '');
  const [filterGender, setFilterGender] = useState(() => searchParams.get('gender') || '');
  const [filterBloodGroup, setFilterBloodGroup] = useState(() => searchParams.get('bloodGroup') || '');
  const [filterDateFrom, setFilterDateFrom] = useState(() => searchParams.get('dateFrom') || '');
  const [filterDateTo, setFilterDateTo] = useState(() => searchParams.get('dateTo') || '');
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showMobileFilterDrawer, setShowMobileFilterDrawer] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState(() => searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState(() => searchParams.get('sortOrder') || 'desc');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [modalTab, setModalTab] = useState('basic');
  const [editingStudent, setEditingStudent] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [customFieldValues, setCustomFieldValues] = useState({});

  // Import/Export state
  const [showImport, setShowImport] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // AbortController ref for search cancellation
  const abortControllerRef = useRef(null);

  // Active filter count
  const activeFilterCount = [filterClass, filterStatus, filterGender, filterBloodGroup, filterDateFrom, filterDateTo]
    .filter(Boolean).length;

  // ── Debounce Search Input (300ms) ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Sync URL SearchParams ──
  useEffect(() => {
    const params = {};
    if (page > 1) params.page = String(page);
    if (pageSize !== 25) params.pageSize = String(pageSize);
    if (debouncedSearch) params.search = debouncedSearch;
    if (filterClass) params.classId = filterClass;
    if (filterStatus) params.status = filterStatus;
    if (filterGender) params.gender = filterGender;
    if (filterBloodGroup) params.bloodGroup = filterBloodGroup;
    if (filterDateFrom) params.dateFrom = filterDateFrom;
    if (filterDateTo) params.dateTo = filterDateTo;
    if (sortBy !== 'createdAt') params.sortBy = sortBy;
    if (sortOrder !== 'desc') params.sortOrder = sortOrder;

    setSearchParams(params, { replace: true });
  }, [page, pageSize, debouncedSearch, filterClass, filterStatus, filterGender, filterBloodGroup, filterDateFrom, filterDateTo, sortBy, sortOrder, setSearchParams]);

  // ── Reset Page to 1 when filters or search change ──
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch, filterClass, filterStatus, filterGender, filterBloodGroup, filterDateFrom, filterDateTo, pageSize]);

  // ── Fetch Students ──
  const fetchStudents = useCallback(async () => {
    // Cancel any ongoing fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const result = await getStudents({
        search: debouncedSearch || undefined,
        classId: filterClass || undefined,
        status: filterStatus || undefined,
        gender: filterGender || undefined,
        bloodGroup: filterBloodGroup || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
        sortBy,
        sortOrder,
        page,
        pageSize,
      }, { signal: controller.signal });

      if (controller.signal.aborted) return;

      const fetchedStudents = result.data || [];
      const fetchedTotal = result.pagination?.total || 0;
      const fetchedTotalPages = result.pagination?.totalPages || 1;

      setStudents(fetchedStudents);
      setTotal(fetchedTotal);
      setTotalPages(fetchedTotalPages);

      // Handle page becoming invalid (e.g. page > totalPages after deletion/filter)
      if (page > fetchedTotalPages && fetchedTotalPages > 0) {
        setPage(fetchedTotalPages);
      }
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      console.error('Fetch students error:', err);
      setError(err.message || 'Failed to load students');
      toast.error(err.message || 'Failed to load students');
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [debouncedSearch, filterClass, filterStatus, filterGender, filterBloodGroup, filterDateFrom, filterDateTo, sortBy, sortOrder, page, pageSize]);

  const fetchClasses = useCallback(async () => {
    try {
      const result = await getClasses();
      setClasses(result.data || []);
    } catch (err) {
      console.error('Failed to fetch classes:', err);
    }
  }, []);

  const fetchCustomFields = useCallback(async () => {
    try {
      const result = await getCustomFields(true);
      setCustomFields(result.data || []);
    } catch (err) {
      console.error('Failed to fetch custom fields:', err);
    }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => { fetchClasses(); fetchCustomFields(); }, [fetchClasses, fetchCustomFields]);

  // Handle ?edit=studentId from profile page
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && students.length > 0) {
      const studentToEdit = students.find(s => s.id === editId);
      if (studentToEdit) {
        openEditModal(studentToEdit);
      }
    }
  }, [searchParams, students]);

  // Lock body scroll when modal or filter drawer is open
  useEffect(() => {
    if (showModal || showDeleteConfirm || showMobileFilterDrawer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showModal, showDeleteConfirm, showMobileFilterDrawer]);

  // ── Sort handler ──
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <MdArrowUpward className="sort-icon" /> : <MdArrowDownward className="sort-icon" />;
  };

  // ── Clear all filters ──
  const clearAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setFilterClass('');
    setFilterStatus('');
    setFilterGender('');
    setFilterBloodGroup('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  };

  // ── Form handlers ──
  const handleFormChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCustomFieldChange = (fieldKey, value) => {
    setCustomFieldValues(prev => ({ ...prev, [fieldKey]: value }));
  };

  const resetForm = () => {
    setForm({ ...DEFAULT_FORM });
    setCustomFieldValues({});
    setModalTab('basic');
  };

  const openAddModal = () => {
    setModalMode('add');
    resetForm();
    setEditingStudent(null);
    setShowModal(true);
  };

  const openEditModal = (student) => {
    setModalMode('edit');
    setEditingStudent(student);
    setForm({
      admissionNo: student.admissionNo || '',
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      fatherName: student.fatherName || '',
      motherName: student.motherName || '',
      email: student.email || '',
      phone: student.phone || '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '',
      gender: student.gender || 'MALE',
      address: student.address || '',
      classId: student.classId || '',
      status: student.status || 'ACTIVE',
      guardianName: student.guardianName || '',
      guardianPhone: student.guardianPhone || '',
      guardianEmail: student.guardianEmail || '',
      guardianRelation: student.guardianRelation || '',
      bloodGroup: student.bloodGroup || '',
      nationality: student.nationality || 'Indian',
      idNumber: student.idNumber || '',
      previousSchool: student.previousSchool || '',
      emergencyContact: student.emergencyContact || '',
      medicalNotes: student.medicalNotes || '',
    });

    const cfValues = {};
    if (student.customFieldValues) {
      student.customFieldValues.forEach(cfv => {
        cfValues[cfv.customField?.fieldKey || cfv.customFieldId] = cfv.value;
      });
    }
    setCustomFieldValues(cfValues);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.admissionNo || !form.firstName || !form.lastName) {
      toast.error('Admission No, First Name, and Last Name are required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...form, customFields: customFieldValues };
      if (modalMode === 'add') {
        await createStudent(payload);
        toast.success('Student added successfully! 🎉');
      } else {
        await updateStudent(editingStudent.id, payload);
        toast.success('Student updated successfully! ✅');
      }
      setShowModal(false);
      resetForm();
      fetchStudents();
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStudent) return;
    setSubmitting(true);
    try {
      await deleteStudent(deletingStudent.id);
      toast.success(`${deletingStudent.firstName} ${deletingStudent.lastName} removed`);
      setShowDeleteConfirm(false);
      setDeletingStudent(null);
      fetchStudents();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Export Handlers ──
  const API_BASE = window.location.port === '5173' ? 'http://localhost:5000/api' : '/api';

  const getExportParams = () => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (filterClass) params.classId = filterClass;
    if (filterStatus) params.status = filterStatus;
    if (filterGender) params.gender = filterGender;
    if (filterBloodGroup) params.bloodGroup = filterBloodGroup;
    if (filterDateFrom) params.dateFrom = filterDateFrom;
    if (filterDateTo) params.dateTo = filterDateTo;
    return params;
  };

  const handleExportExcel = async () => {
    try {
      setShowExportMenu(false);
      toast.loading('Generating Excel...');
      const queryStr = new URLSearchParams(getExportParams()).toString();
      const response = await fetch(`${API_BASE}/export/students/excel${queryStr ? `?${queryStr}` : ''}`);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `students_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss();
      toast.success('Excel exported successfully!');
    } catch (err) {
      toast.dismiss();
      toast.error(err.message);
    }
  };

  const handleExportPDF = async () => {
    try {
      setShowExportMenu(false);
      toast.loading('Generating PDF...');
      const queryStr = new URLSearchParams(getExportParams()).toString();
      const response = await fetch(`${API_BASE}/export/students/pdf${queryStr ? `?${queryStr}` : ''}`);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `students_report_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss();
      toast.success('PDF exported successfully!');
    } catch (err) {
      toast.dismiss();
      toast.error(err.message);
    }
  };

  // ── Helpers ──
  const getInitials = (first, last) => `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderCustomFieldInput = (field) => {
    const value = customFieldValues[field.fieldKey] || '';
    const commonProps = {
      value,
      onChange: (e) => handleCustomFieldChange(field.fieldKey, e.target.value),
    };

    switch (field.fieldType) {
      case 'TEXT':
        return <input {...commonProps} placeholder={field.placeholder || ''} />;
      case 'NUMBER':
        return <input type="number" {...commonProps} placeholder={field.placeholder || ''} />;
      case 'DATE':
        return <input type="date" {...commonProps} />;
      case 'SELECT': {
        let options = [];
        try { options = JSON.parse(field.options || '[]'); } catch (e) { /* ignore */ }
        return (
          <select {...commonProps}>
            <option value="">Select...</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      }
      case 'CHECKBOX':
        return (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => handleCustomFieldChange(field.fieldKey, e.target.checked ? 'true' : 'false')}
            />
            <span>{field.placeholder || 'Yes'}</span>
          </label>
        );
      case 'TEXTAREA':
        return <textarea {...commonProps} placeholder={field.placeholder || ''} />;
      default:
        return <input {...commonProps} />;
    }
  };

  const startRange = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRange = Math.min(page * pageSize, total);

  return (
    <div className="students-page">
      {/* ── Header ── */}
      <div className="students-header">
        <div>
          <h1>Students</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Manage student records, admissions, and profiles
          </p>
        </div>
        <div className="students-header-actions">
          <button className="btn-outline" onClick={() => setShowImport(true)}>
            <MdFileUpload /> Import
          </button>
          <div className="export-dropdown">
            <button className="btn-outline" onClick={() => setShowExportMenu(!showExportMenu)}>
              <MdFileDownload /> Export <MdExpandMore />
            </button>
            {showExportMenu && (
              <div className="export-menu">
                <button onClick={handleExportExcel}>📊 Export as Excel</button>
                <button onClick={handleExportPDF}>📄 Export as PDF</button>
              </div>
            )}
          </div>
          <button className="btn-primary" onClick={openAddModal}>
            <MdAdd /> Add Student
          </button>
        </div>
      </div>

      {/* ── Compact Filter Toolbar (Desktop & Mobile) ── */}
      <div className="students-toolbar">
        <div className="search-wrapper">
          <MdSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, admission no, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>
              <MdClear />
            </button>
          )}
        </div>

        {/* Primary Filter Selects (Desktop view) */}
        <select
          className="filter-select desktop-only-filter"
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
        >
          <option value="">All Classes</option>
          {classes.map(cls => (
            <option key={cls.id} value={cls.id}>{cls.name} {cls.section ? `(${cls.section})` : ''}</option>
          ))}
        </select>

        <select
          className="filter-select desktop-only-filter"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="GRADUATED">Graduated</option>
        </select>

        {/* Advanced Filters Button (Desktop) */}
        <button
          className={`btn-filter desktop-only-filter ${showAdvancedFilters ? 'active' : ''}`}
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          <MdFilterList />
          More Filters
          {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
        </button>

        {/* Mobile Filter Drawer Trigger */}
        <button
          className={`btn-filter mobile-only-filter ${activeFilterCount > 0 ? 'active' : ''}`}
          onClick={() => setShowMobileFilterDrawer(true)}
        >
          <MdFilterList />
          Filters
          {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
        </button>
      </div>

      {/* ── Advanced Filters Panel (Desktop Expandable) ── */}
      {showAdvancedFilters && (
        <div className="advanced-filters-panel">
          <div className="advanced-filters-grid">
            <div className="filter-group">
              <label>Gender</label>
              <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}>
                <option value="">All</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Blood Group</label>
              <select value={filterBloodGroup} onChange={(e) => setFilterBloodGroup(e.target.value)}>
                <option value="">All</option>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Admission From</label>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>Admission To</label>
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button className="clear-filters-btn" onClick={clearAllFilters}>
              <MdClear /> Clear All Filters
            </button>
          )}
        </div>
      )}

      {/* ── Mobile Filter Drawer Sheet ── */}
      {showMobileFilterDrawer && (
        <div className="mobile-filter-drawer-overlay" onClick={() => setShowMobileFilterDrawer(false)}>
          <div className="mobile-filter-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Filter Students</h3>
              <button className="drawer-close-btn" onClick={() => setShowMobileFilterDrawer(false)}>
                <MdClose />
              </button>
            </div>
            <div className="drawer-body">
              <div className="filter-group">
                <label>Class</label>
                <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                  <option value="">All Classes</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name} {cls.section ? `(${cls.section})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="GRADUATED">Graduated</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Gender</label>
                <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}>
                  <option value="">All</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Blood Group</label>
                <select value={filterBloodGroup} onChange={(e) => setFilterBloodGroup(e.target.value)}>
                  <option value="">All</option>
                  {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Admission Date From</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
              </div>
              <div className="filter-group">
                <label>Admission Date To</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
              </div>
            </div>
            <div className="drawer-footer">
              <button className="btn-outline" onClick={clearAllFilters}>Clear Filters</button>
              <button className="btn-primary" onClick={() => setShowMobileFilterDrawer(false)}>Apply Filters</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Filter Removable Chips ── */}
      {activeFilterCount > 0 && (
        <div className="filter-chips">
          {filterClass && (
            <span className="filter-chip">
              Class: {classes.find(c => c.id === filterClass)?.name || 'Class'}
              <button onClick={() => setFilterClass('')}><MdClose /></button>
            </span>
          )}
          {filterStatus && (
            <span className="filter-chip">
              Status: {filterStatus}
              <button onClick={() => setFilterStatus('')}><MdClose /></button>
            </span>
          )}
          {filterGender && (
            <span className="filter-chip">
              Gender: {filterGender}
              <button onClick={() => setFilterGender('')}><MdClose /></button>
            </span>
          )}
          {filterBloodGroup && (
            <span className="filter-chip">
              Blood: {filterBloodGroup}
              <button onClick={() => setFilterBloodGroup('')}><MdClose /></button>
            </span>
          )}
          {filterDateFrom && (
            <span className="filter-chip">
              From: {filterDateFrom}
              <button onClick={() => setFilterDateFrom('')}><MdClose /></button>
            </span>
          )}
          {filterDateTo && (
            <span className="filter-chip">
              To: {filterDateTo}
              <button onClick={() => setFilterDateTo('')}><MdClose /></button>
            </span>
          )}
          <button className="clear-all-chip" onClick={clearAllFilters}>Clear All</button>
        </div>
      )}

      {/* ── Content View (Table / Cards / Loading / Error) ── */}
      <div className="students-container">
        {error ? (
          <div className="error-banner-card">
            <MdWarning className="error-icon" />
            <h3>Unable to load students</h3>
            <p>{error}</p>
            <button className="btn-primary" onClick={fetchStudents}>
              <MdRefresh /> Try Again
            </button>
          </div>
        ) : loading ? (
          <div>
            {/* Desktop Skeletons */}
            <div className="desktop-only-view">
              <div className="students-table-card">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div className="skeleton-row" key={i}>
                    <div className="skeleton skeleton-circle" />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div className="skeleton skeleton-text long" />
                      <div className="skeleton skeleton-text short" />
                    </div>
                    <div className="skeleton skeleton-text" />
                    <div className="skeleton skeleton-text short" />
                  </div>
                ))}
              </div>
            </div>
            {/* Mobile Skeletons */}
            <div className="mobile-only-view">
              <div className="student-cards-mobile">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div className="student-card-skeleton" key={i}>
                    <div className="skeleton skeleton-circle" />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="skeleton skeleton-text long" />
                      <div className="skeleton skeleton-text short" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon"><MdPeople /></div>
            <h3>No Students Found</h3>
            <p>{search || activeFilterCount ? 'No students match your current search or filter criteria.' : 'Get started by adding your first student.'}</p>
            {search || activeFilterCount ? (
              <button className="btn-outline" style={{ marginTop: '16px' }} onClick={clearAllFilters}>
                <MdClear /> Clear Search & Filters
              </button>
            ) : (
              <button className="btn-primary" style={{ marginTop: '16px' }} onClick={openAddModal}>
                <MdAdd /> Add First Student
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="desktop-only-view">
              <div className="students-table-card">
                <table className="students-table">
                  <thead>
                    <tr>
                      <th className="sortable-th" onClick={() => handleSort('name')}>
                        Student <SortIcon field="name" />
                      </th>
                      <th className="sortable-th" onClick={() => handleSort('class')}>
                        Class <SortIcon field="class" />
                      </th>
                      <th>Father Name</th>
                      <th>Phone</th>
                      <th className="sortable-th" onClick={() => handleSort('admissionDate')}>
                        Admission Date <SortIcon field="admissionDate" />
                      </th>
                      <th className="sortable-th" onClick={() => handleSort('status')}>
                        Status <SortIcon field="status" />
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => (
                      <tr key={student.id} style={{ animationDelay: `${index * 30}ms` }}>
                        <td>
                          <div className="student-name-cell" onClick={() => navigate(`/students/${student.id}`)} style={{ cursor: 'pointer' }}>
                            <div className="student-avatar">
                              {getInitials(student.firstName, student.lastName)}
                            </div>
                            <div className="student-info">
                              <div className="student-fullname">{student.firstName} {student.lastName}</div>
                              <div className="student-id">{student.admissionNo}</div>
                            </div>
                          </div>
                        </td>
                        <td>{student.class?.name || '—'}</td>
                        <td>{student.fatherName || '—'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{student.phone || '—'}</td>
                        <td>{formatDate(student.admissionDate)}</td>
                        <td>
                          <span className={`status-badge ${(student.status || 'ACTIVE').toLowerCase()}`}>
                            {student.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button className="action-btn view" title="View Profile" onClick={() => navigate(`/students/${student.id}`)}>
                              <MdVisibility />
                            </button>
                            <button className="action-btn edit" title="Edit" onClick={() => openEditModal(student)}>
                              <MdEdit />
                            </button>
                            <button className="action-btn delete" title="Delete" onClick={() => { setDeletingStudent(student); setShowDeleteConfirm(true); }}>
                              <MdDelete />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List View */}
            <div className="mobile-only-view">
              <div className="student-cards-mobile">
                {students.map((student) => (
                  <div key={student.id} className="student-mobile-card">
                    <div className="card-top-row">
                      <div className="card-user-info" onClick={() => navigate(`/students/${student.id}`)}>
                        <div className="student-avatar">
                          {getInitials(student.firstName, student.lastName)}
                        </div>
                        <div>
                          <h4 className="student-name">{student.firstName} {student.lastName}</h4>
                          <span className="student-adm-no">ID: {student.admissionNo}</span>
                        </div>
                      </div>
                      <span className={`status-badge ${(student.status || 'ACTIVE').toLowerCase()}`}>
                        {student.status || 'ACTIVE'}
                      </span>
                    </div>

                    <div className="card-details-grid">
                      <div className="detail-item">
                        <span className="detail-label">Class</span>
                        <span className="detail-value">{student.class?.name || 'Unassigned'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Father</span>
                        <span className="detail-value">{student.fatherName || '—'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Phone</span>
                        <span className="detail-value mono">{student.phone || '—'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Admitted</span>
                        <span className="detail-value">{formatDate(student.admissionDate)}</span>
                      </div>
                    </div>

                    <div className="card-actions-row">
                      <button className="card-btn-action" onClick={() => navigate(`/students/${student.id}`)}>
                        <MdVisibility /> View
                      </button>
                      <button className="card-btn-action" onClick={() => openEditModal(student)}>
                        <MdEdit /> Edit
                      </button>
                      <button className="card-btn-action delete" onClick={() => { setDeletingStudent(student); setShowDeleteConfirm(true); }}>
                        <MdDelete /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Server-Side Pagination Bar ── */}
            <div className="pagination-bar">
              <div className="pagination-info">
                Showing <strong>{startRange}–{endRange}</strong> of <strong>{total}</strong> students
              </div>

              <div className="pagination-controls">
                {/* Page Size Selector */}
                <div className="page-size-selector">
                  <span className="page-size-label">Rows per page:</span>
                  <select
                    className="page-size-select"
                    value={pageSize}
                    onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                {/* Page Navigation Buttons */}
                <div className="pagination-buttons">
                  <button
                    className="page-nav-btn"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(p - 1, 1))}
                    title="Previous Page"
                  >
                    <MdChevronLeft /> <span className="nav-text-mobile">Prev</span>
                  </button>

                  {/* Desktop Page Numbers */}
                  <div className="page-numbers-desktop">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .reduce((acc, p, idx, arr) => {
                        if (idx > 0 && p - arr[idx - 1] > 1) {
                          acc.push('...');
                        }
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, idx) => (
                        item === '...' ? (
                          <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                        ) : (
                          <button
                            key={item}
                            className={`page-num-btn ${item === page ? 'active' : ''}`}
                            onClick={() => setPage(item)}
                          >
                            {item}
                          </button>
                        )
                      ))}
                  </div>

                  <button
                    className="page-nav-btn"
                    disabled={page === totalPages || totalPages === 0}
                    onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                    title="Next Page"
                  >
                    <span className="nav-text-mobile">Next</span> <MdChevronRight />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Add/Edit Modal (Flex Body Scrolling Architecture) ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content student-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'add' ? 'Add New Student' : 'Edit Student'}</h2>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}>
                <MdClose />
              </button>
            </div>

            <div className="modal-tabs">
              <button
                className={`tab-btn ${modalTab === 'basic' ? 'active' : ''}`}
                onClick={() => setModalTab('basic')}
              >
                Basic Info
              </button>
              <button
                className={`tab-btn ${modalTab === 'guardian' ? 'active' : ''}`}
                onClick={() => setModalTab('guardian')}
              >
                Guardian
              </button>
              <button
                className={`tab-btn ${modalTab === 'additional' ? 'active' : ''}`}
                onClick={() => setModalTab('additional')}
              >
                Additional
              </button>
              {customFields.length > 0 && (
                <button
                  className={`tab-btn ${modalTab === 'custom' ? 'active' : ''}`}
                  onClick={() => setModalTab('custom')}
                >
                  Custom Fields
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="modal-form-wrapper">
              <div className="modal-body">
                {/* Basic Info Tab */}
                {modalTab === 'basic' && (
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Admission No *</label>
                      <input name="admissionNo" value={form.admissionNo} onChange={handleFormChange} placeholder="e.g. AK-2024-016" required />
                    </div>
                    <div className="form-group">
                      <label>Class</label>
                      <select name="classId" value={form.classId} onChange={handleFormChange}>
                        <option value="">Select Class</option>
                        {classes.map(cls => (
                          <option key={cls.id} value={cls.id}>{cls.name} {cls.section ? `(${cls.section})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>First Name *</label>
                      <input name="firstName" value={form.firstName} onChange={handleFormChange} placeholder="First name" required />
                    </div>
                    <div className="form-group">
                      <label>Last Name *</label>
                      <input name="lastName" value={form.lastName} onChange={handleFormChange} placeholder="Last name" required />
                    </div>
                    <div className="form-group">
                      <label>Father&apos;s Name</label>
                      <input name="fatherName" value={form.fatherName} onChange={handleFormChange} placeholder="Father's name" />
                    </div>
                    <div className="form-group">
                      <label>Mother&apos;s Name</label>
                      <input name="motherName" value={form.motherName} onChange={handleFormChange} placeholder="Mother's name" />
                    </div>
                    <div className="form-group">
                      <label>Gender</label>
                      <select name="gender" value={form.gender} onChange={handleFormChange}>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Date of Birth</label>
                      <input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label>Phone</label>
                      <input name="phone" value={form.phone} onChange={handleFormChange} placeholder="+91 ..." />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input type="email" name="email" value={form.email} onChange={handleFormChange} placeholder="student@email.com" />
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select name="status" value={form.status} onChange={handleFormChange}>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="GRADUATED">Graduated</option>
                        <option value="EXPELLED">Expelled</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Admission Date</label>
                      <input type="date" name="admissionDate" value={form.admissionDate || ''} onChange={handleFormChange} />
                    </div>
                    <div className="form-group full-width">
                      <label>Address</label>
                      <textarea name="address" value={form.address} onChange={handleFormChange} placeholder="Full address" />
                    </div>
                  </div>
                )}

                {/* Guardian Tab */}
                {modalTab === 'guardian' && (
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Guardian Name</label>
                      <input name="guardianName" value={form.guardianName} onChange={handleFormChange} placeholder="Guardian's full name" />
                    </div>
                    <div className="form-group">
                      <label>Relation</label>
                      <select name="guardianRelation" value={form.guardianRelation} onChange={handleFormChange}>
                        <option value="">Select Relation</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Uncle">Uncle</option>
                        <option value="Brother">Brother</option>
                        <option value="Grandfather">Grandfather</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Guardian Phone</label>
                      <input name="guardianPhone" value={form.guardianPhone} onChange={handleFormChange} placeholder="+91 ..." />
                    </div>
                    <div className="form-group">
                      <label>Guardian Email</label>
                      <input type="email" name="guardianEmail" value={form.guardianEmail} onChange={handleFormChange} placeholder="guardian@email.com" />
                    </div>
                    <div className="form-group full-width">
                      <label>Emergency Contact</label>
                      <input name="emergencyContact" value={form.emergencyContact} onChange={handleFormChange} placeholder="Emergency contact number" />
                    </div>
                  </div>
                )}

                {/* Additional Tab */}
                {modalTab === 'additional' && (
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Blood Group</label>
                      <select name="bloodGroup" value={form.bloodGroup} onChange={handleFormChange}>
                        <option value="">Select</option>
                        {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Nationality</label>
                      <input name="nationality" value={form.nationality} onChange={handleFormChange} placeholder="Indian" />
                    </div>
                    <div className="form-group">
                      <label>ID Number (Aadhaar/etc)</label>
                      <input name="idNumber" value={form.idNumber} onChange={handleFormChange} placeholder="XXXX-XXXX-XXXX" />
                    </div>
                    <div className="form-group">
                      <label>Previous School</label>
                      <input name="previousSchool" value={form.previousSchool} onChange={handleFormChange} placeholder="Previous institution" />
                    </div>
                    <div className="form-group full-width">
                      <label>Medical Notes</label>
                      <textarea name="medicalNotes" value={form.medicalNotes} onChange={handleFormChange} placeholder="Any medical conditions, allergies, etc." />
                    </div>
                  </div>
                )}

                {/* Custom Fields Tab */}
                {modalTab === 'custom' && (
                  <div className="form-grid">
                    {customFields.map(field => (
                      <div className={`form-group ${field.fieldType === 'TEXTAREA' ? 'full-width' : ''}`} key={field.id}>
                        <label>
                          {field.name}
                          {field.isRequired && <span className="required-star"> *</span>}
                        </label>
                        {renderCustomFieldInput(field)}
                      </div>
                    ))}
                    {customFields.length === 0 && (
                      <div className="form-group full-width">
                        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-6)' }}>
                          No custom fields created yet. Go to Settings → Custom Fields to create them.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : (modalMode === 'add' ? 'Add Student' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {showDeleteConfirm && deletingStudent && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-body text-center">
              <div className="delete-modal-icon"><MdDelete /></div>
              <h3>Delete Student?</h3>
              <p>
                Are you sure you want to remove <strong>{deletingStudent.firstName} {deletingStudent.lastName}</strong> ({deletingStudent.admissionNo})?
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn-outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete} disabled={submitting}>
                {submitting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ── */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImportComplete={() => { setShowImport(false); fetchStudents(); }}
      />
    </div>
  );
}

export default Students;
