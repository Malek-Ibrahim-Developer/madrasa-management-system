/**
 * API Service — Centralized backend API calls
 * Altus Kairos — Madrasa Management System
 */

const API_BASE = window.location.port === '5173'
  ? 'http://localhost:5000/api'  // Vite dev server → proxy to Express
  : '/api';                      // Production → same origin

/**
 * Generic fetch wrapper with error handling
 */
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    // Handle file downloads
    if (options.responseType === 'blob') {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Make sure the backend is running on port 5000.');
    }
    throw error;
  }
}

// ── Students API ──

export async function getStudents(params = {}, options = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.classId) query.set('classId', params.classId);
  if (params.status) query.set('status', params.status);
  if (params.gender) query.set('gender', params.gender);
  if (params.bloodGroup) query.set('bloodGroup', params.bloodGroup);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.ageMin) query.set('ageMin', params.ageMin);
  if (params.ageMax) query.set('ageMax', params.ageMax);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page) query.set('page', params.page);
  if (params.pageSize || params.limit) {
    const ps = params.pageSize || params.limit;
    query.set('pageSize', ps);
    query.set('limit', ps);
  }

  const queryString = query.toString();
  return apiCall(`/students${queryString ? `?${queryString}` : ''}`, options);
}

export async function getStudentById(id) {
  return apiCall(`/students/${id}`);
}

export async function createStudent(studentData) {
  return apiCall('/students', {
    method: 'POST',
    body: JSON.stringify(studentData),
  });
}

export async function updateStudent(id, studentData) {
  return apiCall(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(studentData),
  });
}

export async function deleteStudent(id) {
  return apiCall(`/students/${id}`, {
    method: 'DELETE',
  });
}

// ── Classes API ──

const getQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export async function getClasses(params = {}) {
  return apiCall(`/classes${getQueryString(params)}`);
}

export async function getClassById(id) {
  return apiCall(`/classes/${id}`);
}

export async function createClass(classData) {
  return apiCall('/classes', {
    method: 'POST',
    body: JSON.stringify(classData),
  });
}

export async function updateClass(id, classData) {
  return apiCall(`/classes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(classData),
  });
}

export async function updateClassStatus(id, status) {
  return apiCall(`/classes/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteClass(id) {
  return apiCall(`/classes/${id}`, {
    method: 'DELETE',
  });
}

// ── Attendance API ──

export async function getAttendance(classId, date) {
  const query = new URLSearchParams();
  if (classId) query.set('classId', classId);
  if (date) query.set('date', date);
  return apiCall(`/attendance?${query.toString()}`);
}

export async function markAttendance(attendanceData) {
  return apiCall('/attendance/mark', {
    method: 'POST',
    body: JSON.stringify(attendanceData),
  });
}

export async function getAttendanceStats(classId, month, year) {
  const query = new URLSearchParams();
  if (classId) query.set('classId', classId);
  if (month) query.set('month', month);
  if (year) query.set('year', year);
  return apiCall(`/attendance/stats?${query.toString()}`);
}

export async function getStudentAttendance(studentId, month, year) {
  const query = new URLSearchParams();
  if (month) query.set('month', month);
  if (year) query.set('year', year);
  return apiCall(`/attendance/student/${studentId}?${query.toString()}`);
}

export async function getAttendanceReport(classId, dateFrom, dateTo) {
  const query = new URLSearchParams();
  if (classId) query.set('classId', classId);
  if (dateFrom) query.set('dateFrom', dateFrom);
  if (dateTo) query.set('dateTo', dateTo);
  return apiCall(`/attendance/report?${query.toString()}`);
}

// ── Custom Fields API ──

export async function getCustomFields(activeOnly = false) {
  const query = activeOnly ? '?activeOnly=true' : '';
  return apiCall(`/custom-fields${query}`);
}

export async function createCustomField(fieldData) {
  return apiCall('/custom-fields', {
    method: 'POST',
    body: JSON.stringify(fieldData),
  });
}

export async function updateCustomField(id, fieldData) {
  return apiCall(`/custom-fields/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fieldData),
  });
}

export async function deleteCustomField(id) {
  return apiCall(`/custom-fields/${id}`, {
    method: 'DELETE',
  });
}

export async function reorderCustomFields(items) {
  return apiCall('/custom-fields/reorder/batch', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

// ── Export API ──

export async function exportStudentsExcel(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val) query.set(key, val);
  });
  const queryString = query.toString();
  return apiCall(`/export/students/excel${queryString ? `?${queryString}` : ''}`, {
    responseType: 'blob',
  });
}

export async function exportStudentsPDF(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val) query.set(key, val);
  });
  const queryString = query.toString();
  return apiCall(`/export/students/pdf${queryString ? `?${queryString}` : ''}`, {
    responseType: 'blob',
  });
}

// ── Import API ──

export async function downloadImportTemplate() {
  return apiCall('/import/template', { responseType: 'blob' });
}

export async function validateImport(formData) {
  const response = await fetch(`${API_BASE}/import/students/validate`, {
    method: 'POST',
    body: formData, // FormData — no Content-Type header (browser sets it with boundary)
  });
  return response.json();
}

export async function executeImport(validatedData) {
  return apiCall('/import/students/execute', {
    method: 'POST',
    body: JSON.stringify(validatedData),
  });
}

// ── Institution & Configuration API (Phase 1) ──

export async function getInstitutionProfile() {
  return apiCall('/institution/profile');
}

export async function updateInstitutionProfile(profileData) {
  return apiCall('/institution/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
}

export async function getInstitutionConfiguration() {
  return apiCall('/institution/configuration');
}

export async function updateInstitutionConfiguration(configData) {
  return apiCall('/institution/configuration', {
    method: 'PUT',
    body: JSON.stringify(configData),
  });
}

// ── Health Check ──

export async function healthCheck() {
  return apiCall('/health');
}
