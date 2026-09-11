export const dashboardStats = {
  totalStudents: 342,
  totalStaff: 28,
  bankBalance: 485000,
  cashBalance: 32500,
  attendanceToday: 94.2,
  attendanceChange: +2.1,
  studentsChange: +12,
  newAdmissions: 5,
  pendingFees: 125000,
  booksIssued: 18,
  booksOverdue: 3,
  hostelOccupancy: 87,
  maintenanceRequests: 4,
};

export const attendanceData = [
  { day: 'Mon', present: 312, absent: 30, percentage: 91.2 },
  { day: 'Tue', present: 320, absent: 22, percentage: 93.6 },
  { day: 'Wed', present: 318, absent: 24, percentage: 93.0 },
  { day: 'Thu', present: 325, absent: 17, percentage: 95.0 },
  { day: 'Fri', present: 308, absent: 34, percentage: 90.1 },
  { day: 'Sat', present: 328, absent: 14, percentage: 95.9 },
  { day: 'Sun', present: 322, absent: 20, percentage: 94.2 },
];

export const financeData = [
  { month: 'Jan', income: 285000, expense: 192000 },
  { month: 'Feb', income: 312000, expense: 198000 },
  { month: 'Mar', income: 298000, expense: 215000 },
  { month: 'Apr', income: 340000, expense: 205000 },
  { month: 'May', income: 325000, expense: 225000 },
  { month: 'Jun', income: 368000, expense: 210000 },
];

export const recentActivities = [
  { id: 1, type: 'admission', message: 'New student Ahmed Raza admitted to Class 8', time: '10 min ago', icon: 'person_add' },
  { id: 2, type: 'payment', message: 'Fee payment of ₹15,000 received from Zaid Khan', time: '25 min ago', icon: 'payments' },
  { id: 3, type: 'attendance', message: 'Attendance marked for Class 10 - 32/35 present', time: '1 hour ago', icon: 'fact_check' },
  { id: 4, type: 'notice', message: 'Holiday notice posted for Eid-ul-Adha', time: '2 hours ago', icon: 'campaign' },
  { id: 5, type: 'library', message: 'Book "Sahih Bukhari Vol. 3" returned by Bilal Ahmad', time: '3 hours ago', icon: 'book' },
  { id: 6, type: 'expense', message: 'Kitchen expense ₹8,500 recorded for groceries', time: '4 hours ago', icon: 'restaurant' },
  { id: 7, type: 'exam', message: 'Exam schedule published for Mid-Term 2024', time: '5 hours ago', icon: 'assignment' },
  { id: 8, type: 'hostel', message: 'Room 204 maintenance request: Fan repair', time: '6 hours ago', icon: 'apartment' },
];

export const todayMenu = {
  breakfast: 'Paratha, Chai, Boiled Eggs',
  lunch: 'Chicken Biryani, Raita, Salad',
  dinner: 'Roti, Dal Makhani, Mixed Vegetable',
};

export const quickActions = [
  { id: 1, label: 'Add Student', icon: 'MdPersonAdd', color: '#009884', bgColor: 'rgba(0,152,132,0.08)' },
  { id: 2, label: 'Mark Attendance', icon: 'MdFactCheck', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.08)' },
  { id: 3, label: 'Record Payment', icon: 'MdPayments', color: '#10b981', bgColor: 'rgba(16,185,129,0.08)' },
  { id: 4, label: 'Post Notice', icon: 'MdCampaign', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)' },
  { id: 5, label: 'Issue Book', icon: 'MdMenuBook', color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.08)' },
  { id: 6, label: 'Generate Report', icon: 'MdAssessment', color: '#ec4899', bgColor: 'rgba(236,72,153,0.08)' },
];
