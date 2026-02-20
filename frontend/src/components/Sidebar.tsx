import React from 'react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">KPI Monitoring Agent</h1>
      </div>

      <nav className="sidebar-nav">
        <div
          className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          대시보드
        </div>
        <div
          className={`nav-item ${currentPage === 'alarm' ? 'active' : ''}`}
          onClick={() => onNavigate('alarm')}
        >
          알람 모니터링
        </div>
        <div
          className={`nav-item ${currentPage === 'chatbot' ? 'active' : ''}`}
          onClick={() => onNavigate('chatbot')}
        >
          AI 챗봇
        </div>
        <div
          className={`nav-item ${currentPage === 'database' ? 'active' : ''}`}
          onClick={() => onNavigate('database')}
        >
          데이터베이스
        </div>
      </nav>

      <div style={{ padding: '20px', borderTop: '1px solid #e0e0e0', fontSize: '12px', color: '#999' }}>
        <div>Powered by</div>
        <div style={{ fontWeight: 600, color: '#666' }}>AWS Bedrock & LangGraph</div>
      </div>
    </div>
  );
};

export default Sidebar;