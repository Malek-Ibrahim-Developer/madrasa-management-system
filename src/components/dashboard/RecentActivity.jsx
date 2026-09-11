import {
  MdPersonAdd,
  MdPayments,
  MdFactCheck,
  MdCampaign,
  MdMenuBook,
  MdRestaurant,
  MdAssignment,
  MdApartment,
} from 'react-icons/md';
import { recentActivities } from '../../data/mockData';

const typeColorMap = {
  admission:  '#009884',
  payment:    '#10b981',
  attendance: '#3b82f6',
  notice:     '#f59e0b',
  library:    '#8b5cf6',
  expense:    '#ec4899',
  exam:       '#6366f1',
  hostel:     '#f97316',
};

const typeBgMap = {
  admission:  'rgba(0,152,132,0.08)',
  payment:    'rgba(16,185,129,0.08)',
  attendance: 'rgba(59,130,246,0.08)',
  notice:     'rgba(245,158,11,0.08)',
  library:    'rgba(139,92,246,0.08)',
  expense:    'rgba(236,72,153,0.08)',
  exam:       'rgba(99,102,241,0.08)',
  hostel:     'rgba(249,115,22,0.08)',
};

const typeIconMap = {
  admission:  MdPersonAdd,
  payment:    MdPayments,
  attendance: MdFactCheck,
  notice:     MdCampaign,
  library:    MdMenuBook,
  expense:    MdRestaurant,
  exam:       MdAssignment,
  hostel:     MdApartment,
};

function RecentActivity() {
  return (
    <div className="activity-card">
      <div className="card-header">
        <span className="card-title">Recent Activity</span>
        <button className="view-all-btn">View All →</button>
      </div>
      <div className="activity-list">
        {recentActivities.map((activity, index) => {
          const Icon = typeIconMap[activity.type] || MdAssignment;
          const color = typeColorMap[activity.type] || '#6b7280';
          const bgColor = typeBgMap[activity.type] || 'rgba(107,114,128,0.08)';

          return (
            <div
              className="activity-item"
              key={activity.id}
              style={{
                animationDelay: `${300 + index * 60}ms`,
              }}
            >
              <div
                className="activity-icon"
                style={{ color, backgroundColor: bgColor }}
              >
                <Icon />
              </div>
              <div className="activity-content">
                <div className="activity-message">{activity.message}</div>
                <div className="activity-time">{activity.time}</div>
              </div>
              {/* Live pulse dot for recent items */}
              {index < 2 && (
                <div className="activity-live-dot" style={{ backgroundColor: color }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RecentActivity;
