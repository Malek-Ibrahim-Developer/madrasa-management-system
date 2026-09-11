const express = require('express');
const router = express.Router();

/**
 * Helper to get the start of a day
 */
const getStartOfDay = (dateString) => {
  const d = new Date(dateString);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Helper to get the end of a day
 */
const getEndOfDay = (dateString) => {
  const d = new Date(dateString);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

/**
 * 1. GET /api/attendance
 * Fetch attendance records for a specific class and date.
 */
router.get('/', async (req, res) => {
  try {
    const { classId, date } = req.query;

    if (!classId || !date) {
      return res.status(400).json({ success: false, message: 'classId and date are required' });
    }

    const startOfDay = getStartOfDay(date);
    const endOfDay = getEndOfDay(date);

    // Fetch the class to get its name
    const classRecord = await req.prisma.class.findUnique({
      where: { id: classId },
      select: { name: true }
    });

    if (!classRecord) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // Fetch all students with active enrollment in this class for current academic year
    const students = await req.prisma.student.findMany({
      where: {
        enrollments: {
          some: {
            classId,
            status: 'ACTIVE',
            academicYear: { isCurrent: true },
          },
        },
      },
      select: { id: true, firstName: true, lastName: true, admissionNo: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    });

    // Fetch existing attendance records for the given date
    const attendances = await req.prisma.attendance.findMany({
      where: {
        classId,
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    const attendanceMap = new Map();
    attendances.forEach(a => attendanceMap.set(a.studentId, a));

    // Combine students with attendance records
    const records = students.map(student => {
      const record = attendanceMap.get(student.id);
      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo,
        status: record ? record.status : null,
        remarks: record ? record.remarks : null,
        id: record ? record.id : null
      };
    });

    const markedCount = records.filter(r => r.status !== null).length;

    return res.json({
      success: true,
      data: {
        date,
        classId,
        className: classRecord.name,
        totalStudents: students.length,
        markedCount,
        records
      }
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch attendance records' });
  }
});

/**
 * 2. POST /api/attendance/mark
 * Bulk mark/update attendance for a class on a date.
 */
router.post('/mark', async (req, res) => {
  try {
    const { classId, date, records } = req.body;

    if (!classId || !date || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'classId, date, and records array are required' });
    }

    const attendanceDate = getStartOfDay(date);

    // Upsert using Prisma transaction
    const upsertOperations = records.map(record => {
      return req.prisma.attendance.upsert({
        where: {
          studentId_date: {
            studentId: record.studentId,
            date: attendanceDate
          }
        },
        update: {
          status: record.status,
          remarks: record.remarks || null
        },
        create: {
          date: attendanceDate,
          status: record.status,
          remarks: record.remarks || null,
          studentId: record.studentId,
          classId
        }
      });
    });

    await req.prisma.$transaction(upsertOperations);

    return res.json({
      success: true,
      message: 'Attendance marked successfully'
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark attendance' });
  }
});

/**
 * 3. GET /api/attendance/stats
 * Get attendance statistics for a class over a month.
 */
router.get('/stats', async (req, res) => {
  try {
    let { classId, month, year } = req.query;

    if (!classId || !month || !year) {
      return res.status(400).json({ success: false, message: 'classId, month, and year are required' });
    }

    month = parseInt(month, 10);
    year = parseInt(year, 10);

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const classRecord = await req.prisma.class.findUnique({
      where: { id: classId },
      select: { name: true }
    });

    if (!classRecord) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const totalStudents = await req.prisma.enrollment.count({
      where: {
        classId,
        status: 'ACTIVE',
        academicYear: { isCurrent: true },
      }
    });

    const attendances = await req.prisma.attendance.findMany({
      where: {
        classId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const dailyMap = new Map();

    attendances.forEach(record => {
      const day = record.date.toISOString().split('T')[0];
      if (!dailyMap.has(day)) {
        dailyMap.set(day, { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 });
      }
      const stats = dailyMap.get(day);
      if (record.status === 'PRESENT') stats.present++;
      else if (record.status === 'ABSENT') stats.absent++;
      else if (record.status === 'LATE') stats.late++;
      else if (record.status === 'EXCUSED') stats.excused++;
    });

    const dailyStats = [];
    let totalWorkingDays = 0;
    let sumPercentage = 0;

    dailyMap.forEach((stats, dateStr) => {
      const marked = stats.present + stats.absent + stats.late + stats.excused;
      stats.unmarked = totalStudents - marked;
      
      const percentage = totalStudents > 0 
        ? ((stats.present + stats.late + stats.excused) / totalStudents) * 100 
        : 0;
      
      stats.percentage = parseFloat(percentage.toFixed(1));
      
      dailyStats.push({ date: dateStr, ...stats });
      
      totalWorkingDays++;
      sumPercentage += stats.percentage;
    });

    dailyStats.sort((a, b) => new Date(a.date) - new Date(b.date));

    const averageAttendance = totalWorkingDays > 0 
      ? parseFloat((sumPercentage / totalWorkingDays).toFixed(1)) 
      : 0;

    return res.json({
      success: true,
      data: {
        className: classRecord.name,
        month,
        year,
        totalStudents,
        totalWorkingDays,
        averageAttendance,
        dailyStats
      }
    });
  } catch (error) {
    console.error('Error fetching attendance stats:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch attendance statistics' });
  }
});

/**
 * 4. GET /api/attendance/student/:studentId
 * Get attendance history for a specific student.
 */
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    let { month, year } = req.query;

    const now = new Date();
    month = month ? parseInt(month, 10) : now.getUTCMonth() + 1;
    year = year ? parseInt(year, 10) : now.getUTCFullYear();

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const records = await req.prisma.attendance.findMany({
      where: {
        studentId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    });

    const stats = { present: 0, absent: 0, late: 0, excused: 0 };
    records.forEach(r => {
      if (r.status === 'PRESENT') stats.present++;
      else if (r.status === 'ABSENT') stats.absent++;
      else if (r.status === 'LATE') stats.late++;
      else if (r.status === 'EXCUSED') stats.excused++;
    });

    const totalDays = records.length;
    const percentage = totalDays > 0 
      ? parseFloat((((stats.present + stats.late + stats.excused) / totalDays) * 100).toFixed(1))
      : 0;

    return res.json({
      success: true,
      data: {
        studentId,
        month,
        year,
        stats: {
          ...stats,
          totalDays,
          percentage
        },
        records
      }
    });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch student attendance' });
  }
});

/**
 * 5. GET /api/attendance/report
 * Get detailed attendance report for a class over a date range.
 */
router.get('/report', async (req, res) => {
  try {
    const { classId, dateFrom, dateTo } = req.query;

    if (!classId || !dateFrom || !dateTo) {
      return res.status(400).json({ success: false, message: 'classId, dateFrom, and dateTo are required' });
    }

    const startDate = getStartOfDay(dateFrom);
    const endDate = getEndOfDay(dateTo);

    // Fetch students
    const students = await req.prisma.student.findMany({
      where: { classId },
      select: { id: true, firstName: true, lastName: true, admissionNo: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    });

    // Fetch all attendances for the range
    const attendances = await req.prisma.attendance.findMany({
      where: {
        classId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const studentMap = new Map();
    students.forEach(s => {
      studentMap.set(s.id, {
        studentId: s.id,
        studentName: `${s.firstName} ${s.lastName}`.trim(),
        admissionNo: s.admissionNo,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0
      });
    });

    attendances.forEach(r => {
      if (studentMap.has(r.studentId)) {
        const stats = studentMap.get(r.studentId);
        if (r.status === 'PRESENT') stats.present++;
        else if (r.status === 'ABSENT') stats.absent++;
        else if (r.status === 'LATE') stats.late++;
        else if (r.status === 'EXCUSED') stats.excused++;
        stats.total++;
      }
    });

    const report = Array.from(studentMap.values()).map(stats => {
      const percentage = stats.total > 0
        ? parseFloat((((stats.present + stats.late + stats.excused) / stats.total) * 100).toFixed(1))
        : 0;
      
      return {
        ...stats,
        percentage
      };
    });

    return res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching attendance report:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch attendance report' });
  }
});

module.exports = router;
