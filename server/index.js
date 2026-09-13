/**
 * Altus Kairos — Express API Server
 * Madrasa Management System Backend
 * 
 * Serves both API routes and the production frontend build.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const studentRoutes = require('./src/routes/studentRoutes');
const classRoutes = require('./src/routes/classRoutes');
const customFieldRoutes = require('./src/routes/customFieldRoutes');
const exportRoutes = require('./src/routes/exportRoutes');
const importRoutes = require('./src/routes/importRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');
const authRoutes = require('./src/routes/authRoutes');
const institutionRoutes = require('./src/routes/institutionRoutes');
const academicYearRoutes = require('./src/routes/academicYearRoutes');
const devContext = require('./src/middleware/devContext');

// ── Initialize ──
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// ── Middleware ──
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// ── Make prisma available to routes ──
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// ── Dev Context Middleware ──
app.use(devContext);

// ── API Routes ──
app.use('/api/institution', institutionRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/custom-fields', customFieldRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/attendance', attendanceRoutes);

// ── Health Check ──
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      message: 'Altus Kairos API is running',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
    });
  }
});

// ── Serve Frontend (Production Build) ──
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

const errorHandler = require('./src/middleware/errorHandler');

// All non-API routes → serve index.html (SPA client-side routing)
app.get('/{*path}', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Global Error Handler ──
app.use(errorHandler);

// ── Start Server ──
async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected (Supabase PostgreSQL)');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Altus Kairos running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🌐 Network: http://0.0.0.0:${PORT}\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

start();

// ── Graceful shutdown ──
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
