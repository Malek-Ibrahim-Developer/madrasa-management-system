/**
 * Attendance Routes — REST API endpoints for daily attendance, bulk marking,
 * monthly statistics, student history, and reports.
 * Refactored to delegate domain logic to attendanceService and use AppError.
 */

const express = require('express');
const router = express.Router();
const attendanceService = require('../services/attendanceService');
const { optionalAuth } = require('../middleware/authMiddleware');

/**
 * 1. GET /api/attendance
 * Fetch daily attendance records for a specific class and date.
 */
router.get('/', async (req, res, next) => {
  try {
    const { classId, date } = req.query;

    const result = await attendanceService.getDailyAttendance(req.prisma, {
      classId,
      date,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 2. POST /api/attendance/mark
 * Bulk mark/update/clear attendance for a class on a business date.
 */
router.post('/mark', optionalAuth, async (req, res, next) => {
  try {
    const { classId, date, records } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;

    const result = await attendanceService.markAttendance(req.prisma, {
      classId,
      date,
      records,
      actor: req.user || null,
      ipAddress,
      userAgent,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * 3. GET /api/attendance/stats
 * Get monthly attendance statistics for a class with date-aware denominators.
 */
router.get('/stats', async (req, res, next) => {
  try {
    const { classId, month, year } = req.query;

    const result = await attendanceService.getAttendanceStats(req.prisma, {
      classId,
      month,
      year,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 4. GET /api/attendance/student/:studentId
 * Get attendance history for a specific student.
 */
router.get('/student/:studentId', async (req, res, next) => {
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
          lte: endDate,
        },
      },
      include: {
        class: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
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
          percentage,
        },
        records,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 5. GET /api/attendance/report
 * Detailed attendance report for a class over a date range.
 */
router.get('/report', async (req, res, next) => {
  try {
    const { classId, dateFrom, dateTo } = req.query;

    const report = await attendanceService.getAttendanceReport(req.prisma, {
      classId,
      dateFrom,
      dateTo,
    });

    return res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
