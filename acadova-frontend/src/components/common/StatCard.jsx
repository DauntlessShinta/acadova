import React from 'react';

export const StatCard = ({ title, value, subtitle, icon: Icon, color = 'var(--brass-500)' }) => {
  return (
    <div className="card stat-card">
      <div className="stat-card-heading">
        <span className="stat-card-label">
          {title}
        </span>
        {Icon && (
          <div className="stat-card-icon" style={{ color }}>
            <Icon size={18} aria-hidden="true" />
          </div>
        )}
      </div>
      <div>
        <div className="tabular stat-card-value">
          {value}
        </div>
        {subtitle && (
          <div className="stat-card-subtitle">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;

