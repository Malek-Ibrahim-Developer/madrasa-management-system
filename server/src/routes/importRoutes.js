const express = require('express');
const router = express.Router();
const multer = require('multer');
const exceljs = require('exceljs');
const { parse } = require('csv-parse/sync');

const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 5 * 1024 * 1024 } 
});

router.get('/template', async (req, res) => {
  try {
    const workbook = new exceljs.Workbook();
    
    // Sheet 1: Template
    const sheet = workbook.addWorksheet('Student Import Template');
    
    const standardColumns = [
      { header: 'Admission No*', key: 'admissionNo', width: 20 },
      { header: 'First Name*', key: 'firstName', width: 20 },
      { header: 'Last Name*', key: 'lastName', width: 20 },
      { header: 'Father Name', key: 'fatherName', width: 20 },
      { header: 'Mother Name', key: 'motherName', width: 20 },
      { header: 'Gender (MALE/FEMALE/OTHER)', key: 'gender', width: 25 },
      { header: 'Date of Birth (YYYY-MM-DD)', key: 'dateOfBirth', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Class Code', key: 'classCode', width: 15 },
      { header: 'Status (ACTIVE/INACTIVE)', key: 'status', width: 25 },
      { header: 'Guardian Name', key: 'guardianName', width: 20 },
      { header: 'Guardian Phone', key: 'guardianPhone', width: 15 },
      { header: 'Guardian Email', key: 'guardianEmail', width: 25 },
      { header: 'Guardian Relation', key: 'guardianRelation', width: 20 },
      { header: 'Blood Group', key: 'bloodGroup', width: 15 },
      { header: 'Nationality', key: 'nationality', width: 15 },
      { header: 'ID Number', key: 'idNumber', width: 20 },
      { header: 'Previous School', key: 'previousSchool', width: 25 },
      { header: 'Emergency Contact', key: 'emergencyContact', width: 20 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Medical Notes', key: 'medicalNotes', width: 30 },
    ];
    
    let customFields = [];
    if (req.prisma.customField) {
      customFields = await req.prisma.customField.findMany({
        where: { isActive: true, entityType: 'STUDENT' }
      });
      
      customFields.forEach(cf => {
        standardColumns.push({ header: `CF:${cf.name}${cf.isRequired ? '*' : ''}`, key: `cf_${cf.id}`, width: 20 });
      });
    }

    sheet.columns = standardColumns;
    
    // Data validation (Gender & Status)
    for (let i = 2; i <= 1000; i++) {
        sheet.getCell(`F${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"MALE,FEMALE,OTHER"']
        };
        sheet.getCell(`K${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"ACTIVE,INACTIVE"']
        };
    }
    
    // Sheet 2: Instructions
    const instructions = workbook.addWorksheet('Instructions');
    instructions.addRow(['Student Import Instructions']);
    instructions.addRow(['1. Do not change the column headers in the template.']);
    instructions.addRow(['2. Columns marked with * are required.']);
    instructions.addRow(['3. Gender must be one of: MALE, FEMALE, OTHER']);
    instructions.addRow(['4. Status must be one of: ACTIVE, INACTIVE']);
    instructions.addRow(['5. Date of Birth must be in YYYY-MM-DD format']);
    instructions.addRow(['6. Class Code must match an existing class code in the system.']);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=student_import_template.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
});

router.post('/students/validate', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const filename = req.file.originalname.toLowerCase();
    let rows = [];
    
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const workbook = new exceljs.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const sheet = workbook.getWorksheet(1);
      
      let headers = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell((cell, colNumber) => {
            headers[colNumber] = cell.value;
          });
        } else {
          let rowData = {};
          row.eachCell((cell, colNumber) => {
            rowData[headers[colNumber]] = cell.value;
          });
          rows.push({ rowNumber, data: rowData });
        }
      });
    } else if (filename.endsWith('.csv')) {
      const csvData = req.file.buffer.toString('utf-8');
      const records = parse(csvData, { columns: true, skip_empty_lines: true });
      records.forEach((record, index) => {
        rows.push({ rowNumber: index + 2, data: record });
      });
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported file format. Please upload .xlsx, .xls or .csv' });
    }
    
    const valid = [];
    const warnings = [];
    const errors = [];
    const existingAdmissionNos = new Set();
    const dbAdmissionNos = new Set();
    
    const students = await req.prisma.student.findMany({ select: { admissionNo: true } });
    students.forEach(s => dbAdmissionNos.add(s.admissionNo));
    
    const classes = await req.prisma.class.findMany({ select: { id: true, classCode: true } });
    const classCodeMap = new Map(classes.map(c => [c.classCode, c.id]));
    
    for (const r of rows) {
      const issues = [];
      let status = 'valid';
      
      const { data, rowNumber } = r;
      
      const admissionNo = data['Admission No*'] || data['Admission No'];
      const firstName = data['First Name*'] || data['First Name'];
      const lastName = data['Last Name*'] || data['Last Name'];
      const gender = data['Gender (MALE/FEMALE/OTHER)'];
      const statusField = data['Status (ACTIVE/INACTIVE)'];
      const classCode = data['Class Code'];
      
      if (!admissionNo) issues.push('Admission No is required');
      if (!firstName) issues.push('First Name is required');
      if (!lastName) issues.push('Last Name is required');
      
      if (admissionNo) {
        if (dbAdmissionNos.has(admissionNo.toString())) issues.push('Admission No already exists in database');
        if (existingAdmissionNos.has(admissionNo.toString())) issues.push('Duplicate Admission No in file');
        existingAdmissionNos.add(admissionNo.toString());
      }
      
      if (gender && !['MALE', 'FEMALE', 'OTHER'].includes(gender.toString().toUpperCase())) {
         issues.push('Invalid gender. Must be MALE, FEMALE, or OTHER');
      }
      
      if (statusField && !['ACTIVE', 'INACTIVE'].includes(statusField.toString().toUpperCase())) {
         issues.push('Invalid status. Must be ACTIVE or INACTIVE');
      }
      
      if (classCode && !classCodeMap.has(classCode.toString())) {
         issues.push(`Class Code '${classCode}' not found in system`);
      }
      
      const dob = data['Date of Birth (YYYY-MM-DD)'];
      if (dob && isNaN(Date.parse(dob))) {
          issues.push('Invalid Date of Birth format');
      }

      if (issues.length > 0) {
        status = 'error';
        errors.push({ rowNumber, data, status, issues });
      } else {
        valid.push({ rowNumber, data, status, issues });
      }
    }
    
    return res.json({
      success: true,
      data: {
        valid,
        warnings,
        errors,
        summary: { total: rows.length, valid: valid.length, warnings: warnings.length, errors: errors.length }
      }
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ success: false, message: 'Validation failed: ' + error.message });
  }
});

