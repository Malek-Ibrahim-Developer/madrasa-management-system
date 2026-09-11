import React, { useState, useEffect, useCallback } from 'react';
import { 
  MdAdd, 
  MdSearch, 
  MdEdit, 
  MdDelete, 
  MdClass, 
  MdPeople, 
  MdClose,
  MdWarning,
  MdRefresh,
  MdArchive,
  MdUnarchive,
  MdFilterList,
  MdChevronLeft,
  MdChevronRight
} from 'react-icons/md';
import { toast } from 'react-hot-toast';
import { getClasses, createClass, updateClass, updateClassStatus, deleteClass } from '../services/api';
import { generateClassCode } from '../utils/classCode';
import { getCapacityInfo } from '../utils/capacity';
import '../styles/courses.css';

const initialFormState = {
  name: '',
  section: '',
  code: '',
  teacher: '',
  capacity: 40,
};

const Courses = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prevent page scroll when modal is open
  useEffect(() => {
    if (isModalOpen || isDeleteModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, isDeleteModalOpen]);

  // Auto-generate code from name and section when creating
  useEffect(() => {
    if (!selectedClass && formData.name) {
      const generated = generateClassCode(formData.name, formData.section);
      if (generated) {
        setFormData(prev => ({ ...prev, code: generated }));
      }
    }
  }, [formData.name, formData.section, selectedClass]);

  const fetchClasses = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      else setRefreshing(true);

      const response = await getClasses({
        search: searchTerm,
        status: statusFilter,
        page,
        limit,
      });

      const classList = Array.isArray(response) ? response : (response?.data || []);
      setClasses(classList);

      if (response?.pagination) {
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error(error.message || 'Failed to load courses and classes');
      setClasses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchTerm, statusFilter, page, limit]);

  useEffect(() => {
    fetchClasses(true);
  }, [fetchClasses]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPage(1); // Reset to first page on new search
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1); // Reset to first page on filter change
  };

  const openAddModal = () => {
    setSelectedClass(null);
    setFormData(initialFormState);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (cls) => {
    setSelectedClass(cls);
    setFormData({
      name: cls.name || '',
      section: cls.section || '',
      code: cls.code || '',
      teacher: cls.teacher || '',
      capacity: cls.capacity || 40,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openDeleteModal = (cls) => {
    setSelectedClass(cls);
    setIsDeleteModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsDeleteModalOpen(false);
    setTimeout(() => {
      setSelectedClass(null);
      setFormData(initialFormState);
      setFormErrors({});
    }, 200);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Class Name is required';
    }
    if (!formData.code.trim()) {
      errors.code = 'Class Code is required';
    }
    const capNum = Number(formData.capacity);
    if (!Number.isInteger(capNum) || capNum <= 0) {
      errors.capacity = 'Capacity must be a positive integer';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0]);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        capacity: Number(formData.capacity),
      };

      if (selectedClass) {
        await updateClass(selectedClass.id, payload);
        toast.success('Class updated successfully');
      } else {
        await createClass(payload);
        toast.success('Class created successfully');
      }
      closeModal();
      fetchClasses(false);
    } catch (error) {
      console.error('Error saving class:', error);
      toast.error(error.message || 'Failed to save class');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleArchive = async (cls) => {
    try {
      const newStatus = cls.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
      await updateClassStatus(cls.id, newStatus);
      toast.success(`Class ${newStatus === 'ARCHIVED' ? 'archived' : 'restored'} successfully`);
      fetchClasses(false);
    } catch (error) {
      toast.error(error.message || 'Failed to change class status');
    }
  };

  const handleDelete = async () => {
    if (!selectedClass) return;
    try {
      setIsSubmitting(true);
      const res = await deleteClass(selectedClass.id);
      if (res.archived) {
        toast(res.message, { icon: 'ℹ️' });
      } else {
        toast.success('Class deleted successfully');
      }
      closeModal();
      fetchClasses(false);
    } catch (error) {
      console.error('Error deleting class:', error);
      toast.error(error.message || 'Failed to delete class');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="courses-page">
      {/* ── Header ── */}
      <div className="courses-header">
        <div className="header-content">
          <h1>Courses & Classes</h1>
          <p>Manage all academic classes, sections, and capacity limits</p>
        </div>
        <button className="btn-primary" onClick={openAddModal} aria-label="Add New Class">
          <MdAdd className="btn-icon" />
          <span>Add Class</span>
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="courses-toolbar">
        <div className="search-box">
          <MdSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, code, teacher, or section..."
            value={searchTerm}
            onChange={handleSearch}
          />
        </div>

        <div className="filter-group">
          <MdFilterList className="filter-icon" />
          <select 
            value={statusFilter} 
            onChange={handleStatusFilterChange}
            className="status-select"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
            <option value="CLOSED">Closed</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>

        <button 
          className="btn-icon-secondary" 
          onClick={() => fetchClasses(false)} 
          title="Refresh List"
          disabled={refreshing}
        >
          <MdRefresh className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      {/* ── Table & List Content ── */}
      <div className="courses-content">
        {loading ? (
          <div className="loading-state">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton-row"></div>
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <MdClass className="empty-icon" />
            </div>
            <h3>No Classes Found</h3>
            <p>
              {searchTerm 
                ? `No results matching "${searchTerm}"` 
                : 'Get started by creating your first class'}
            </p>
            {!searchTerm && (
              <button className="btn-primary mt-4" onClick={openAddModal}>
                <MdAdd className="btn-icon" />
                <span>Add Class</span>
              </button>
            )}
          </div>
        ) : (
          <div className="courses-table-card">
            <div className="table-responsive">
              <table className="courses-table">
                <thead>
                  <tr>
                    <th>Class Info</th>
                    <th>Code</th>
                    <th>Teacher</th>
                    <th>Capacity & Enrollment</th>
                    <th>Status</th>
                    <th className="actions-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((cls) => {
                    const capacityInfo = getCapacityInfo(cls.studentCount, cls.capacity);
                    const isArchived = cls.status === 'ARCHIVED';

                    return (
                      <tr key={cls.id} className={isArchived ? 'archived-row' : ''}>
                        <td>
                          <div className="class-info">
                            <div className="class-icon-wrapper">
                              <MdClass />
                            </div>
                            <div>
                              <span className="class-name">{cls.name}</span>
                              {cls.section && (
                                <span className="class-section">Section: {cls.section}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="code-badge">{cls.code}</span>
                        </td>
                        <td>
                          <div className="teacher-info">
                            {cls.teacher ? cls.teacher : <span className="text-muted">Unassigned</span>}
                          </div>
                        </td>
                        <td>
                          <div className="capacity-container">
                            <div className="capacity-header">
                              <span className="students-count">
                                <MdPeople className="inline-icon" /> 
                                {cls.studentCount || 0} / {cls.capacity || 40}
                              </span>
                              <span className={`capacity-percentage ${capacityInfo.status}`}>
                                {capacityInfo.percentage}%
                              </span>
                            </div>
                            <div className="capacity-bar-bg">
                              <div 
                                className={`capacity-bar-fill ${capacityInfo.status.toLowerCase()}`}
                                style={{ width: `${Math.min(capacityInfo.percentage, 100)}%` }}
                              ></div>
                            </div>
                            {capacityInfo.status === 'OVER_CAPACITY' && (
                              <small className="capacity-warning">
                                Over capacity by {capacityInfo.overBy}
                              </small>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill status-${(cls.status || 'ACTIVE').toLowerCase()}`}>
                            {cls.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td className="actions-cell">
                          <div className="action-buttons">
                            <button 
                              className="course-action-btn edit" 
                              onClick={() => openEditModal(cls)}
                              title="Edit Class"
                              aria-label={`Edit ${cls.name}`}
                            >
                              <MdEdit />
                            </button>
                            <button 
                              className="course-action-btn archive" 
                              onClick={() => handleToggleArchive(cls)}
                              title={isArchived ? 'Restore Class' : 'Archive Class'}
                              aria-label={isArchived ? `Restore ${cls.name}` : `Archive ${cls.name}`}
                            >
                              {isArchived ? <MdUnarchive /> : <MdArchive />}
                            </button>
                            <button 
                              className="course-action-btn delete" 
                              onClick={() => openDeleteModal(cls)}
                              title="Delete Class"
                              aria-label={`Delete ${cls.name}`}
                            >
                              <MdDelete />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="courses-mobile-list">
              {classes.map((cls) => {
                const capacityInfo = getCapacityInfo(cls.studentCount, cls.capacity);
                const isArchived = cls.status === 'ARCHIVED';
                
                return (
                  <div key={cls.id} className={`course-card ${isArchived ? 'archived-card' : ''}`}>
                    <div className="course-card-header">
                      <div className="course-title">
                        <h3>{cls.name}</h3>
                        <span className="code-badge">{cls.code}</span>
                      </div>
                      <div className="action-buttons">
                        <button className="course-action-btn edit" onClick={() => openEditModal(cls)} title="Edit Class">
                          <MdEdit />
                        </button>
                        <button className="course-action-btn archive" onClick={() => handleToggleArchive(cls)} title="Archive Class">
                          {isArchived ? <MdUnarchive /> : <MdArchive />}
                        </button>
                        <button className="course-action-btn delete" onClick={() => openDeleteModal(cls)} title="Delete Class">
                          <MdDelete />
                        </button>
                      </div>
                    </div>
                    
                    <div className="course-card-body">
                      {cls.section && (
                        <div className="info-row">
                          <span className="info-label">Section:</span>
                          <span className="info-value">{cls.section}</span>
                        </div>
                      )}
                      <div className="info-row">
                        <span className="info-label">Teacher:</span>
                        <span className="info-value">{cls.teacher || 'Unassigned'}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Status:</span>
                        <span className={`status-pill status-${(cls.status || 'ACTIVE').toLowerCase()}`}>
                          {cls.status || 'ACTIVE'}
                        </span>
                      </div>
                      
                      <div className="capacity-container mt-3">
                        <div className="capacity-header">
                          <span className="students-count text-sm">
                            Students: {cls.studentCount || 0} / {cls.capacity || 40}
                          </span>
                          <span className={`capacity-percentage text-sm ${capacityInfo.status}`}>
                            {capacityInfo.percentage}%
                          </span>
                        </div>
                        <div className="capacity-bar-bg mt-1">
                          <div 
                            className={`capacity-bar-fill ${capacityInfo.status.toLowerCase()}`}
                            style={{ width: `${Math.min(capacityInfo.percentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="pagination-bar">
                <span className="pagination-info">
                  Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total classes)
                </span>
                <div className="pagination-actions">
                  <button 
                    className="btn-pagination" 
                    disabled={page <= 1}
                    onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  >
                    <MdChevronLeft /> Previous
                  </button>
                  <button 
                    className="btn-pagination" 
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage(prev => Math.min(prev + 1, pagination.totalPages))}
                  >
                    Next <MdChevronRight />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedClass ? 'Edit Class' : 'Add New Class'}</h2>
              <button className="btn-close" onClick={closeModal} aria-label="Close modal">
                <MdClose />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name">Class Name <span className="required">*</span></label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="e.g. Class 8, Hifz Year 1"
                      required
                    />
                    {formErrors.name && <small className="error-text">{formErrors.name}</small>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="section">Section / Group</label>
                    <input
                      type="text"
                      id="section"
                      name="section"
                      value={formData.section}
                      onChange={handleInputChange}
                      placeholder="e.g. A, B, Boys"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="code">Class Code <span className="required">*</span></label>
                    <input
                      type="text"
                      id="code"
                      name="code"
                      value={formData.code}
                      onChange={handleInputChange}
                      placeholder="e.g. CLS-08-A"
                      required
                    />
                    <small className="help-text">Auto-generated or custom prefix code</small>
                    {formErrors.code && <small className="error-text">{formErrors.code}</small>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="capacity">Capacity <span className="required">*</span></label>
                    <input
                      type="number"
                      id="capacity"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleInputChange}
                      min="1"
                      required
                    />
                    {formErrors.capacity && <small className="error-text">{formErrors.capacity}</small>}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="teacher">Assigned Teacher</label>
                  <input
                    type="text"
                    id="teacher"
                    name="teacher"
                    value={formData.teacher}
                    onChange={handleInputChange}
                    placeholder="Enter teacher name (optional)"
                  />
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={closeModal} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : selectedClass ? 'Update Class' : 'Add Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="modal-overlay delete-modal-overlay" onClick={closeModal}>
          <div className="modal-content delete-modal fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="delete-modal-icon">
              <MdWarning />
            </div>
            <h2>Delete or Archive Class</h2>
            <p>
              Are you sure you want to delete <strong>{selectedClass?.name} {selectedClass?.section}</strong>? 
              If historical records exist, it will be safely archived instead of deleted.
            </p>
            <div className="modal-footer justify-center">
              <button type="button" className="btn-outline" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-danger" 
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Confirm Delete / Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Courses;
