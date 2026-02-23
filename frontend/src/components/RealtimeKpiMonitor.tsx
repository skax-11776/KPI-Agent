/**
 * RealtimeKpiMonitor.tsx
 * 실시간 KPI 모니터 컴포넌트
 *
 * [수정사항]
 * - 사이드바 이동 후 돌아왔을 때 차트가 흰색으로 보이는 문제 수정
 * - ResizeObserver로 컨테이너 크기 변화 감지 → SVG width 동적 업데이트
 * - containerRef로 실제 DOM 너비를 측정하여 차트 렌더링
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────
interface KpiDataPoint {
  time: number;       // timestamp (ms)
  oee: number;        // OEE %
  thp: number;        // Throughput UPH
  tat: number;        // Turn-Around Time (h)
  wip: number;        // Work In Process (EA)
}

interface KpiCardProps {
  label: string;
  unit: string;
  value: number;
  target: number;
  delta: number;
  isAlarm: boolean;
  description: string;
  targetLabel: string;
}

// ─────────────────────────────────────────────
// KPI 카드 컴포넌트
// ─────────────────────────────────────────────
const KpiCard: React.FC<KpiCardProps> = ({
  label, unit, value, target, delta, isAlarm, description, targetLabel
}) => {
  const isUp = delta >= 0;

  return (
    <div style={{
      background: '#fff',
      border: isAlarm ? '2px solid #ef4444' : '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '20px 24px',
      flex: 1,
      minWidth: 0,
      position: 'relative',
    }}>
      {/* 알람 뱃지 */}
      {isAlarm && (
        <span style={{
          position: 'absolute', top: '12px', right: '12px',
          background: '#ef4444', color: '#fff',
          fontSize: '11px', fontWeight: 700,
          padding: '2px 8px', borderRadius: '999px',
        }}>이상</span>
      )}

      {/* KPI 이름 */}
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>
        {label}
      </div>

      {/* 값 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{
          fontSize: '32px', fontWeight: 800,
          color: isAlarm ? '#ef4444' : '#111827',
          fontFamily: 'Roboto Mono, monospace',
        }}>
          {typeof value === 'number'
            ? label === 'OEE' ? `${value.toFixed(1)}%`
            : label === 'TAT' ? `${value.toFixed(2)}h`
            : Math.round(value).toString()
            : '-'}
        </span>
        <span style={{
          fontSize: '13px',
          color: isUp ? '#22c55e' : '#ef4444',
          fontWeight: 600,
        }}>
          {isUp ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}
        </span>
      </div>

      {/* 설명 */}
      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
        {description} · 목표 {targetLabel}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// SVG 라인 차트 생성 헬퍼
// ─────────────────────────────────────────────
function makeLinePath(
  data: KpiDataPoint[],
  getValue: (d: KpiDataPoint) => number,
  width: number,
  height: number,
  minVal: number,
  maxVal: number
): string {
  if (data.length < 2) return '';
  const pad = 8;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const range = maxVal - minVal || 1;

  return data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((getValue(d) - minVal) / range) * h;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
const RealtimeKpiMonitor: React.FC = () => {
  // 히스토리 데이터 (최근 120포인트 = 60초)
  const [history, setHistory] = useState<KpiDataPoint[]>([]);
  const [current, setCurrent] = useState<KpiDataPoint>({
    time: Date.now(), oee: 65.2, thp: 262, tat: 2.77, wip: 243
  });

  // 차트 컨테이너 너비 (ResizeObserver로 측정)
  const [chartWidth, setChartWidth] = useState<number>(600);
  const chartRef = useRef<HTMLDivElement>(null);

  // ── ResizeObserver: 컨테이너 크기 변화 감지 ──
  // 사이드바 전환 후 돌아왔을 때도 정확한 너비를 가져옴
  useEffect(() => {
<<<<<<< HEAD
    const initialData: KpiData[] = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 2000);
      initialData.push({
        time: time.toLocaleTimeString('ko-KR'),
        oee: 70 + Math.random() * 10,
        thp: 215 + Math.random() * 20,
        tat: 2.0 + Math.random() * 1.0,
        wip: 240 + Math.random() * 20,
      });
    }
    
    setKpiData(initialData);
    setCurrentKpi({
      oee: initialData[29].oee,
      thp: initialData[29].thp,
      tat: initialData[29].tat,
      wip: initialData[29].wip,
=======
    const el = chartRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setChartWidth(w);
      }
>>>>>>> main
    });

    observer.observe(el);

    // 초기 너비도 즉시 설정
    setChartWidth(el.getBoundingClientRect().width || 600);

    return () => observer.disconnect();
  }, []);

<<<<<<< HEAD
  // 실시간 데이터 업데이트 (500ms마다) - 기존 2000에서 변경