router.post('/students/execute', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    
    let imported = 0;
    let skipped = 0;
    const executionErrors = [];
    
    const classes = await req.prisma.class.findMany({ select: { id: true, classCode: true } });
    const classCodeMap = new Map(classes.map(c => [c.classCode, c.id]));

    // Check if any row has a mapped class
    const hasMappedClasses = rows.some(r => {
      const code = r.data['Class Code'];
      return code && classCodeMap.has(code.toString());
    });

    let activeAcademicYear = null;
    if (hasMappedClasses) {
      activeAcademicYear = await req.prisma.academicYear.findFirst({ where: { isCurrent: true } });
      if (!activeAcademicYear) {
        return res.status(400).json({
          success: false,
          message: 'No active academic year found. An active academic year is required for importing students with class assignments.',
        });
      }
    }

    await req.prisma.$transaction(async (tx) => {
      for (const r of rows) {
        try {
          const { data, rowNumber } = r;
          const admissionNo = data['Admission No*'] || data['Admission No'];
          const classCode = data['Class Code'];
          const classId = classCode ? classCodeMap.get(classCode.toString()) : null;
          
          const student = await tx.student.create({
            data: {
              admissionNo: admissionNo.toString(),
              firstName: (data['First Name*'] || data['First Name']).toString(),
              lastName: (data['Last Name*'] || data['Last Name']).toString(),
              fatherName: data['Father Name'] ? data['Father Name'].toString() : null,
              motherName: data['Mother Name'] ? data['Mother Name'].toString() : null,
              gender: data['Gender (MALE/FEMALE/OTHER)'] ? data['Gender (MALE/FEMALE/OTHER)'].toString().toUpperCase() : 'OTHER',
              dateOfBirth: data['Date of Birth (YYYY-MM-DD)'] ? new Date(data['Date of Birth (YYYY-MM-DD)']) : null,
              phone: data['Phone'] ? data['Phone'].toString() : null,
              email: data['Email'] ? data['Email'].toString() : null,
              status: data['Status (ACTIVE/INACTIVE)'] ? data['Status (ACTIVE/INACTIVE)'].toString().toUpperCase() : 'ACTIVE',
              classId: classId || null,
              guardianName: data['Guardian Name'] ? data['Guardian Name'].toString() : null,
              guardianPhone: data['Guardian Phone'] ? data['Guardian Phone'].toString() : null,
              guardianEmail: data['Guardian Email'] ? data['Guardian Email'].toString() : null,
              guardianRelation: data['Guardian Relation'] ? data['Guardian Relation'].toString() : null,
              bloodGroup: data['Blood Group'] ? data['Blood Group'].toString() : null,
              nationality: data['Nationality'] ? data['Nationality'].toString() : null,
              idNumber: data['ID Number'] ? data['ID Number'].toString() : null,
              previousSchool: data['Previous School'] ? data['Previous School'].toString() : null,
              emergencyContact: data['Emergency Contact'] ? data['Emergency Contact'].toString() : null,
              address: data['Address'] ? data['Address'].toString() : null,
              medicalNotes: data['Medical Notes'] ? data['Medical Notes'].toString() : null
            }
          });

          // If classId and activeAcademicYear are present, create active Enrollment
          if (classId && activeAcademicYear) {
            const activeCount = await tx.enrollment.count({
              where: { classId, status: 'ACTIVE' },
            });
            const targetClass = await tx.class.findUnique({ where: { id: classId } });
            if (targetClass && activeCount >= targetClass.capacity) {
              throw new Error(`Class capacity limit reached (${targetClass.capacity}) for class`);
            }

            await tx.enrollment.create({
              data: {
                studentId: student.id,
                classId,
                academicYearId: activeAcademicYear.id,
                status: 'ACTIVE',
              },
            });
          }

          imported++;
        } catch (err) {
          skipped++;
          executionErrors.push({ rowNumber: r.rowNumber, error: err.message });
        }
      }
    });

    res.json({
      success: true,
      data: {
        imported,
        skipped,
        errors: executionErrors
      }
    });
  } catch (error) {
    console.error('Execution error:', error);
    res.status(500).json({ success: false, message: 'Import execution failed: ' + error.message });
  }
});

module.exports = router;
