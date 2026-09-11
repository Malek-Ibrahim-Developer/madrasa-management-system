import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { financeData } from '../../data/mockData';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="custom-tooltip">
      <div className="custom-tooltip-label">{label}</div>
      {payload.map((entry) => (
        <div className="custom-tooltip-row" key={entry.dataKey}>
          <span
            className="custom-tooltip-dot"
            style={{ backgroundColor: entry.color }}
          />
          <span className="custom-tooltip-value">
            {entry.name}: ₹{Number(entry.value).toLocaleString('en-IN')}
          </span>
        </div>
      ))}
    </div>
  );
}

function CustomLegend({ payload }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '8px' }}>
      {payload.map((entry) => (
        <div
          key={entry.value}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#6b7280',
          }}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              backgroundColor: entry.color,
              display: 'inline-block',
            }}
          />
          {entry.value}
        </div>
      ))}
    </div>
  );
}

function FinanceSummary() {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">Financial Overview</div>
          <div className="chart-card-subtitle">Income vs Expenses (last 6 months)</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={financeData}
          margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
          barGap={4}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
          <Bar
            dataKey="income"
            name="Income"
            fill="#009884"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
          <Bar
            dataKey="expense"
            name="Expense"
            fill="#f97316"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default FinanceSummary;
