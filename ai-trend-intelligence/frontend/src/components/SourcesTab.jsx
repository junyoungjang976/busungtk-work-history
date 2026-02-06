import React from 'react';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';

export default function SourcesTab() {
  const { data: sources, loading } = useApi(() => api.getSources(), []);

  const formatTime = (dateStr) => {
    if (!dateStr) return '미실행';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor(diff / (1000 * 60));

    if (mins < 60) return `${mins}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>소스 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="sources-list fade-in">
      {(sources || []).map((source) => (
        <div key={source.id} className="source-card">
          <div className="source-icon">{source.icon}</div>
          <div className="source-info">
            <div className="source-name">{source.name}</div>
            <div className="source-detail">
              {formatTime(source.last_crawl_at)} · {source.total_collected || 0}건 수집
            </div>
          </div>
          <span className={`source-status ${source.is_active ? 'active' : 'inactive'}`}>
            {source.is_active ? '활성' : '정지'}
          </span>
        </div>
      ))}

      {/* Architecture Card */}
      <div className="arch-card">
        <h3>시스템 아키텍처</h3>
        <div className="arch-flow">
          <div className="arch-step">
            <span className="step-icon">⏰</span>
            <span>매일 08:00 KST (pg_cron)</span>
          </div>
          <div className="arch-arrow">↓</div>
          <div className="arch-step">
            <span className="step-icon">🕷️</span>
            <span>crawl — 8개 소스 수집</span>
          </div>
          <div className="arch-arrow">↓</div>
          <div className="arch-step">
            <span className="step-icon">🤖</span>
            <span>analyze — Claude Sonnet 분석</span>
          </div>
          <div className="arch-arrow">↓</div>
          <div className="arch-step">
            <span className="step-icon">📊</span>
            <span>trends + actions 자동 생성</span>
          </div>
          <div className="arch-arrow">↓</div>
          <div className="arch-step">
            <span className="step-icon">📱</span>
            <span>모바일 대시보드 확인</span>
          </div>
          <div className="arch-arrow">↓</div>
          <div className="arch-step">
            <span className="step-icon">🔔</span>
            <span>HIGH 임팩트 SMS 알림</span>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="arch-card" style={{ marginTop: '8px' }}>
        <h3>기술 스택</h3>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
          <div><span style={{ color: 'var(--color-info)' }}>Frontend</span> — React + Vite + Vercel</div>
          <div><span style={{ color: 'var(--color-info)' }}>Backend</span> — Supabase Edge Functions</div>
          <div><span style={{ color: 'var(--color-info)' }}>DB</span> — PostgreSQL (Supabase)</div>
          <div><span style={{ color: 'var(--color-info)' }}>AI</span> — Claude Sonnet API</div>
          <div><span style={{ color: 'var(--color-info)' }}>알림</span> — Solapi SMS/카카오톡</div>
          <div><span style={{ color: 'var(--color-info)' }}>스케줄</span> — pg_cron (매일 08:00)</div>
        </div>
      </div>
    </div>
  );
}
