import toast from 'react-hot-toast';
import { useState } from 'react';
import {
  MdPersonAdd,
  MdFactCheck,
  MdPayments,
  MdCampaign,
  MdMenuBook,
  MdAssessment,
} from 'react-icons/md';
import { quickActions } from '../../data/mockData';

const iconMap = {
  MdPersonAdd,
  MdFactCheck,
  MdPayments,
  MdCampaign,
  MdMenuBook,
  MdAssessment,
};

function QuickActions() {
  const [ripple, setRipple] = useState(null);

  const handleClick = (action, e) => {
    // Ripple effect
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipple({ id: action.id, x, y });
    setTimeout(() => setRipple(null), 600);

    toast.success(`${action.label} — Coming soon!`, {
      style: {
        borderRadius: '8px',
        background: '#111827',
        color: '#f9fafb',
        fontSize: '14px',
      },
      iconTheme: {
        primary: action.color,
        secondary: '#ffffff',
      },
    });
  };

  return (
    <div className="actions-card">
      <div className="card-header">
        <span className="card-title">Quick Actions</span>
      </div>
      <div className="quick-actions-grid">
        {quickActions.map((action, index) => {
          const Icon = iconMap[action.icon] || MdPersonAdd;
          return (
            <button
              key={action.id}
              className="quick-action-btn"
              onClick={(e) => handleClick(action, e)}
              style={{ animationDelay: `${400 + index * 80}ms` }}
            >
              {/* Ripple */}
              {ripple && ripple.id === action.id && (
                <span
                  className="ripple-effect"
                  style={{ left: ripple.x, top: ripple.y }}
                />
              )}
              <div
                className="quick-action-icon"
                style={{ color: action.color, backgroundColor: action.bgColor }}
              >
                <Icon />
              </div>
              <span className="quick-action-label">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default QuickActions;
