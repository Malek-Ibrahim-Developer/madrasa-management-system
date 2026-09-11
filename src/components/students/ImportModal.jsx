import React, { useState, useRef } from 'react';
import { MdCloudUpload, MdFileDownload, MdCheckCircle, MdWarning, MdError, MdClose, MdArrowForward, MdArrowBack } from 'react-icons/md';
import toast from 'react-hot-toast';

const API_BASE = window.location.port === '5173' ? 'http://localhost:5000/api' : '/api';

const ImportModal = ({ isOpen, onClose, onImportComplete }) => {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(API_BASE + '/import/template');
      if (!response.ok) throw new Error('Failed to fetch template');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student_import_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const validateFile = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(API_BASE + '/import/students/validate', { 
        method: 'POST', 
        body: formData 
      });
      const result = await response.json();
      
      if (result.success) {
        setValidationResult(result.data);
        setStep(2);
      } else {
        toast.error(result.message || 'Validation failed');
      }
    } catch (error) {
      toast.error('An error occurred during validation');
    } finally {
      setIsUploading(false);
    }
  };

  const executeImport = async () => {
    if (!validationResult || validationResult.valid.length === 0) {
      toast.error('No valid rows to import');
      return;
    }
    
    setIsImporting(true);
    setStep(3);
    
    try {
      const response = await fetch(API_BASE + '/import/students/execute', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rows: validationResult.valid }) 
      });
      const result = await response.json();
      
      if (result.success) {
        setImportResult(result.data);
        if (onImportComplete) onImportComplete();
      } else {
        toast.error(result.message || 'Import failed');
        setStep(2); // Go back to validation step on failure
      }
    } catch (error) {
      toast.error('An error occurred during import');
      setStep(2);
    } finally {
      setIsImporting(false);
    }
  };

  const resetModal = () => {
    setStep(1);
    setFile(null);
    setValidationResult(null);
    setImportResult(null);
  };

  const closeAndReset = () => {
    resetModal();
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '8px',
        width: '100%', maxWidth: '700px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}>
        <div style={{ 
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #e3e8ec', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
            Import Students
          </h2>
          <button 
            onClick={closeAndReset}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '0.25rem' }}
          >
            <MdClose size={24} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* STEP 1: UPLOAD */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, color: '#4b5563' }}>Upload your Excel or CSV file to import students.</p>
                <button 
                  onClick={handleDownloadTemplate}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 1rem', backgroundColor: '#f8fafb', border: '1px solid #e3e8ec',
                    borderRadius: '6px', cursor: 'pointer', color: '#009884', fontWeight: 500
                  }}
                >
                  <MdFileDownload size={20} /> Template
                </button>
              </div>

              <div 
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #009884', borderRadius: '8px', padding: '3rem 1.5rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: '#f8fafb', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <MdCloudUpload size={48} color="#009884" style={{ marginBottom: '1rem' }} />
                {file ? (
                  <p style={{ margin: 0, fontWeight: 500, color: '#111827' }}>{file.name}</p>
                ) : (
                  <>
                    <p style={{ margin: 0, fontWeight: 500, color: '#111827' }}>Click to upload or drag and drop</p>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>.xlsx, .xls, .csv up to 5MB</p>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}

          {/* STEP 2: VALIDATE */}
          {step === 2 && validationResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ flex: 1, padding: '1rem', backgroundColor: '#f8fafb', borderRadius: '6px', border: '1px solid #e3e8ec', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>{validationResult.summary.total}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Rows</div>
                </div>
                <div style={{ flex: 1, padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#10b981' }}>{validationResult.summary.valid}</div>
                  <div style={{ fontSize: '0.875rem', color: '#059669' }}>Valid</div>
                </div>
                <div style={{ flex: 1, padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ef4444' }}>{validationResult.summary.errors}</div>
                  <div style={{ fontSize: '0.875rem', color: '#b91c1c' }}>Errors</div>
                </div>
              </div>

              {validationResult.errors.length > 0 && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MdError /> Error Details
                  </h4>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {validationResult.errors.slice(0, 10).map((err, idx) => (
                      <div key={idx} style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#7f1d1d' }}>
                        <strong>Row {err.rowNumber}:</strong> {err.issues.join(', ')}
                      </div>
                    ))}
                    {validationResult.errors.length > 10 && (
                      <div style={{ fontSize: '0.875rem', color: '#7f1d1d', fontStyle: 'italic' }}>
                        ...and {validationResult.errors.length - 10} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: IMPORT RESULT */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0' }}>
              {isImporting ? (
                <>
                  <div style={{ 
                    width: '40px', height: '40px', border: '3px solid #f3f3f3', 
                    borderTop: '3px solid #009884', borderRadius: '50%', 
                    animation: 'spin 1s linear infinite', marginBottom: '1rem'
                  }} />
                  <p style={{ margin: 0, fontWeight: 500, color: '#4b5563' }}>Importing data, please wait...</p>
                  <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </>
              ) : importResult ? (
                <>
                  <MdCheckCircle size={64} color="#10b981" style={{ marginBottom: '1rem' }} />
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: '#111827' }}>Import Complete</h3>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#10b981' }}>{importResult.imported}</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Successfully Imported</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ef4444' }}>{importResult.skipped}</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Skipped (Errors)</div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>

        <div style={{ 
          padding: '1rem 1.5rem', borderTop: '1px solid #e3e8ec', backgroundColor: '#f8fafb',
          display: 'flex', justifyContent: 'flex-end', gap: '1rem'
        }}>
          <button 
            onClick={closeAndReset}
            style={{ 
              padding: '0.5rem 1rem', backgroundColor: 'transparent', border: '1px solid #d1d5db',
              borderRadius: '6px', cursor: 'pointer', fontWeight: 500, color: '#374151'
            }}
            disabled={isUploading || isImporting}
          >
            {step === 3 && !isImporting ? 'Close' : 'Cancel'}
          </button>
          
          {step === 1 && (
            <button 
              onClick={validateFile}
              disabled={!file || isUploading}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1.25rem', backgroundColor: '#009884', border: 'none',
                borderRadius: '6px', cursor: (file && !isUploading) ? 'pointer' : 'not-allowed', 
                fontWeight: 500, color: '#fff', opacity: (!file || isUploading) ? 0.7 : 1
              }}
            >
              {isUploading ? 'Validating...' : 'Next'} <MdArrowForward />
            </button>
          )}

          {step === 2 && (
            <>
              <button 
                onClick={() => setStep(1)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 1rem', backgroundColor: 'transparent', border: 'none',
                  cursor: 'pointer', fontWeight: 500, color: '#6b7280', marginRight: 'auto'
                }}
              >
                <MdArrowBack /> Back
              </button>
              <button 
                onClick={executeImport}
                disabled={validationResult?.valid.length === 0}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 1.25rem', backgroundColor: '#009884', border: 'none',
                  borderRadius: '6px', cursor: validationResult?.valid.length > 0 ? 'pointer' : 'not-allowed', 
                  fontWeight: 500, color: '#fff', opacity: validationResult?.valid.length > 0 ? 1 : 0.7
                }}
              >
                Start Import
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
