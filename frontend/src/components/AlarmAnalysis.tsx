/**
 * 최신 알람 분석 컴포넌트 (2단계 Human-in-the-Loop)
 *
 * Phase 1: AI가 근본 원인 후보를 분석 → 사용자가 카드 선택
 * Phase 2: 선택된 원인으로 최종 리포트 생성
 */

import React, { useState, useEffect } from 'react';
import { getLatestAlarm, analyzeAlarmPhase1, analyzeAlarmPhase2 } from '../services/api';
import { AlarmPhase1Response, AlarmPhase2Response } from '../types';
import ReportViewer from './ReportViewer';
import AnalysisProgress from './AnalysisProgress';

const AlarmAnalysis: React.FC = () => {
  const [latestAlarm, setLatestAlarm] = useState<any>(null);

  // Phase 1 상태
  const [phase1Result, setPhase1Result] = useState<AlarmPhase1Response | null>(null);
  const [loadingPhase1, setLoadingPhase1] = useState(false);

  // Phase 2 상태
  const [phase2Result, setPhase2Result] = useState<AlarmPhase2Response | null>(null);
  const [loadingPhase2, setLoadingPhase2] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

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

  // Phase 1: 근본 원인 후보 분석
  const handlePhase1 = async () => {
    if (!latestAlarm) return;

    setLoadingPhase1(true);
    setError(null);
    setPhase1Result(null);
    setPhase2Result(null);
    setSelectedIndex(null);

    try {
      const result = await analyzeAlarmPhase1();
      setPhase1Result(result);
    } catch (err: any) {
      console.error('Phase 1 분석 실패:', err);
      setError(err.response?.data?.detail || '근본 원인 분석에 실패했습니다.');
    } finally {
      setLoadingPhase1(false);
    }
  };

  // Phase 2: 선택된 원인으로 리포트 생성
  const handlePhase2 = async (index: number) => {
    if (!phase1Result) return;

    setSelectedIndex(index);
    setLoadingPhase2(true);
    setError(null);
    setPhase2Result(null);

    try {
      const result = await analyzeAlarmPhase2(phase1Result.session_id, index);
      setPhase2Result(result);
      setShowReport(true);
    } catch (err: any) {
      console.error('Phase 2 실패:', err);
      setError(err.response?.data?.detail || '리포트 생성에 실패했습니다.');
      setSelectedIndex(null);
    } finally {
      setLoadingPhase2(false);
    }
  };

  return (
    <div>
      {/* 최신 알람 정보 카드 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span>🚨</span>
            최신 알람
          </h2>
          <button
            onClick={loadLatestAlarm}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            🔄 새로고침
          </button>
        </div>

        {latestAlarm && (
          <div className="card-body">
            <div className="alarm-info-grid">
              <div className="info-item">
                <span className="info-label">날짜</span>
                <span className="info-value">{latestAlarm.date}</span>
              </div>
              <div className="info-item">
                <span className="info-label">장비</span>
                <span className="info-value">{latestAlarm.eqp_id}</span>
              </div>
              <div className="info-item">
                <span className="info-label">KPI</span>
                <span className={`kpi-badge ${latestAlarm.kpi}`}>
                  {latestAlarm.kpi || '분석 전'}
                </span>
              </div>
            </div>

            {!phase1Result && !loadingPhase1 && (
              <button
                onClick={handlePhase1}
                disabled={loadingPhase1}
                className="btn btn-primary btn-full"
                style={{ marginTop: '20px' }}
              >
                🔍 AI 근본 원인 분석 시작 (Step 1)
              </button>
            )}
          </div>
        )}
      </div>

      {/* Phase 1 진행 표시 */}
      <AnalysisProgress isAnalyzing={loadingPhase1} />

      {/* 에러 */}
      {error && (
        <div className="error-box">
          <strong>오류:</strong> {error}
        </div>
      )}

      {/* Phase 1 결과: 근본 원인 후보 선택 */}
      {phase1Result && !loadingPhase1 && !phase2Result && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <span>🔍</span>
              근본 원인 후보 — 원인을 선택해주세요
            </h2>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              {phase1Result.alarm_date} | {phase1Result.alarm_eqp_id} | {phase1Result.alarm_kpi}
            </div>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '16px' }}>
              AI가 분석한 {phase1Result.root_causes.length}개의 근본 원인 후보입니다.
              가장 적합한 원인을 선택하면 상세 리포트를 생성합니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {phase1Result.root_causes.map((cause, index) => (
                <button
                  key={index}
                  onClick={() => handlePhase2(index)}
                  disabled={loadingPhase2}
                  style={{
                    textAlign: 'left',
                    padding: '16px 20px',
                    backgroundColor: loadingPhase2 && selectedIndex === index
                      ? 'rgba(59, 130, 246, 0.2)'
                      : 'rgba(30, 41, 59, 0.6)',
                    border: loadingPhase2 && selectedIndex === index
                      ? '2px solid #3b82f6'
                      : '1px solid #334155',
                    borderRadius: '10px',
                    cursor: loadingPhase2 ? 'not-allowed' : 'pointer',
                    color: '#e2e8f0',
                    transition: 'all 0.15s ease',
                    opacity: loadingPhase2 && selectedIndex !== index ? 0.5 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!loadingPhase2) {
                      (e.currentTarget as HTMLButtonElement).style.border = '1px solid #3b82f6';
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!loadingPhase2 || selectedIndex !== index) {
                      (e.currentTarget as HTMLButtonElement).style.border = '1px solid #334155';
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
                    }
                  }}
                >
                  {/* 순위 + 확률 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#f1f5f9' }}>
                      {index + 1}. {cause.cause}
                    </span>
                    <span style={{
                      fontSize: '13px', fontWeight: 700,
                      color: cause.probability >= 50 ? '#ef4444' : cause.probability >= 30 ? '#f59e0b' : '#94a3b8',
                      background: 'rgba(0,0,0,0.3)',
                      padding: '2px 10px', borderRadius: '999px',
                    }}>
                      {cause.probability}%
                    </span>
                  </div>

                  {/* 확률 바 */}
                  <div style={{ height: '4px', background: '#1e293b', borderRadius: '2px', marginBottom: '8px' }}>
                    <div style={{
                      height: '100%',
                      width: `${cause.probability}%`,
                      background: cause.probability >= 50 ? '#ef4444' : cause.probability >= 30 ? '#f59e0b' : '#3b82f6',
                      borderRadius: '2px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>

                  {/* 근거 */}
                  <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                    {cause.evidence}
                  </div>

                  {/* 선택 중 표시 */}
                  {loadingPhase2 && selectedIndex === index && (
                    <div style={{ marginTop: '8px', fontSize: '13px', color: '#3b82f6', fontWeight: 600 }}>
                      ⏳ 리포트 생성 중...
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Phase 1 메타 */}
            <div style={{ marginTop: '16px', fontSize: '12px', color: '#475569' }}>
              ⏱️ Phase 1 처리: {phase1Result.processing_time?.toFixed(1)}초 | 🤖 LLM: {phase1Result.llm_calls}회
            </div>
          </div>
        </div>
      )}

      {/* Phase 2 진행 표시 */}
      <AnalysisProgress isAnalyzing={loadingPhase2} />

      {/* Phase 2 결과: 최종 리포트 */}
      {phase2Result && !loadingPhase2 && (
        <>
          {/* 선택된 원인 요약 */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <span>✅</span>
                최종 분석 결과
              </h2>
            </div>
            <div className="card-body">
              <div className="result-box">
                <div className="result-title">
                  <span>🎯</span>
                  선택된 근본 원인
                </div>
                <div className="result-content">
                  {phase2Result.selected_cause.cause}
                </div>
                <div className="result-meta">
                  확률: {phase2Result.selected_cause.probability}% |
                  근거: {phase2Result.selected_cause.evidence.substring(0, 100)}...
                </div>
              </div>

              {/* 리포트 토글 */}
              <button
                onClick={() => setShowReport(!showReport)}
                className="btn btn-secondary btn-full"
                style={{ marginTop: '20px' }}
              >
                {showReport ? '📄 리포트 숨기기' : '📄 상세 리포트 보기'}
              </button>

              {/* 다시 분석 버튼 */}
              <button
                onClick={handlePhase1}
                className="btn btn-secondary btn-full"
                style={{ marginTop: '8px' }}
              >
                🔄 다시 분석하기
              </button>
            </div>
          </div>

          {/* 상세 리포트 */}
          {showReport && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <span>📋</span>
                  상세 분석 리포트
                </h2>
              </div>
              <div className="card-body">
                <ReportViewer report={phase2Result.final_report} />
              </div>
            </div>
          )}

          {/* 메타 정보 */}
          <div className="card">
            <div className="card-body" style={{ fontSize: '13px', color: '#94a3b8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span>⏱️ Phase 2 처리: {phase2Result.processing_time?.toFixed(2)}초</span>
                <span>🤖 LLM 호출: {phase2Result.llm_calls}회</span>
                <span>💾 RAG 저장: {phase2Result.rag_saved ? '✅ 완료' : '❌ 실패'}</span>
                <span>🆔 리포트 ID: {phase2Result.report_id}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AlarmAnalysis;
