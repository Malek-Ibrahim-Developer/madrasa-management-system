import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { attendanceData } from '../../data/mockData';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="custom-tooltip">
      <div className="custom-tooltip-label">{label}</div>
      <div className="custom-tooltip-row">
        <span
          className="custom-tooltip-dot"
          style={{ backgroundColor: '#009884' }}
        />
        <span className="custom-tooltip-value">
          {payload[0].value}% attendance
        </span>
      </div>
      {payload[0].payload && (
        <>
          <div className="custom-tooltip-row">
            <span
              className="custom-tooltip-dot"
              style={{ backgroundColor: '#10b981' }}
            />
            <span className="custom-tooltip-value">
              {payload[0].payload.present} present
            </span>
          </div>
          <div className="custom-tooltip-row">
            <span
              className="custom-tooltip-dot"
              style={{ backgroundColor: '#ef4444' }}
            />
            <span className="custom-tooltip-value">
              {payload[0].payload.absent} absent
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function AttendanceChart() {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">Weekly Attendance</div>
          <div className="chart-card-subtitle">Student attendance this week</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={attendanceData}
          margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
        >
          <defs>
            <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#009884" stopOpacity={0.3} />
              <stop offset="50%" stopColor="#009884" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#009884" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis
            domain={[85, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="percentage"
            stroke="#009884"
            strokeWidth={2.5}
            fill="url(#attendanceGradient)"
            dot={{
              r: 4,
              fill: '#ffffff',
              stroke: '#009884',
              strokeWidth: 2,
            }}
            activeDot={{
              r: 6,
              fill: '#009884',
              stroke: '#ffffff',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default AttendanceChart;
