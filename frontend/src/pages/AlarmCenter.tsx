/**
 * AlarmCenter.tsx
 * 알람 센터 페이지
 *
 * [기능]
 * 1. 최신 알람 표시 (EQP12 THP 미달)
 * 2. PDF 보고서 생성 버튼 → 미리보기 모달
 * 3. RAG 저장 확인 모달 → 저장 완료 팝업 → 과거이력 자동 업데이트
 * 4. 초기화 버튼 → 원래 상태(과거이력 11개)로 복원
 */

import React, { useState } from 'react';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────
interface EqpStateRow {
  time: string;
  state: 'RUN' | 'DOWN' | 'IDLE';
  lotId: string;
  rcp: string;
}

interface AlarmReport {
  id: string;
  date: string;
  eqp: string;
  kpi: string;
  isNew?: boolean;          // 새로 추가된 항목 표시
  summary: string;
  rootCause: string[];
  scenario: string[];
  eqpStateRows: EqpStateRow[];
  kpiData: {
    oee: { t: number; v: number };
    thp: { t: number; v: number };
    tat: { t: number; v: number };
    wip: { t: number; v: string };
  };
}

// ─────────────────────────────────────────────
// 초기 과거이력 데이터 (11개)
// ─────────────────────────────────────────────
const INITIAL_HISTORY: AlarmReport[] = [
  {
    id: 'RPT-001', date: '2026-01-20', eqp: 'EQP01', kpi: 'OEE',
    summary: 'EQP01 OEE 목표 미달 (62.1% / 목표 70%)',
    rootCause: ['설비 준비 시간 증가', 'RCP11 파라미터 편차'],
    scenario: ['RCP11 파라미터 재조정', '예방 정비 일정 검토'],
    kpiData: { oee: { t: 70, v: 62.1 }, thp: { t: 250, v: 238 }, tat: { t: 3.5, v: 3.2 }, wip: { t: 250, v: '248EA' } },
    eqpStateRows: [],
  },
  {
    id: 'RPT-002', date: '2026-01-21', eqp: 'EQP02', kpi: 'THP',
    summary: 'EQP02 Throughput 목표 미달 (230 / 목표 250)',
    rootCause: ['연속 DOWN 이벤트 3회', 'LOT 전환 지연'],
    scenario: ['DOWN 패턴 분석 및 점검', 'LOT 스케줄 재조정'],
    kpiData: { oee: { t: 70, v: 68.5 }, thp: { t: 250, v: 230 }, tat: { t: 3.5, v: 2.9 }, wip: { t: 250, v: '252EA' } },
    eqpStateRows: [],
  },
  {
    id: 'RPT-003', date: '2026-01-22', eqp: 'EQP03', kpi: 'TAT',
    summary: 'EQP03 TAT 초과 (4.1h / 목표 <3.5h)',
    rootCause: ['고복잡도 레시피 연속 처리', 'WIP 누적'],
    scenario: ['레시피 분산 처리', 'WIP 조정'],
    kpiData: { oee: { t: 70, v: 71.2 }, thp: { t: 250, v: 245 }, tat: { t: 3.5, v: 4.1 }, wip: { t: 250, v: '275EA' } },
    eqpStateRows: [],
  },
  {
    id: 'RPT-004', date: '2026-01-23', eqp: 'EQP04', kpi: 'WIP_EXCEED',
    summary: 'EQP04 WIP 초과 (290EA / 목표 250EA)',
    rootCause: ['하위 공정 병목', '투입량 과다'],
    scenario: ['투입량 조절', '하위 공정 가속'],
    kpiData: { oee: { t: 70, v: 69.8 }, thp: { t: 250, v: 248 }, tat: { t: 3.5, v: 3.3 }, wip: { t: 250, v: '290EA' } },
    eqpStateRows: [],
  },
  {
    id: 'RPT-005', date: '2026-01-24', eqp: 'EQP05', kpi: 'OEE',
    summary: 'EQP05 OEE 목표 미달 (61.5% / 목표 70%)',
    rootCause: ['장비 노후화', '청소/점검 시간 증가'],
    scenario: ['정기 PM 일정 조기 시행', '파트 교체 검토'],
    kpiData: { oee: { t: 70, v: 61.5 }, thp: { t: 250, v: 240 }, tat: { t: 3.5, v: 3.4 }, wip: { t: 250, v: '249EA' } },
    eqpStateRows: [],
  },
  {
    id: 'RPT-006', date: '2026-01-25', eqp: 'EQP06', kpi: 'THP',
    summary: 'EQP06 Throughput 목표 미달 (225 / 목표 250)',
    rootCause: ['RCP21 DOWN 2회', '대기 시간 과다'],
    scenario: ['RCP21 안정화 조치', '대기 큐 관리'],
    kpiData: { oee: { t: 70, v: 67.3 }, thp: { t: 250, v: 225 }, tat: { t: 3.5, v: 3.1 }, wip: { t: 250, v: '246EA' } },
    eqpStateRows: [],
  },
  {
    id: 'RPT-007', date: '2026-01-26', eqp: 'EQP07', kpi: 'WIP_SHORTAGE',
    summary: 'EQP07 WIP 부족 (215EA / 목표 250EA)',
    rootCause: ['상위 공정 공급 부족', '스케줄 오류'],
    scenario: ['상위 공정 투입 증가', '스케줄 재수립'],
    kpiData: { oee: { t: 70, v: 70.1 }, thp: { t: 250, v: 251 }, tat: { t: 3.5, v: 2.8 }, wip: { t: 250, v: '215EA' } },
    eqpStateRows: [],
  },
  {
    id: 'RPT-008', date: '2026-01-27', eqp: 'EQP08', kpi: 'OEE',
    summary: 'EQP08 OEE 목표 미달 (63.2% / 목표 70%)',
    rootCause: ['센서 오류로 인한 가동 중단', '재가동 절차 지연'],
    scenario: ['센서 교체', '비상 재가동 절차 수립'],
    kpiData: { oee: { t: 70, v: 63.2 }, thp: { t: 250, v: 242 }, tat: { t: 3.5, v: 3.0 }, wip: { t: 250, v: '251EA' } },
    eqpStateRows: [],
  },
  {
    id: 'RPT-009', date: '2026-01-28', eqp: 'EQP09', kpi: 'TAT',
    summary: 'EQP09 TAT 초과 (3.9h / 목표 <3.5h)',
    rootCause: ['복잡도 10 레시피 집중', 'DOWN 1회'],
    scenario: ['레시피 분산', '장비 점검'],
    kpiData: { oee: { t: 70, v: 69.4 }, thp: { t: 250, v: 247 }, tat: { t: 3.5, v: 3.9 }, wip: { t: 250, v: '253EA' } },
    eqpStateRows: [],
  },
  {
    id: 'RPT-010', date: '2026-01-29', eqp: 'EQP10', kpi: 'THP',
    summary: 'EQP10 Throughput 목표 미달 (232 / 목표 250)',
    rootCause: ['야간 DOWN 이벤트 2회', '레시피 전환 오류'],
    scenario: ['야간 모니터링 강화', '레시피 전환 절차 점검'],
    kpiData: { oee: { t: 70, v: 66.7 }, thp: { t: 250, v: 232 }, tat: { t: 3.5, v: 3.3 }, wip: { t: 250, v: '248EA' } },
    eqpStateRows: [],
  },
  {
    id: 'RPT-011', date: '2026-01-30', eqp: 'EQP11', kpi: 'WIP_EXCEED',
    summary: 'EQP11 WIP 초과 (285EA / 목표 250EA)',
    rootCause: ['생산 계획 오차', '긴급 투입 발생'],
    scenario: ['생산 계획 정밀도 향상', '긴급 투입 기준 수립'],
    kpiData: { oee: { t: 70, v: 70.5 }, thp: { t: 250, v: 249 }, tat: { t: 3.5, v: 3.2 }, wip: { t: 250, v: '285EA' } },
    eqpStateRows: [],
  },
];

// ─────────────────────────────────────────────
// 최신 알람 데이터
// ─────────────────────────────────────────────
const LATEST_ALARM: AlarmReport = {
  id: 'RPT-NEW',
  date: '2026-01-31',
  eqp: 'EQP12',
  kpi: 'THP',
  summary: 'EQP12 Throughput 목표 미달 (227 / 목표 250, -23)',
  rootCause: [
    'RCP23·RCP24 반복 처리 중 DOWN 이벤트 4회 발생 (총 다운타임 약 55분)',
    'RCP24 복잡도 10, RCP23 복잡도 8 — 고복잡도 레시피 연속 처리',
    'Throughput 목표 250 대비 실적 227 (-23) 미달',
    'LOT_02864~02868 구간 전체 처리 지연 발생',
  ],
  scenario: [
    'RCP23·RCP24 파라미터 점검 및 복잡도 조정 검토',
    'EQP12 장비 긴급 점검 (DOWN 패턴: 매 LOT 처리 시작 55~65분 후 반복)',
  ],
  kpiData: {
    oee: { t: 70, v: 76.44 },
    thp: { t: 250, v: 227 },
    tat: { t: 3.5, v: 2.27 },
    wip: { t: 250, v: '250EA' },
  },
  eqpStateRows: [
    { time: '00:00–00:30', state: 'IDLE', lotId: '–', rcp: '–' },
    { time: '00:30–01:25', state: 'RUN', lotId: 'LOT_20260131_02864', rcp: 'RCP23' },
    { time: '01:25–01:40', state: 'DOWN', lotId: 'LOT_20260131_02864', rcp: 'RCP23' },
    { time: '01:40–02:35', state: 'RUN', lotId: 'LOT_20260131_02864', rcp: 'RCP23' },
    { time: '02:35–03:35', state: 'RUN', lotId: 'LOT_20260131_02866', rcp: 'RCP24' },
    { time: '03:35–03:50', state: 'DOWN', lotId: 'LOT_20260131_02866', rcp: 'RCP24' },
    { time: '03:50–04:45', state: 'RUN', lotId: 'LOT_20260131_02866', rcp: 'RCP24' },
    { time: '05:45–06:00', state: 'DOWN', lotId: 'LOT_20260131_02866', rcp: 'RCP23' },
    { time: '07:55–08:10', state: 'DOWN', lotId: 'LOT_20260131_02867', rcp: 'RCP24' },
    { time: '09:10–11:00', state: 'RUN', lotId: 'LOT_20260131_02868', rcp: 'RCP23' },
  ],
};

