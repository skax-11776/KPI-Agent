/**
 * 알람 카드 컴포넌트
 */

import React, { useState, useEffect } from 'react';
import { getLatestAlarm, analyzeAlarm } from '../services/api';
import { AlarmAnalyzeResponse } from '../types';
import LoadingSpinner from './LoadingSpinner';
import ReportViewer from './ReportViewer';

const AlarmCard: React.FC = () => {
  const [latestAlarm, setLatestAlarm] = useState<any>(null);
  const [analysisResult, setAnalysisResult] = useState<AlarmAnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  // 컴포넌트 마운트 시 최신 알람 조회
  useEffect(() => {
    loadLatestAlarm();
  }, []);

  const loadLatestAlarm = async () => {
    try {
      const data = await getLatestAlarm();
      setLatestAlarm(data);
    } catch (err: any) {
      console.error('최신 알람 조회 실패:', err);
      setError('최신 알람을 불러올 수 없습니다.');
    }
  };

  const handleAnalyze = async () => {
    if (!latestAlarm) return;

    setLoading(true);
    setError(null);

    try {
      const result = await analyzeAlarm();
      setAnalysisResult(result);
    } catch (err: any) {
      console.error('알람 분석 실패:', err);
      setError(err.response?.data?.detail || '알람 분석에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getKpiColor = (kpi: string) => {
    const colors: { [key: string]: string } = {
      OEE: 'bg-blue-100 text-blue-800',
      THP: 'bg-green-100 text-green-800',
      TAT: 'bg-yellow-100 text-yellow-800',
      WIP_EXCEED: 'bg-red-100 text-red-800',
      WIP_SHORTAGE: 'bg-purple-100 text-purple-800',
    };
    return colors[kpi] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">
          🚨 최신 알람
        </h2>
        <button
          onClick={loadLatestAlarm}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          🔄 새로고침
        </button>
      </div>

      {latestAlarm && (
        <div className="space-y-4">
          {/* 알람 정보 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">날짜</p>
                <p className="text-lg font-semibold">{latestAlarm.date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">장비</p>
                <p className="text-lg font-semibold">{latestAlarm.eqp_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">KPI</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getKpiColor(
                    latestAlarm.kpi
                  )}`}
                >
                  {latestAlarm.kpi}
                </span>
              </div>
            </div>
          </div>

          {/* 분석 버튼 */}
          {!analysisResult && (
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {loading ? '분석 중...' : '🔍 AI 분석 시작'}
            </button>
          )}

          {/* 로딩 */}
          {loading && <LoadingSpinner message="AI가 근본 원인을 분석하고 있습니다..." />}

          {/* 에러 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* 분석 결과 */}
          {analysisResult && !loading && (
            <div className="space-y-4">
              {/* 근본 원인 */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-bold text-green-800 mb-2">
                  ✅ 근본 원인 (AI 분석)
                </h3>
                <p className="text-gray-800">{analysisResult.selected_cause.cause}</p>
                <p className="text-sm text-gray-600 mt-2">
                  확률: {analysisResult.selected_cause.probability}%
                </p>
              </div>

              {/* 리포트 보기 버튼 */}
              <button
                onClick={() => setShowReport(!showReport)}
                className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                {showReport ? '📄 리포트 숨기기' : '📄 상세 리포트 보기'}
              </button>

              {/* 리포트 뷰어 */}
              {showReport && (
                <ReportViewer report={analysisResult.final_report} />
              )}

              {/* 메타 정보 */}
              <div className="text-sm text-gray-600 space-y-1">
                <p>⏱️ 처리 시간: {analysisResult.processing_time?.toFixed(2)}초</p>
                <p>🤖 LLM 호출: {analysisResult.llm_calls}회</p>
                <p>💾 RAG 저장: {analysisResult.rag_saved ? '✅' : '❌'}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlarmCard;