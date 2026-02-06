import React from 'react';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import ActionItem from './ActionItem';

export default function ActionsTab() {
  const { data: actions, loading, refetch } = useApi(() => api.getActions(), []);

  const handleToggle = async (actionId, currentStatus) => {
    const nextStatus = currentStatus === 'pending'
      ? 'in_progress'
      : currentStatus === 'in_progress'
        ? 'done'
        : 'pending';

    try {
      await api.updateAction(actionId, { status: nextStatus });
      refetch();
    } catch (e) {
      console.error('Action update failed:', e);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>액션 불러오는 중...</span>
      </div>
    );
  }

  if (!actions || actions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚡</div>
        <p>아직 생성된 액션이 없습니다.<br />트렌드 분석 후 자동 생성됩니다.</p>
      </div>
    );
  }

  const pending = actions.filter((a) => a.status === 'pending');
  const inProgress = actions.filter((a) => a.status === 'in_progress');
  const done = actions.filter((a) => a.status === 'done');

  return (
    <div className="actions-section fade-in">
      {/* 대기 */}
      <div className="actions-section-title">
        대기 <span className="count">{pending.length}</span>
      </div>
      {pending.map((action) => (
        <ActionItem
          key={action.id}
          action={action}
          onToggle={() => handleToggle(action.id, action.status)}
          showTrend
        />
      ))}

      {/* 진행중 */}
      <div className="actions-section-title">
        진행중 <span className="count">{inProgress.length}</span>
      </div>
      {inProgress.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>
          진행중인 액션이 없습니다
        </div>
      ) : (
        inProgress.map((action) => (
          <ActionItem
            key={action.id}
            action={action}
            onToggle={() => handleToggle(action.id, action.status)}
            showTrend
          />
        ))
      )}

      {/* 완료 */}
      <div className="actions-section-title">
        완료 <span className="count">{done.length}</span>
      </div>
      {done.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>
          완료된 액션이 없습니다
        </div>
      ) : (
        done.map((action) => (
          <ActionItem
            key={action.id}
            action={action}
            onToggle={() => handleToggle(action.id, action.status)}
            showTrend
          />
        ))
      )}
    </div>
  );
}
