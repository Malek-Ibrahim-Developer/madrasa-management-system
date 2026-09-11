import {
  MdPeople,
  MdBadge,
  MdAccountBalance,
  MdFactCheck,
  MdMenuBook,
  MdRestaurant,
  MdApartment,
} from 'react-icons/md';

import { dashboardStats, todayMenu } from '../data/mockData';
import StatsCard from '../components/dashboard/StatsCard';
import AttendanceChart from '../components/dashboard/AttendanceChart';
import FinanceSummary from '../components/dashboard/FinanceSummary';
import RecentActivity from '../components/dashboard/RecentActivity';
import QuickActions from '../components/dashboard/QuickActions';
import '../styles/dashboard.css';

function Dashboard() {
  // Auth will be implemented later — using hardcoded name for now
  const firstName = 'Ibrahim';

  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const stats = [
    {
      icon: MdPeople,
      label: 'Total Students',
      value: dashboardStats.totalStudents,
      trend: dashboardStats.studentsChange,
      trendDirection: 'up',
      color: '#009884',
      bgColor: 'rgba(0,152,132,0.08)',
    },
    {
      icon: MdBadge,
      label: 'Total Staff',
      value: dashboardStats.totalStaff,
      trend: null,
      trendDirection: null,
      color: '#3b82f6',
      bgColor: 'rgba(59,130,246,0.08)',
    },
    {
      icon: MdAccountBalance,
      label: 'Bank Balance',
      value: `₹${dashboardStats.bankBalance.toLocaleString('en-IN')}`,
      trend: null,
      trendDirection: null,
      color: '#10b981',
      bgColor: 'rgba(16,185,129,0.08)',
    },
    {
      icon: MdFactCheck,
      label: "Today's Attendance",
      value: `${dashboardStats.attendanceToday}%`,
      trend: `${dashboardStats.attendanceChange}%`,
      trendDirection: 'up',
      color: '#f59e0b',
      bgColor: 'rgba(245,158,11,0.08)',
    },
  ];

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <div className="dashboard-header">
        <h1>Welcome back, {firstName}!</h1>
        <p>{dateString} — Here&apos;s what&apos;s happening at your madrasa today.</p>
      </div>

      {/* ── Stats Row ── */}
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <StatsCard key={stat.label} index={index} {...stat} />
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="charts-grid">
        <AttendanceChart />
        <FinanceSummary />
      </div>

      {/* ── Activity + Quick Actions ── */}
      <div className="bottom-grid">
        <RecentActivity />
        <QuickActions />
      </div>

      {/* ── Module Summary Row ── */}
      <div className="module-summary-grid">
        {/* Library Card */}
        <div className="module-card">
          <div className="module-card-header">
            <div
              className="module-card-icon"
              style={{ color: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.08)' }}
            >
              <MdMenuBook />
            </div>
            <span className="module-card-title">Library</span>
          </div>
          <div className="module-detail">
            <span className="module-detail-label">Books Issued Today</span>
            <span className="module-detail-value">{dashboardStats.booksIssued}</span>
          </div>
          <div className="module-detail">
            <span className="module-detail-label">Overdue Returns</span>
            <span className="module-detail-value" style={{ color: '#ef4444' }}>
              {dashboardStats.booksOverdue}
            </span>
          </div>
          <div className="module-detail">
            <span className="module-detail-label">New Admissions</span>
            <span className="module-detail-value">{dashboardStats.newAdmissions}</span>
          </div>
        </div>

        {/* Kitchen / Menu Card */}
        <div className="module-card">
          <div className="module-card-header">
            <div
              className="module-card-icon"
              style={{ color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)' }}
            >
              <MdRestaurant />
            </div>
            <span className="module-card-title">Today&apos;s Menu</span>
          </div>
          <div className="module-detail">
            <span className="module-detail-label">Breakfast</span>
            <span className="module-detail-value">{todayMenu.breakfast}</span>
          </div>
          <div className="module-detail">
            <span className="module-detail-label">Lunch</span>
            <span className="module-detail-value">{todayMenu.lunch}</span>
          </div>
          <div className="module-detail">
            <span className="module-detail-label">Dinner</span>
            <span className="module-detail-value">{todayMenu.dinner}</span>
          </div>
        </div>

        {/* Hostel Card */}
        <div className="module-card">
          <div className="module-card-header">
            <div
              className="module-card-icon"
              style={{ color: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)' }}
            >
              <MdApartment />
            </div>
            <span className="module-card-title">Hostel</span>
          </div>
          <div className="module-detail">
            <span className="module-detail-label">Occupancy Rate</span>
            <span className="module-detail-value">{dashboardStats.hostelOccupancy}%</span>
          </div>
          <div className="module-detail">
            <span className="module-detail-label">Maintenance Requests</span>
            <span className="module-detail-value" style={{ color: '#f59e0b' }}>
              {dashboardStats.maintenanceRequests}
            </span>
          </div>
          <div className="module-detail">
            <span className="module-detail-label">Pending Fees</span>
            <span className="module-detail-value">
              ₹{dashboardStats.pendingFees.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
