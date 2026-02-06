import React, { useState } from 'react';
import TrendsTab from './components/TrendsTab';
import ActionsTab from './components/ActionsTab';
import SourcesTab from './components/SourcesTab';

const TABS = [
  { id: 'trends', icon: '🔥', label: '트렌드' },
  { id: 'actions', icon: '⚡', label: '액션' },
  { id: 'sources', icon: '📡', label: '소스' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('trends');

  return (
    <>
      {/* Header */}
      <div className="header">
        <div className="header-title">
          <h1>AI Trend Intelligence</h1>
        </div>
        <div className="header-subtitle">부성티케이 AI 동향 분석 시스템</div>
      </div>

      {/* Tab Content */}
      <main>
        {activeTab === 'trends' && <TrendsTab />}
        {activeTab === 'actions' && <ActionsTab />}
        {activeTab === 'sources' && <SourcesTab />}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </>
  );
}
