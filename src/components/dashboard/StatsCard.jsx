import { MdTrendingUp, MdTrendingDown } from 'react-icons/md';
import { useAnimatedCounter, useInView } from '../../hooks/useAnimations';

function StatsCard({ icon: Icon, label, value, trend, trendDirection, color, bgColor, index = 0 }) {
  const [ref, isVisible] = useInView({ threshold: 0.2, triggerOnce: true });

  // Extract numeric part for animation
  const isNumeric = typeof value === 'number';
  const numericValue = isNumeric ? value : null;
  const animatedValue = useAnimatedCounter(
    isVisible && isNumeric ? numericValue : 0,
    1800,
    index * 120
  );

  const displayValue = isNumeric
    ? animatedValue.toLocaleString('en-IN')
    : value;

  return (
    <div
      ref={ref}
      className={`stat-card ${isVisible ? 'stat-card-visible' : ''}`}
      style={{ '--card-delay': `${index * 120}ms`, '--card-accent': color }}
    >
      {/* Animated accent line at top */}
      <div className="stat-card-accent" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />

      {/* Floating background orb */}
      <div className="stat-card-orb" style={{ background: `radial-gradient(circle, ${bgColor}, transparent)` }} />

      <div className="stat-card-header">
        <div
          className="stat-card-icon"
          style={{ color, backgroundColor: bgColor }}
        >
          <Icon />
        </div>
        {trend !== undefined && trend !== null && (
          <span className={`stat-card-trend ${trendDirection}`}>
            {trendDirection === 'up' ? <MdTrendingUp /> : <MdTrendingDown />}
            {trendDirection === 'up' ? '+' : ''}{trend}
          </span>
        )}
      </div>
      <div className="stat-card-value">{displayValue}</div>
      <div className="stat-card-label">{label}</div>

      {/* Animated progress indicator */}
      <div className="stat-card-progress">
        <div
          className="stat-card-progress-bar"
          style={{
            background: `linear-gradient(90deg, ${color}, ${color}88)`,
            width: isVisible ? '100%' : '0%',
            transitionDelay: `${index * 120 + 800}ms`,
          }}
        />
      </div>
    </div>
  );
}

export default StatsCard;