// ─────────────────────────────────────────────
// 상태 뱃지 컴포넌트
// ─────────────────────────────────────────────
const StateBadge: React.FC<{ state: 'RUN' | 'DOWN' | 'IDLE' }> = ({ state }) => {
  const colors: Record<string, string> = {
    RUN: '#22c55e', DOWN: '#ef4444', IDLE: '#9ca3af',
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '999px',
      background: colors[state],
      color: '#fff',
      fontSize: '11px',
      fontWeight: 700,
    }}>{state}</span>
  );
};

// ─────────────────────────────────────────────
// KPI 배지 색상
// ─────────────────────────────────────────────
const kpiColor = (kpi: string) => {
  const map: Record<string, string> = {
    OEE: '#3b82f6', THP: '#22c55e', TAT: '#f59e0b',
    WIP_EXCEED: '#ef4444', WIP_SHORTAGE: '#8b5cf6',
  };
  return map[kpi] || '#6b7280';
};

// ─────────────────────────────────────────────
// PDF 미리보기 생성 (텍스트 기반)
// ─────────────────────────────────────────────
const generatePdfText = (alarm: AlarmReport): string => {
  return `
════════════════════════════════════════
  KPI 이상 분석 보고서
════════════════════════════════════════
보고서 ID : ${alarm.id}
작성 일시 : ${alarm.date}
대상 장비 : ${alarm.eqp}
이상 KPI  : ${alarm.kpi}
────────────────────────────────────────
■ 요약
${alarm.summary}

■ KPI 현황
  - OEE  : 목표 ${alarm.kpiData.oee.t}%  / 실적 ${alarm.kpiData.oee.v}%
  - THP  : 목표 ${alarm.kpiData.thp.t}   / 실적 ${alarm.kpiData.thp.v}
  - TAT  : 목표 ${alarm.kpiData.tat.t}h  / 실적 ${alarm.kpiData.tat.v}h
  - WIP  : 목표 ${alarm.kpiData.wip.t}EA / 실적 ${alarm.kpiData.wip.v}

■ 근본 원인 분석
${alarm.rootCause.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}

■ 해결 시나리오
${alarm.scenario.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}
════════════════════════════════════════
  ※ 본 보고서는 AI Agent가 자동 생성하였습니다.
════════════════════════════════════════
`.trim();
};

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
const AlarmCenter: React.FC = () => {
  const [tab, setTab] = useState<'latest' | 'history'>('latest');

  // 과거이력 상태 (초기화 가능하도록 state로 관리)
  const [historyList, setHistoryList] = useState<AlarmReport[]>(INITIAL_HISTORY);

  // 선택된 과거이력 보고서
  const [selectedReport, setSelectedReport] = useState<AlarmReport | null>(null);

  // PDF 생성 모달
  const [showPdfModal, setShowPdfModal] = useState(false);

  // RAG 저장 확인 모달
  const [showRagModal, setShowRagModal] = useState(false);

  // 저장 완료 팝업
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  // 최신 알람이 이미 저장되었는지 여부
  const [latestSaved, setLatestSaved] = useState(false);

  // ── PDF 생성 버튼 클릭 ──
  const handleGeneratePdf = () => {
    setShowPdfModal(true);
  };

  // ── RAG 저장 버튼 클릭 (PDF 모달 → RAG 모달) ──
  const handleSaveToRag = () => {
    setShowPdfModal(false);
    setShowRagModal(true);
  };

  // ── RAG 저장 확인 ──
  const handleConfirmRag = () => {
    setShowRagModal(false);

    // 과거이력에 최신 알람 추가 (이미 저장된 경우 중복 방지)
    if (!latestSaved) {
      const newEntry: AlarmReport = {
        ...LATEST_ALARM,
        id: `RPT-${String(historyList.length + 1).padStart(3, '0')}`,
        isNew: true,
      };
      setHistoryList(prev => [...prev, newEntry]);
      setLatestSaved(true);
    }

    // 저장 완료 팝업 표시 (2초 후 자동 닫힘)
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 2500);
  };

  // ── 초기화 버튼 ──
  const handleReset = () => {
    if (window.confirm('초기화하면 추가된 이력이 삭제됩니다. 계속하시겠습니까?')) {
      setHistoryList(INITIAL_HISTORY);
      setLatestSaved(false);
    }
  };

  return (
    <div>
      {/* ── 탭 헤더 ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center' }}>
        {/* 최신 알람 탭 */}
        <button
          onClick={() => setTab('latest')}
          style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: tab === 'latest' ? '#ef4444' : '#f3f4f6',
            color: tab === 'latest' ? '#fff' : '#374151',
            fontWeight: 700, fontSize: '14px',
          }}
        >
          최신 알람 <span style={{
            background: '#fff', color: '#ef4444',
            borderRadius: '999px', padding: '1px 7px', marginLeft: '6px', fontSize: '12px',
          }}>1</span>
        </button>

        {/* 과거이력 탭 */}
        <button
          onClick={() => setTab('history')}
          style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: tab === 'history' ? '#3b82f6' : '#f3f4f6',
            color: tab === 'history' ? '#fff' : '#374151',
            fontWeight: 700, fontSize: '14px',
          }}
        >
          과거 이력 (PDF) <span style={{
            background: '#fff', color: '#3b82f6',
            borderRadius: '999px', padding: '1px 7px', marginLeft: '6px', fontSize: '12px',
          }}>{historyList.length}</span>
        </button>

        {/* 초기화 버튼 */}
        <button
          onClick={handleReset}
          style={{
            marginLeft: 'auto',
            padding: '8px 16px', borderRadius: '8px',
            border: '1px solid #d1d5db', background: '#fff',
            color: '#6b7280', fontSize: '13px', cursor: 'pointer',
          }}
        >
          🔄 초기화
        </button>
      </div>

      {/* ════════════════════════════════════════
          최신 알람 탭
      ════════════════════════════════════════ */}
      {tab === 'latest' && (
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: '12px', padding: '28px',
        }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>
                {LATEST_ALARM.eqp} — Throughput 알람
              </h2>
              <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '6px' }}>
                {LATEST_ALARM.date} 09:10 · LINE2 · OPER4 · RCP23 / RCP24
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{
                background: kpiColor(LATEST_ALARM.kpi), color: '#fff',
                padding: '4px 14px', borderRadius: '999px',
                fontSize: '13px', fontWeight: 700,
              }}>{LATEST_ALARM.kpi}</span>
              <span style={{
                background: '#fef2f2', color: '#ef4444',
                padding: '4px 14px', borderRadius: '999px',
                fontSize: '13px', fontWeight: 700,
              }}>신규</span>
            </div>
          </div>

          {/* KPI 현황 카드 4개 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'OEE', t: `${LATEST_ALARM.kpiData.oee.t}%`, v: `${LATEST_ALARM.kpiData.oee.v}%`, alarm: false },
              { label: 'THP', t: `${LATEST_ALARM.kpiData.thp.t}`, v: `${LATEST_ALARM.kpiData.thp.v}`, alarm: true },
              { label: 'TAT', t: `${LATEST_ALARM.kpiData.tat.t}h`, v: `${LATEST_ALARM.kpiData.tat.v}h`, alarm: false },
              { label: 'WIP', t: `${LATEST_ALARM.kpiData.wip.t}EA`, v: LATEST_ALARM.kpiData.wip.v, alarm: false },
            ].map(({ label, t, v, alarm }) => (
              <div key={label} style={{
                border: alarm ? '2px solid #ef4444' : '1px solid #e5e7eb',
                borderRadius: '10px', padding: '14px 16px',
                background: alarm ? '#fef2f2' : '#f9fafb',
              }}>
                <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>T: {t}</div>
                <div style={{
                  fontSize: '22px', fontWeight: 800, fontFamily: 'Roboto Mono, monospace',
                  color: alarm ? '#ef4444' : '#111827', marginTop: '4px',
                }}>
                  A: {v}
                  {alarm && <span style={{ fontSize: '12px', color: '#ef4444', marginLeft: '6px' }}>미달</span>}
                </div>
              </div>
            ))}
          </div>

          {/* 근본 원인 분석 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>근본 원인 분석</div>
            {LATEST_ALARM.rootCause.map((cause, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: '#22c55e', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{ fontSize: '13px', color: '#374151' }}>{cause}</span>
              </div>
            ))}
          </div>

          {/* 장비 상태 타임라인 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>
              장비 상태 타임라인 (EQP_STATE · 2026-01-31 EQP12)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['시간', '상태', 'LOT ID', '레시피'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LATEST_ALARM.eqpStateRows.map((row, i) => (
                  <tr key={i} style={{ background: row.state === 'DOWN' ? '#fef2f2' : '#fff', borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'Roboto Mono, monospace', fontSize: '12px' }}>{row.time}</td>
                    <td style={{ padding: '10px 14px' }}><StateBadge state={row.state} /></td>
                    <td style={{ padding: '10px 14px', fontFamily: 'Roboto Mono, monospace', fontSize: '12px' }}>{row.lotId}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'Roboto Mono, monospace', fontSize: '12px' }}>{row.rcp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 해결 시나리오 */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>해결 시나리오</div>
            {LATEST_ALARM.scenario.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '13px', color: '#374151' }}>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span>
                {s}
              </div>
            ))}
          </div>

          {/* ── PDF 보고서 생성 버튼 ── */}
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '20px', display: 'flex', gap: '12px' }}>
            <button
              onClick={handleGeneratePdf}
              style={{
                padding: '12px 28px', borderRadius: '8px', border: 'none',
                background: latestSaved ? '#6b7280' : '#3b82f6',
                color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
              }}
            >
              📄 PDF 보고서 생성
            </button>
            {latestSaved && (
              <div style={{ display: 'flex', alignItems: 'center', color: '#22c55e', fontSize: '13px', fontWeight: 600 }}>
                ✅ RAG에 저장되었습니다
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          과거이력 탭
      ════════════════════════════════════════ */}
      {tab === 'history' && (
        <div>
          {historyList.map((report) => (
            <div
              key={report.id}
              onClick={() => setSelectedReport(report)}
              style={{
                background: '#fff',
                border: report.isNew ? '2px solid #22c55e' : '1px solid #e5e7eb',
                borderRadius: '10px', padding: '16px 20px',
                marginBottom: '10px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#9ca3af', fontFamily: 'Roboto Mono, monospace', width: '80px' }}>
                  {report.date}
                </span>
                <span style={{
                  background: kpiColor(report.kpi), color: '#fff',
                  padding: '2px 10px', borderRadius: '999px',
                  fontSize: '11px', fontWeight: 700,
                }}>{report.kpi}</span>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{report.eqp}</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>{report.summary}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {report.isNew && (
                  <span style={{
                    background: '#dcfce7', color: '#16a34a',
                    padding: '2px 8px', borderRadius: '999px',
                    fontSize: '11px', fontWeight: 700,
                  }}>NEW</span>
                )}
                <span style={{ color: '#9ca3af', fontSize: '12px' }}>{report.id}</span>
                <span style={{ color: '#9ca3af' }}>›</span>
              </div>
            </div>
          ))}

          {/* 보고서 상세 모달 */}
          {selectedReport && (
            <div
              onClick={() => setSelectedReport(null)}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  background: '#fff', borderRadius: '12px',
                  padding: '28px', width: '600px', maxHeight: '80vh',
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                    {selectedReport.eqp} · {selectedReport.kpi} 분석 보고서
                  </h3>
                  <button onClick={() => setSelectedReport(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>{selectedReport.date} · {selectedReport.id}</div>
                <div style={{ fontWeight: 700, marginBottom: '8px' }}>■ 요약</div>
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '16px' }}>{selectedReport.summary}</div>
                <div style={{ fontWeight: 700, marginBottom: '8px' }}>■ 근본 원인</div>
                {selectedReport.rootCause.map((c, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>  {i + 1}. {c}</div>
                ))}
                <div style={{ fontWeight: 700, margin: '16px 0 8px' }}>■ 해결 시나리오</div>
                {selectedReport.scenario.map((s, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>  ✓ {s}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          PDF 미리보기 모달
      ════════════════════════════════════════ */}
      {showPdfModal && (
        <div
          onClick={() => setShowPdfModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '12px',
              padding: '32px', width: '640px', maxHeight: '85vh',
              overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            {/* 모달 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>📄 PDF 보고서 미리보기</h3>
              <button onClick={() => setShowPdfModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            {/* PDF 내용 미리보기 */}
            <pre style={{
              background: '#f9fafb', border: '1px solid #e5e7eb',
              borderRadius: '8px', padding: '20px',
              fontSize: '12px', fontFamily: 'Roboto Mono, monospace',
              whiteSpace: 'pre-wrap', lineHeight: 1.8,
              color: '#111827', marginBottom: '20px',
            }}>
              {generatePdfText(LATEST_ALARM)}
            </pre>

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPdfModal(false)}
                style={{
                  padding: '10px 20px', borderRadius: '8px',
                  border: '1px solid #d1d5db', background: '#fff',
                  color: '#374151', fontWeight: 600, cursor: 'pointer',
                }}
              >
                닫기
              </button>
              <button
                onClick={handleSaveToRag}
                disabled={latestSaved}
                style={{
                  padding: '10px 24px', borderRadius: '8px', border: 'none',
                  background: latestSaved ? '#6b7280' : '#22c55e',
                  color: '#fff', fontWeight: 700, cursor: latestSaved ? 'not-allowed' : 'pointer',
                }}
              >
                {latestSaved ? '✅ 이미 저장됨' : '💾 RAG에 저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          RAG 저장 확인 모달
      ════════════════════════════════════════ */}
      {showRagModal && (
        <div
          onClick={() => setShowRagModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 3000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '16px',
              padding: '36px', width: '460px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗄️</div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 12px' }}>
              RAG 데이터베이스에 저장할까요?
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, margin: '0 0 28px' }}>
              이 보고서를 ChromaDB RAG에 저장하면<br />
              AI 챗봇이 향후 유사 알람 분석 시<br />
              이 내용을 참고할 수 있습니다.
            </p>

            {/* 저장 정보 */}
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: '8px', padding: '12px 16px',
              marginBottom: '24px', textAlign: 'left',
              fontSize: '13px', color: '#166534',
            }}>
              <div>📌 보고서 ID: {LATEST_ALARM.id}</div>
              <div>📌 대상 장비: {LATEST_ALARM.eqp}</div>
              <div>📌 저장 위치: ChromaDB · kpi_analysis_reports</div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowRagModal(false)}
                style={{
                  padding: '12px 24px', borderRadius: '8px',
                  border: '1px solid #d1d5db', background: '#fff',
                  color: '#374151', fontWeight: 600, cursor: 'pointer', flex: 1,
                }}
              >
                취소
              </button>
              <button
                onClick={handleConfirmRag}
                style={{
                  padding: '12px 24px', borderRadius: '8px', border: 'none',
                  background: '#3b82f6', color: '#fff',
                  fontWeight: 700, cursor: 'pointer', flex: 1,
                }}
              >
                ✅ 저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          저장 완료 토스트 팝업
      ════════════════════════════════════════ */}
      {showSavedPopup && (
        <div style={{
          position: 'fixed', bottom: '32px', right: '32px',
          background: '#111827', color: '#fff',
          padding: '16px 24px', borderRadius: '12px',
          fontSize: '14px', fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'fadeIn 0.3s ease',
        }}>
          <span style={{ fontSize: '20px' }}>✅</span>
          <div>
            <div>RAG 저장 완료!</div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
              과거 이력에 추가되었습니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlarmCenter;
