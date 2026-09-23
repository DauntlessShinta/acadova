import React from 'react';

export const StatCard = ({ title, value, subtitle, icon: Icon, color = 'var(--brass-500)' }) => {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>
          {title}
        </span>
        {Icon && (
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color,
          }}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div>
        <div className="mono" style={{ fontSize: '1.9rem', fontWeight: 700, color: 'var(--ink-900)', lineHeight: 1.1 }}>
          {value}
        </div>
        {subtitle && (
          <div style={{ fontSize: '0.82rem', color: 'var(--ink-500)', marginTop: 4 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;

