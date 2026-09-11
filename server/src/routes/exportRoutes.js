const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Helper to build where clause based on query params using Authoritative Enrollment
const buildWhereClause = (query) => {
  const { search, classId, status, gender, bloodGroup, dateFrom, dateTo } = query;
  const where = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { admissionNo: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (classId) {
    where.enrollments = {
      some: {
        classId: classId,
        status: 'ACTIVE',
        academicYear: { isCurrent: true },
      },
    };
  }

  if (status) {
    where.status = status;
  }

  if (gender) {
    where.gender = gender;
  }

  if (bloodGroup) {
    where.bloodGroup = bloodGroup;
  }

  if (dateFrom || dateTo) {
    where.admissionDate = {};
    if (dateFrom) {
      where.admissionDate.gte = new Date(dateFrom);
    }
    if (dateTo) {
      where.admissionDate.lte = new Date(dateTo);
    }
  }

  return where;
};

// Helper to format date
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// GET /api/export/students/excel
router.get('/students/excel', async (req, res) => {
  try {
    const where = buildWhereClause(req.query);

    // Fetch active custom fields
    const customFields = await req.prisma.customField.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Fetch students with active enrollment data
    const students = await req.prisma.student.findMany({
      where,
      include: {
        class: true,
        enrollments: {
          where: {
            status: 'ACTIVE',
            academicYear: { isCurrent: true },
          },
          include: { class: true },
          take: 1,
        },
        customFieldValues: {
          include: {
            customField: true,
          }
        }
      },
      orderBy: { admissionNo: 'asc' }
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Altus Kairos';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Students');

    // Define columns
    const columns = [
      { header: 'Admission No', key: 'admissionNo', width: 15 },
      { header: 'First Name', key: 'firstName', width: 20 },
      { header: 'Last Name', key: 'lastName', width: 20 },
      { header: 'Father Name', key: 'fatherName', width: 20 },
      { header: 'Mother Name', key: 'motherName', width: 20 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Date of Birth', key: 'dateOfBirth', width: 15 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Class', key: 'class', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Guardian Name', key: 'guardianName', width: 20 },
      { header: 'Guardian Phone', key: 'guardianPhone', width: 15 },
      { header: 'Blood Group', key: 'bloodGroup', width: 12 },
      { header: 'Nationality', key: 'nationality', width: 15 },
      { header: 'ID Number', key: 'idNumber', width: 20 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Admission Date', key: 'admissionDate', width: 15 },
    ];

    // Add custom field columns
    customFields.forEach(cf => {
      columns.push({
        header: cf.name,
        key: `cf_${cf.fieldKey}`,
        width: 20
      });
    });

    sheet.columns = columns;

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F5F3' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Add data rows
    students.forEach((student, index) => {
      const activeClass = student.enrollments?.[0]?.class || student.class;
      const className = activeClass ? (activeClass.name || activeClass.className || '') : '';

      const rowData = {
        admissionNo: student.admissionNo,
        firstName: student.firstName,
        lastName: student.lastName,
        fatherName: student.fatherName,
        motherName: student.motherName,
        gender: student.gender,
        dateOfBirth: formatDate(student.dateOfBirth),
        phone: student.phone,
        email: student.email,
        class: className,
        status: student.status,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        bloodGroup: student.bloodGroup,
        nationality: student.nationality,
        idNumber: student.idNumber,
        address: student.address,
        admissionDate: formatDate(student.admissionDate),
      };

      // Add custom field values
      if (student.customFieldValues) {
        student.customFieldValues.forEach(cfv => {
          rowData[`cf_${cfv.customField.fieldKey}`] = cfv.value;
        });
      }

      sheet.addRow(rowData);
    });

    // Fix the alternating color argb
    students.forEach((student, index) => {
      if (index % 2 === 1) { 
        const row = sheet.getRow(index + 2);
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFB' }
          };
        });
      }
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `students_export_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Export Excel Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate Excel file', error: error.message });
  }
});

// Helper function for PDF columns
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// GET /api/export/students/pdf
router.get('/students/pdf', async (req, res) => {
  try {
    const where = buildWhereClause(req.query);

    const students = await req.prisma.student.findMany({
      where,
      include: {
        class: true,
        enrollments: {
          where: {
            status: 'ACTIVE',
            academicYear: { isCurrent: true },
          },
          include: { class: true },
          take: 1,
        },
      },
      orderBy: { admissionNo: 'asc' }
    });

    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `students_export_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Title
    doc.fontSize(20).text('Altus Kairos - Student Report', { align: 'center' });
    doc.moveDown(0.5);

    // Subtitle
    let filterStr = [];
    if (req.query.classId) filterStr.push(`Class: ${req.query.classId}`);
    if (req.query.status) filterStr.push(`Status: ${req.query.status}`);
    const subtitle = `Export Date: ${formatDate(new Date())} | Filters: ${filterStr.length > 0 ? filterStr.join(', ') : 'None'}`;
    
    doc.fontSize(10).text(subtitle, { align: 'center' });
    doc.moveDown(2);

    // Table settings
    const tableTop = doc.y;
    const colWidths = [60, 140, 80, 120, 70, 60];
    const startX = 30;
    
    const drawRow = (y, cols, isHeader = false) => {
      doc.fontSize(isHeader ? 10 : 9).font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
      let currentX = startX;
      cols.forEach((col, i) => {
        doc.text(col, currentX, y, { width: colWidths[i], align: 'left' });
        currentX += colWidths[i] + 5;
      });
    };

    // Draw header
    drawRow(tableTop, ['Admission No', 'Name', 'Class', 'Father Name', 'Phone', 'Status'], true);
    
    // Draw line under header
    let currentY = tableTop + 15;
    doc.moveTo(startX, currentY).lineTo(startX + sum(colWidths) + (colWidths.length * 5), currentY).stroke();
    currentY += 10;

    // Draw rows
    const rowHeight = 20;
    students.forEach((student) => {
      if (currentY > doc.page.height - 50) {
        doc.addPage();
        currentY = 30;
        drawRow(currentY, ['Admission No', 'Name', 'Class', 'Father Name', 'Phone', 'Status'], true);
        currentY += 15;
        doc.moveTo(startX, currentY).lineTo(startX + sum(colWidths) + (colWidths.length * 5), currentY).stroke();
        currentY += 10;
      }

      const activeClass = student.enrollments?.[0]?.class || student.class;
      const className = activeClass ? (activeClass.name || activeClass.className || '') : '';

      const cols = [
        student.admissionNo || '',
        `${student.firstName} ${student.lastName}`,
        className,
        student.fatherName || '',
        student.phone || '',
        student.status || ''
      ];

      drawRow(currentY, cols);
      currentY += rowHeight;
    });

    doc.end();

  } catch (error) {
    console.error('Export PDF Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF file', error: error.message });
  }
});

module.exports = router;
