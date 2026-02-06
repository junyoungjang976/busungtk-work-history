import React from 'react';

const STATUS_ICONS = {
  pending: '',
  in_progress: '▶',
  done: '✓',
};

export default function ActionItem({ action, onToggle, showTrend = false }) {
  return (
    <div className="action-item" onClick={onToggle}>
      <button
        className={`action-status-btn ${action.status}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {STATUS_ICONS[action.status]}
      </button>
      <div style={{ flex: 1 }}>
        <span className={`action-text ${action.status === 'done' ? 'done' : ''}`}>
          {action.text}
        </span>
        {showTrend && action.trends && (
          <div className="action-card-trend">
            {action.trends.title}
          </div>
        )}
      </div>
      <span className={`action-priority ${action.priority}`}>
        {action.priority === 'high' ? 'H' : action.priority === 'medium' ? 'M' : 'L'}
      </span>
    </div>
  );
}
