import React, { useState, useEffect } from 'react';
import { 
  getCustomFields, 
  createCustomField, 
  updateCustomField, 
  deleteCustomField 
} from '../services/api';
import toast from 'react-hot-toast';
import { 
  MdAdd, 
  MdEdit, 
  MdDelete, 
  MdClose, 
  MdDragIndicator, 
  MdTextFields, 
  MdNumbers, 
  MdCalendarToday, 
  MdList, 
  MdCheckBox, 
  MdNotes, 
  MdWarning,
  MdToggleOn,
  MdToggleOff
} from 'react-icons/md';
import '../styles/custom-fields.css';

const FIELD_TYPES = [
  { value: 'TEXT', label: 'Short Text', icon: MdTextFields },
  { value: 'NUMBER', label: 'Number', icon: MdNumbers },
  { value: 'DATE', label: 'Date', icon: MdCalendarToday },
  { value: 'SELECT', label: 'Dropdown', icon: MdList },
  { value: 'CHECKBOX', label: 'Checkbox', icon: MdCheckBox },
  { value: 'TEXTAREA', label: 'Long Text', icon: MdNotes },
];

const SECTIONS = [
  { value: 'personal', label: 'Personal Information' },
  { value: 'contact', label: 'Contact Details' },
  { value: 'academic', label: 'Academic Record' },
  { value: 'custom', label: 'Custom Details' },
];

