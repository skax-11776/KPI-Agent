/**
 * 메인 대시보드
 */

import React from 'react';
import AlarmCard from '../components/AlarmCard';
import ChatBot from '../components/ChatBot';

const Dashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">
            🏭 AI Agent KPI Monitor
          </h1>
          <p className="text-gray-600 mt-1">
            제조 라인 KPI 모니터링 및 AI 기반 근본 원인 분석
          </p>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽: 알람 카드 */}
          <div>
            <AlarmCard />
          </div>

          {/* 오른쪽: 챗봇 */}
          <div>
            <ChatBot />
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-gray-600 text-sm">
            © 2026 AI Agent KPI Monitor. Powered by AWS Bedrock & LangGraph.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;