useEffect(() => {
  const interval = setInterval(() => {
    setKpiData((prevData) => {
      const newData = [...prevData];
      const lastData = newData[newData.length - 1];
      
      // 새로운 데이터 포인트 생성 (이전 값 기준 랜덤 변동)
      const newOee = Math.max(70, Math.min(82, lastData.oee + (Math.random() - 0.5) * 2));
      const newThp = Math.max(215, Math.min(235, lastData.thp + (Math.random() - 0.5) * 5));
      const newTat = Math.max(1.5, Math.min(3.0, lastData.tat + (Math.random() - 0.5) * 0.2));
      const newWip = Math.max(240, Math.min(260, lastData.wip + (Math.random() - 0.5) * 4));
      
      const newPoint: KpiData = {
        time: new Date().toLocaleTimeString('ko-KR'),
        oee: newOee,
        thp: newThp,
        tat: newTat,
        wip: newWip,
      };
      
      // 트렌드 계산
      setTrends({
        oee: newOee - lastData.oee,
        thp: newThp - lastData.thp,
        tat: newTat - lastData.tat,
        wip: newWip - lastData.wip,
      });
      
      // 현재 KPI 업데이트
      setCurrentKpi({
        oee: newOee,
        thp: newThp,
        tat: newTat,
        wip: newWip,
      });
      
      // 최근 60개 데이터만 유지 (30초 분량)
      newData.push(newPoint);
      if (newData.length > 60) {
        newData.shift();
      }
      
      return newData;
    });
  }, 500); // 500ms = 0.5초마다 업데이트
=======
  // ── 0.5초마다 KPI 업데이트 ──
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent(prev => {
        // 소폭 랜덤 변동 (실제 환경에서는 API 호출로 대체)
        const next: KpiDataPoint = {
          time: Date.now(),
          oee: Math.max(50, Math.min(85, prev.oee + (Math.random() - 0.5) * 0.8)),
          thp: Math.max(200, Math.min(280, prev.thp + (Math.random() - 0.5) * 1)),
          tat: Math.max(1.5, Math.min(4.5, prev.tat + (Math.random() - 0.5) * 0.02)),
          wip: Math.max(200, Math.min(300, prev.wip + (Math.random() - 0.5) * 1)),
        };
>>>>>>> main

        // 히스토리에 추가 (최대 120개 유지)
        setHistory(h => [...h.slice(-119), next]);
        return next;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // 이전 값 (delta 계산용)
  const prev = history.length > 0 ? history[history.length - 1] : current;

  // ── KPI 카드 설정 ──
  const cards: KpiCardProps[] = [
    {
      label: 'OEE', unit: '%', value: current.oee,
      target: 70, delta: current.oee - prev.oee,
      isAlarm: current.oee < 70,
      description: 'Overall Equipment Effectiveness',
      targetLabel: '70%',
    },
    {
      label: 'THP', unit: 'UPH', value: current.thp,
      target: 250, delta: current.thp - prev.thp,
      isAlarm: current.thp < 250,
      description: 'Throughput (UPH)',
      targetLabel: '250',
    },
    {
      label: 'TAT', unit: 'h', value: current.tat,
      target: 3.5, delta: current.tat - prev.tat,
      isAlarm: current.tat > 3.5,
      description: 'Turn-Around Time',
      targetLabel: '<3.5h',
    },
    {
      label: 'WIP', unit: 'EA', value: current.wip,
      target: 250, delta: current.wip - prev.wip,
      isAlarm: current.wip > 270 || current.wip < 230,
      description: 'Work In Process',
      targetLabel: '250EA',
    },
  ];

  // ── 차트 데이터 범위 ──
  const CHART_H = 160;
  const oeeMin = 50, oeeMax = 85;
  const thpMin = 200, thpMax = 280;
  const tatMin = 1.5, tatMax = 4.5;
  const wipMin = 200, wipMax = 300;

  return (
    <div>
      {/* ── KPI 카드 4개 ── */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {cards.map(c => <KpiCard key={c.label} {...c} />)}
      </div>

      {/* ── 실시간 트렌드 차트 ── */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px 24px',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>실시간 KPI 트렌드</div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>최근 60초 슬라이딩 윈도우 · 0.5초 업데이트</div>
          </div>
          {/* 범례 */}
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
            {[
              { label: 'OEE', color: '#3b82f6' },
              { label: 'THP', color: '#22c55e' },
              { label: 'TAT', color: '#f59e0b' },
              { label: 'WIP', color: '#a855f7' },
              { label: 'LIVE', color: '#ef4444' },
            ].map(({ label, color }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* SVG 차트 - ref로 실제 너비 측정 */}
        <div ref={chartRef} style={{ width: '100%' }}>
          {chartWidth > 0 && history.length >= 2 ? (
            <svg width={chartWidth} height={CHART_H} style={{ display: 'block' }}>
              {/* 배경 그리드 */}
              {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                <line key={t}
                  x1={0} y1={t * CHART_H}
                  x2={chartWidth} y2={t * CHART_H}
                  stroke="#f3f4f6" strokeWidth={1}
                />
              ))}

              {/* OEE 라인 (파랑) */}
              <path
                d={makeLinePath(history, d => d.oee, chartWidth, CHART_H, oeeMin, oeeMax)}
                fill="none" stroke="#3b82f6" strokeWidth={2}
              />
              {/* THP 라인 (초록) */}
              <path
                d={makeLinePath(history, d => d.thp, chartWidth, CHART_H, thpMin, thpMax)}
                fill="none" stroke="#22c55e" strokeWidth={2}
              />
              {/* TAT 라인 (주황) */}
              <path
                d={makeLinePath(history, d => d.tat, chartWidth, CHART_H, tatMin, tatMax)}
                fill="none" stroke="#f59e0b" strokeWidth={2}
              />
              {/* WIP 라인 (보라) */}
              <path
                d={makeLinePath(history, d => d.wip, chartWidth, CHART_H, wipMin, wipMax)}
                fill="none" stroke="#a855f7" strokeWidth={2}
              />

              {/* LIVE 점 (빨강) - 현재 위치 */}
              {history.length > 0 && (() => {
                const last = history[history.length - 1];
                const x = chartWidth - 8;
                const y = 8 + (CHART_H - 16) - ((last.oee - oeeMin) / (oeeMax - oeeMin)) * (CHART_H - 16);
                return <circle cx={x} cy={y} r={4} fill="#ef4444" />;
              })()}
            </svg>
          ) : (
            /* 데이터 수집 중 안내 */
            <div style={{
              height: CHART_H,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#9ca3af', fontSize: '13px',
            }}>
              데이터 수집 중... (잠시만 기다려주세요)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealtimeKpiMonitor;