export default function CustomFieldsManager() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState({ isOpen: false, mode: 'add', field: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, field: null });
  
  const [formData, setFormData] = useState({
    name: '',
    fieldType: 'TEXT',
    section: 'custom',
    placeholder: '',
    isRequired: false,
    isActive: true,
    options: []
  });

  const [optionInput, setOptionInput] = useState('');

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const result = await getCustomFields();
      setFields(result?.data || []);
    } catch (error) {
      toast.error('Failed to load custom fields');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      fieldType: 'TEXT',
      section: 'custom',
      placeholder: '',
      isRequired: false,
      isActive: true,
      options: []
    });
    setOptionInput('');
    setModalState({ isOpen: true, mode: 'add', field: null });
  };

  const openEditModal = (field) => {
    let parsedOptions = field.options || [];
    if (typeof parsedOptions === 'string') {
      try { parsedOptions = JSON.parse(parsedOptions); } 
      catch (e) { parsedOptions = []; }
    }
    
    setFormData({
      name: field.name || '',
      fieldType: field.fieldType || 'TEXT',
      section: field.section || 'custom',
      placeholder: field.placeholder || '',
      isRequired: field.isRequired || false,
      isActive: field.isActive !== undefined ? field.isActive : true,
      options: Array.isArray(parsedOptions) ? parsedOptions : []
    });
    setOptionInput('');
    setModalState({ isOpen: true, mode: 'edit', field });
  };

  const closeModal = () => {
    setModalState({ isOpen: false, mode: 'add', field: null });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddOption = (e) => {
    if ((e.key === 'Enter' || e.type === 'blur') && optionInput.trim()) {
      e.preventDefault();
      const newOptions = optionInput.split(',').map(opt => opt.trim()).filter(opt => opt);
      setFormData(prev => ({
        ...prev,
        options: [...new Set([...prev.options, ...newOptions])]
      }));
      setOptionInput('');
    }
  };

  const removeOption = (optionToRemove) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter(opt => opt !== optionToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        fieldType: formData.fieldType,
        section: formData.section,
        placeholder: formData.placeholder,
        isRequired: formData.isRequired,
        isActive: formData.isActive,
        options: formData.fieldType === 'SELECT' ? formData.options : undefined
      };

      if (modalState.mode === 'add') {
        await createCustomField(payload);
        toast.success('Custom field created successfully');
      } else {
        await updateCustomField(modalState.field.id, payload);
        toast.success('Custom field updated successfully');
      }
      closeModal();
      fetchFields();
    } catch (error) {
      toast.error(modalState.mode === 'add' ? 'Failed to create field' : 'Failed to update field');
      console.error(error);
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteCustomField(deleteModal.field.id);
      toast.success('Field deleted successfully');
      setDeleteModal({ isOpen: false, field: null });
      fetchFields();
    } catch (error) {
      toast.error('Failed to delete field');
    }
  };

  const toggleFieldStatus = async (field) => {
    try {
      await updateCustomField(field.id, { isActive: !field.isActive });
      toast.success(`Field ${!field.isActive ? 'activated' : 'deactivated'}`);
      fetchFields();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getTypeIcon = (type) => {
    const typeObj = FIELD_TYPES.find(t => t.value === type);
    if (typeObj) {
      const Icon = typeObj.icon;
      return <Icon />;
    }
    return <MdTextFields />;
  };

  return (
    <div className="custom-fields-page">
      <div className="custom-fields-header">
        <div>
          <h1>Custom Fields</h1>
          <p>Create custom fields that appear on student forms and profiles</p>
        </div>
        <button className="btn-primary" onClick={openAddModal}>
          <MdAdd /> Add Field
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading custom fields...</div>
      ) : fields.length === 0 ? (
        <div className="empty-state">
          <MdTextFields className="empty-icon" />
          <h3>No Custom Fields Yet</h3>
          <p>Add custom fields to collect more information about your students.</p>
          <button className="btn-primary" onClick={openAddModal}>
            <MdAdd /> Add First Field
          </button>
        </div>
      ) : (
        <div className="fields-list">
          {fields.map((field, index) => (
            <div key={field.id || index} className="field-card">
              <div className="field-card-left">
                <MdDragIndicator className="drag-handle" />
                <div className="field-info">
                  <div className="field-name-row">
                    <h3>{field.name}</h3>
                    <span className={`field-type-badge type-${field.fieldType?.toLowerCase()}`}>
                      {getTypeIcon(field.fieldType)}
                      {field.fieldType}
                    </span>
                    {field.isRequired && <span className="field-required-badge">Required</span>}
                    <span className="field-section-badge">{field.section}</span>
                  </div>
                  <div className="field-key">Key: {field.fieldKey || field.name.toLowerCase().replace(/\s+/g, '_')}</div>
                </div>
              </div>
              <div className="field-actions">
                <div className="toggle-switch-wrapper" onClick={() => toggleFieldStatus(field)}>
                  <div className={`toggle-switch ${field.isActive ? 'active' : ''}`}>
                    <div className="toggle-knob"></div>
                  </div>
                </div>
                <button className="icon-btn edit-btn" onClick={() => openEditModal(field)} title="Edit Field">
                  <MdEdit />
                </button>
                <button className="icon-btn delete-btn" onClick={() => setDeleteModal({ isOpen: true, field })} title="Delete Field">
                  <MdDelete />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalState.isOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{modalState.mode === 'add' ? 'Add Custom Field' : 'Edit Custom Field'}</h2>
              <button className="close-btn" onClick={closeModal}><MdClose /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Field Name *</label>
                  <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    required 
                    placeholder="e.g. Blood Group"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Field Type</label>
                    <select name="fieldType" value={formData.fieldType} onChange={handleInputChange}>
                      {FIELD_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Section</label>
                    <select name="section" value={formData.section} onChange={handleInputChange}>
                      {SECTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Placeholder</label>
                  <input 
                    type="text" 
                    name="placeholder" 
                    value={formData.placeholder} 
                    onChange={handleInputChange} 
                    placeholder="Hint text for the input"
                  />
                </div>

                {formData.fieldType === 'SELECT' && (
                  <div className="form-group">
                    <label>Options (comma separated or press Enter)</label>
                    <div className="options-input-area">
                      {formData.options.map((opt, i) => (
                        <div key={i} className="option-chip">
                          {opt}
                          <button type="button" onClick={() => removeOption(opt)}><MdClose /></button>
                        </div>
                      ))}
                      <input 
                        type="text" 
                        value={optionInput}
                        onChange={(e) => setOptionInput(e.target.value)}
                        onKeyDown={handleAddOption}
                        onBlur={handleAddOption}
                        placeholder="Add option..."
                      />
                    </div>
                  </div>
                )}

                <div className="form-group checkbox-group">
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      name="isRequired" 
                      checked={formData.isRequired} 
                      onChange={handleInputChange} 
                      style={{ width: 'auto' }}
                    />
                    Required Field
                  </label>
                </div>

                <div className="field-preview-section">
                  <h4>Preview</h4>
                  <div className="field-preview">
                    <label>
                      {formData.name || 'Field Name'}
                      {formData.isRequired && <span className="req">*</span>}
                    </label>
                    {formData.fieldType === 'TEXT' && <input type="text" placeholder={formData.placeholder || 'Placeholder'} disabled />}
                    {formData.fieldType === 'NUMBER' && <input type="number" placeholder={formData.placeholder || 'Placeholder'} disabled />}
                    {formData.fieldType === 'DATE' && <input type="date" disabled />}
                    {formData.fieldType === 'TEXTAREA' && <textarea placeholder={formData.placeholder || 'Placeholder'} disabled rows="3" />}
                    {formData.fieldType === 'CHECKBOX' && (
                      <div className="preview-checkbox">
                        <input type="checkbox" disabled /> <span>Check me</span>
                      </div>
                    )}
                    {formData.fieldType === 'SELECT' && (
                      <select disabled>
                        <option>{formData.placeholder || 'Select an option'}</option>
                        {formData.options.map((opt, i) => <option key={i}>{opt}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary">
                  {modalState.mode === 'add' ? 'Create Field' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal delete-modal">
            <div className="modal-body text-center">
              <MdWarning className="warning-icon" />
              <h3>Delete Custom Field?</h3>
              <p>Are you sure you want to delete the field <strong>{deleteModal.field?.name}</strong>? This action cannot be undone and might affect existing student data.</p>
            </div>
            <div className="modal-footer justify-center">
              <button className="btn-secondary" onClick={() => setDeleteModal({ isOpen: false, field: null })}>Cancel</button>
              <button className="btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
