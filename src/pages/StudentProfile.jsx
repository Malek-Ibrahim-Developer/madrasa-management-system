import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStudentById, getCustomFields } from '../services/api';
import { MdArrowBack, MdEdit, MdPictureAsPdf, MdPrint, MdConstruction, MdWarning } from 'react-icons/md';
import '../styles/student-profile.css';

const StudentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [student, setStudent] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    const fetchStudentData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getStudentById(id);
        if (!result?.data) {
          throw new Error('Student not found');
        }
        setStudent(result.data);
        
        try {
          const fieldsResult = await getCustomFields(true);
          setCustomFields(fieldsResult?.data || []);
        } catch (fieldError) {
          console.error("Error fetching custom fields", fieldError);
          setCustomFields([]);
        }
      } catch (err) {
        setError(err.message || 'Failed to load student profile');
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [id]);

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const renderValue = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    return value;
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-tabs"></div>
          <div className="skeleton-content">
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="profile-page">
        <button className="profile-back-btn" onClick={() => navigate('/students')}>
          <MdArrowBack /> Back to Students
        </button>
        <div className="profile-error">
          <MdWarning className="error-icon" />
          <h2>{error || 'Student not found'}</h2>
          <p>The student you are looking for does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const renderInfoTab = () => (
    <div className="info-grid">
      <div className="info-card">
        <h3 className="info-card-title">Personal Details</h3>
        <div className="info-row">
          <span className="info-label">First Name</span>
          <span className="info-value">{renderValue(student.firstName)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Last Name</span>
          <span className="info-value">{renderValue(student.lastName)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Father's Name</span>
          <span className="info-value">{renderValue(student.fatherName)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Mother's Name</span>
          <span className="info-value">{renderValue(student.motherName)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Date of Birth</span>
          <span className="info-value">{renderValue(student.dateOfBirth)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Gender</span>
          <span className="info-value">{renderValue(student.gender)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Blood Group</span>
          <span className="info-value">{renderValue(student.bloodGroup)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Nationality</span>
          <span className="info-value">{renderValue(student.nationality)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">ID Number</span>
          <span className="info-value">{renderValue(student.idNumber)}</span>
        </div>
      </div>

      <div className="info-card">
        <h3 className="info-card-title">Contact Information</h3>
        <div className="info-row">
          <span className="info-label">Phone</span>
          <span className="info-value">{renderValue(student.phone)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Email</span>
          <span className="info-value">{renderValue(student.email)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Address</span>
          <span className="info-value">{renderValue(student.address)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Emergency Contact</span>
          <span className="info-value">{renderValue(student.emergencyContact)}</span>
        </div>
      </div>

      <div className="info-card">
        <h3 className="info-card-title">Guardian Details</h3>
        <div className="info-row">
          <span className="info-label">Guardian Name</span>
          <span className="info-value">{renderValue(student.guardianName)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Relation</span>
          <span className="info-value">{renderValue(student.guardianRelation)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Guardian Phone</span>
          <span className="info-value">{renderValue(student.guardianPhone)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Guardian Email</span>
          <span className="info-value">{renderValue(student.guardianEmail)}</span>
        </div>
      </div>

      <div className="info-card">
        <h3 className="info-card-title">Academic Details</h3>
        <div className="info-row">
          <span className="info-label">Class</span>
          <span className="info-value">{renderValue(student.class?.name)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Admission No.</span>
          <span className="info-value">{renderValue(student.admissionNo)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Admission Date</span>
          <span className="info-value">{renderValue(student.admissionDate)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Previous School</span>
          <span className="info-value">{renderValue(student.previousSchool)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Status</span>
          <span className="info-value">{renderValue(student.status)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Medical Notes</span>
          <span className="info-value">{renderValue(student.medicalNotes)}</span>
        </div>
      </div>
    </div>
  );

  const renderCustomFieldsTab = () => {
    if (!customFields || customFields.length === 0) {
      return (
        <div className="coming-soon-tab">
          <p>No custom fields have been created yet</p>
        </div>
      );
    }
    
    // Group fields by section
    const groupedFields = customFields.reduce((acc, field) => {
      const section = field.section || 'Other';
      if (!acc[section]) acc[section] = [];
      acc[section].push(field);
      return acc;
    }, {});

    return (
      <div className="info-grid">
        {Object.entries(groupedFields).map(([section, fields]) => (
          <div key={section} className="info-card">
            <h3 className="info-card-title">{section.charAt(0).toUpperCase() + section.slice(1)} Fields</h3>
            {fields.map(field => (
              <div key={field.id} className="info-row">
                <span className="info-label">{field.name}</span>
                <span className="info-value">
                  {(() => {
                    const cfv = student.customFieldValues?.find(v => v.customFieldId === field.id);
                    return renderValue(cfv?.value);
                  })()}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderComingSoonTab = (title, description) => (
    <div className="coming-soon-tab">
      <MdConstruction className="coming-soon-icon" />
      <h3>Coming Soon</h3>
      <p>{description}</p>
    </div>
  );

  return (
    <div className="profile-page">
      <button className="profile-back-btn" onClick={() => navigate('/students')}>
        <MdArrowBack /> Back to Students
      </button>

      <div className="profile-header-card">
        <div className="profile-header-main">
          <div className="profile-avatar">
            {getInitials(student.firstName, student.lastName)}
          </div>
          <div className="profile-header-info">
            <h1 className="profile-name">{student.firstName} {student.lastName}</h1>
            <div className="profile-admission-no">ID: {student.admissionNo || student.id || 'N/A'}</div>
            <div className="profile-badges">
              {(() => {
                // TEMPORARY FALLBACK (Stage 1 Migration):
                // Prefers authoritative active Enrollment class data over legacy student.class relation.
                // TO BE REMOVED IN STAGE 2 when Student.classId relation is removed from Prisma schema.
                const activeClass = student.enrollments?.[0]?.class || student.class;
                return activeClass?.name ? <span className="badge badge-class">{activeClass.name}</span> : null;
              })()}
              <span className={`badge badge-status ${(student.status || 'active').toLowerCase()}`}>
                {student.status || 'Active'}
              </span>
            </div>
          </div>
        </div>
        <div className="profile-actions">
          <button className="btn-action edit" onClick={() => navigate(`/students?edit=${student.id}`)}>
            <MdEdit /> Edit Profile
          </button>
          <button className="btn-action outline">
            <MdPictureAsPdf /> Export PDF
          </button>
          <button className="btn-action outline">
            <MdPrint /> Print
          </button>
        </div>
      </div>

      <div className="profile-tabs-container">
        <div className="profile-tabs">
          <button 
            className={`profile-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Info
          </button>
          <button 
            className={`profile-tab ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            Custom Fields
          </button>
          <button 
            className={`profile-tab ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendance')}
          >
            Attendance
          </button>
          <button 
            className={`profile-tab ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            Results
          </button>
          <button 
            className={`profile-tab ${activeTab === 'fees' ? 'active' : ''}`}
            onClick={() => setActiveTab('fees')}
          >
            Fees
          </button>
        </div>
      </div>

      <div className="profile-tab-content">
        {activeTab === 'info' && renderInfoTab()}
        {activeTab === 'custom' && renderCustomFieldsTab()}
        {activeTab === 'attendance' && renderComingSoonTab('Attendance', 'Student attendance records will be displayed here.')}
        {activeTab === 'results' && renderComingSoonTab('Results', 'Student examination results and academic performance will be displayed here.')}
        {activeTab === 'fees' && renderComingSoonTab('Fees', 'Student fee payment history and pending dues will be displayed here.')}
      </div>
    </div>
  );
};

export default StudentProfile;
