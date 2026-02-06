import React, { useState } from 'react';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import ActionItem from './ActionItem';

const CATEGORIES = ['전체', 'LLM', 'SEO', 'B2B', '챗봇', '개발', '생산성', '마케팅'];

export default function TrendsTab() {
  const [category, setCategory] = useState('전체');
  const [expandedId, setExpandedId] = useState(null);

  const { data: stats, loading: statsLoading } = useApi(() => api.getStats(), []);
  const { data: trends, loading: trendsLoading, refetch } = useApi(
    () => api.getTrends(category),
    [category]
  );

  const handleActionToggle = async (actionId, currentStatus) => {
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}/${day}`;
  };

  return (
    <div className="fade-in">
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value accent">
            {statsLoading ? '-' : (stats?.total_trends || 0)}
          </div>
          <div className="stat-label">트렌드</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {statsLoading ? '-' : (stats?.total_actions || 0)}
          </div>
          <div className="stat-label">액션</div>
        </div>
        <div className="stat-card">
          <div className="stat-value success">
            {statsLoading ? '-' : (stats?.completed_actions || 0)}
          </div>
          <div className="stat-label">완료</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {statsLoading ? '-' : `${stats?.apply_rate || 0}%`}
          </div>
          <div className="stat-label">적용률</div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="filter-scroll">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`filter-pill ${category === cat ? 'active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Trend List */}
      {trendsLoading ? (
        <div className="loading">
          <div className="spinner" />
          <span>트렌드 불러오는 중...</span>
        </div>
      ) : !trends || trends.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <p>아직 수집된 트렌드가 없습니다.<br />크롤링이 실행되면 여기에 표시됩니다.</p>
        </div>
      ) : (
        trends.map((trend) => (
          <div key={trend.id} className="trend-card">
            <div
              className="trend-card-header"
              onClick={() => setExpandedId(expandedId === trend.id ? null : trend.id)}
            >
              <div className="trend-meta">
                <span className={`impact-badge ${trend.impact}`}>
                  {trend.impact === 'high' ? 'HIGH' : trend.impact === 'medium' ? 'MED' : 'LOW'}
                </span>
                <span className="source-tag">
                  {trend.source_icon} {trend.source_name}
                </span>
                <span className="trend-date">{formatDate(trend.published_date)}</span>
              </div>
              <div className="trend-title-row">
                <span className="trend-title">{trend.title}</span>
                <span className="relevance-score">{trend.relevance_score}</span>
              </div>
            </div>

            {expandedId === trend.id && (
              <div className="trend-body fade-in">
                <p className="trend-summary">{trend.summary}</p>

                {trend.tags && trend.tags.length > 0 && (
                  <div className="trend-tags">
                    {trend.tags.map((tag, i) => (
                      <span key={i} className="tag">#{tag}</span>
                    ))}
                  </div>
                )}

                {trend.actions && trend.actions.length > 0 && (
                  <>
                    <div className="trend-actions-label">액션 아이템</div>
                    {trend.actions.map((action) => (
                      <ActionItem
                        key={action.id}
                        action={action}
                        onToggle={() => handleActionToggle(action.id, action.status)}
                      />
                    ))}
                  </>
                )}

                {trend.source_url && (
                  <a
                    href={trend.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      color: 'var(--color-info)',
                      marginTop: '8px',
                      textDecoration: 'none',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    원본 보기 →
                  </a>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
