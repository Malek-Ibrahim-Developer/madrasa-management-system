/**
 * Import Routes — CSV & Excel Student Data Import with Validation
 * Altus Kairos — Tenant & Relationship Integrity Hardening
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const exceljs = require('exceljs');
const { parse } = require('csv-parse/sync');

const requirePermission = require('../middleware/requirePermission');
const { requireInstitutionContext } = require('../middleware/institutionContext');
const requireModuleEnabled = require('../middleware/requireModuleEnabled');
const AppError = require('../utils/AppError');
const { getCurrentAcademicYear } = require('../services/academicYearService');

router.use(requireInstitutionContext);
router.use(requireModuleEnabled('studentsEnabled'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get('/template', requirePermission('students.view'), async (req, res, next) => {
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

    if (req.prisma.customField) {
      const customFields = await req.prisma.customField.findMany({
        where: {
          institutionId: req.institutionId,
          isActive: true,
        },
        orderBy: { sortOrder: 'asc' },
      });

      customFields.forEach((cf) => {
        standardColumns.push({ header: `CF:${cf.name}${cf.isRequired ? '*' : ''}`, key: `cf_${cf.id}`, width: 20 });
      });
    }

    sheet.columns = standardColumns;

    // Data validation (Gender & Status)
    for (let i = 2; i <= 1000; i++) {
      sheet.getCell(`F${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"MALE,FEMALE,OTHER"'],
      };
      sheet.getCell(`K${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"ACTIVE,INACTIVE"'],
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
    instructions.addRow(['6. Class Code must match an existing class code in the system for this institution.']);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=student_import_template.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

router.post('/students/validate', requirePermission('students.create'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'VALIDATION_ERROR');
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
      throw new AppError('Unsupported file format. Please upload .xlsx, .xls or .csv', 400, 'INVALID_FILE_TYPE');
    }

    const valid = [];
    const warnings = [];
    const errors = [];
    const existingAdmissionNos = new Set();
    const dbAdmissionNos = new Set();

    // Check admission numbers strictly for this institution
    const students = await req.prisma.student.findMany({
      where: { institutionId: req.institutionId },
      select: { admissionNo: true },
    });
    students.forEach((s) => dbAdmissionNos.add(s.admissionNo));

    // Check classes strictly for this institution
    const classes = await req.prisma.class.findMany({
      where: {
        academicYear: {
          institutionId: req.institutionId,
        },
      },
      select: { id: true, code: true },
    });
    const classCodeMap = new Map(classes.map((c) => [c.code, c.id]));

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
        if (dbAdmissionNos.has(admissionNo.toString())) issues.push('Admission No already exists in this institution');
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
        issues.push(`Class Code '${classCode}' not found in institution`);
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
        summary: { total: rows.length, valid: valid.length, warnings: warnings.length, errors: errors.length },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/students/execute', requirePermission('students.create'), async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) {
      throw new AppError('Invalid payload: rows array required', 400, 'VALIDATION_ERROR');
    }

    let imported = 0;
    let skipped = 0;
    const executionErrors = [];

    // Classes strictly for this institution
    const classes = await req.prisma.class.findMany({
      where: {
        academicYear: {
          institutionId: req.institutionId,
        },
      },
      select: { id: true, code: true, capacity: true },
    });
    const classCodeMap = new Map(classes.map((c) => [c.code, c]));

    const hasMappedClasses = rows.some((r) => {
      const code = r.data['Class Code'];
      return code && classCodeMap.has(code.toString());
    });

    let activeAcademicYear = null;
    if (hasMappedClasses) {
      activeAcademicYear = await getCurrentAcademicYear(req.prisma, req.institutionId);
    }

    await req.prisma.$transaction(async (tx) => {
      for (const r of rows) {
        try {
          const { data, rowNumber } = r;
          const admissionNo = (data['Admission No*'] || data['Admission No']).toString().trim();
          const classCode = data['Class Code'] ? data['Class Code'].toString().trim() : null;
          const targetClass = classCode ? classCodeMap.get(classCode) : null;
          const classId = targetClass ? targetClass.id : null;

          const student = await tx.student.create({
            data: {
              institutionId: req.institutionId,
              admissionNo,
              firstName: (data['First Name*'] || data['First Name']).toString().trim(),
              lastName: (data['Last Name*'] || data['Last Name']).toString().trim(),
              fatherName: data['Father Name'] ? data['Father Name'].toString().trim() : null,
              motherName: data['Mother Name'] ? data['Mother Name'].toString().trim() : null,
              gender: data['Gender (MALE/FEMALE/OTHER)'] ? data['Gender (MALE/FEMALE/OTHER)'].toString().toUpperCase() : 'OTHER',
              dateOfBirth: data['Date of Birth (YYYY-MM-DD)'] ? new Date(data['Date of Birth (YYYY-MM-DD)']) : null,
              phone: data['Phone'] ? data['Phone'].toString().trim() : null,
              email: data['Email'] ? data['Email'].toString().trim() : null,
              status: data['Status (ACTIVE/INACTIVE)'] ? data['Status (ACTIVE/INACTIVE)'].toString().toUpperCase() : 'ACTIVE',
              classId: classId || null,
              guardianName: data['Guardian Name'] ? data['Guardian Name'].toString().trim() : null,
              guardianPhone: data['Guardian Phone'] ? data['Guardian Phone'].toString().trim() : null,
              guardianEmail: data['Guardian Email'] ? data['Guardian Email'].toString().trim() : null,
              guardianRelation: data['Guardian Relation'] ? data['Guardian Relation'].toString().trim() : null,
              bloodGroup: data['Blood Group'] ? data['Blood Group'].toString().trim() : null,
              nationality: data['Nationality'] ? data['Nationality'].toString().trim() : 'Indian',
              idNumber: data['ID Number'] ? data['ID Number'].toString().trim() : null,
              previousSchool: data['Previous School'] ? data['Previous School'].toString().trim() : null,
              emergencyContact: data['Emergency Contact'] ? data['Emergency Contact'].toString().trim() : null,
              address: data['Address'] ? data['Address'].toString().trim() : null,
              medicalNotes: data['Medical Notes'] ? data['Medical Notes'].toString().trim() : null,
            },
          });

          if (classId && activeAcademicYear) {
            const activeCount = await tx.enrollment.count({
              where: { classId, status: 'ACTIVE' },
            });
            if (activeCount >= targetClass.capacity) {
              throw new Error(`Class capacity limit reached (${targetClass.capacity}) for ${classCode}`);
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
        errors: executionErrors,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
