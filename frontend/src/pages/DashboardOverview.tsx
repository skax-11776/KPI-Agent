/**
 * 대시보드 개요 페이지
 */

import React from 'react';
import RealtimeKpiMonitor from '../components/RealtimeKpiMonitor';
import KpiTrendChart from '../components/KpiTrendChart';
import AlarmFrequencyChart from '../components/AlarmFrequencyChart';

const DashboardOverview: React.FC = () => {
  const kpiTrendData = [
    { date: '01-25', oee_v: 72.5, oee_t: 70, thp_v: 245, thp_t: 250 },
    { date: '01-26', oee_v: 74.1, oee_t: 70, thp_v: 240, thp_t: 250 },
    { date: '01-27', oee_v: 71.6, oee_t: 70, thp_v: 235, thp_t: 250 },
    { date: '01-28', oee_v: 73.8, oee_t: 70, thp_v: 240, thp_t: 250 },
    { date: '01-29', oee_v: 72.2, oee_t: 70, thp_v: 230, thp_t: 250 },
    { date: '01-30', oee_v: 71.0, oee_t: 70, thp_v: 245, thp_t: 250 },
    { date: '01-31', oee_v: 76.4, oee_t: 70, thp_v: 227, thp_t: 250 },
  ];

  const alarmFrequencyData = [
    { kpi: 'OEE', count: 3 },
    { kpi: 'THP', count: 4 },
    { kpi: 'TAT', count: 2 },
    { kpi: 'WIP_EXCEED', count: 2 },
    { kpi: 'WIP_SHORTAGE', count: 1 },
  ];

  return (
    <div>
      {/* 헤더 정보 */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px'
        }}>
          <div>
            <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>
              시스템 상태
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#22c55e' }}>
              ● OPERATIONAL
            </div>
          </div>
          <div>
            <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>
              마지막 업데이트
            </div>
            <div style={{ fontSize: '16px', fontFamily: 'Roboto Mono' }}>
              {new Date().toLocaleString('ko-KR')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>
              총 모니터링 장비
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>
              12 UNITS
            </div>
          </div>
        </div>
      </div>

      {/* 실시간 KPI 모니터 */}
      <RealtimeKpiMonitor />

      {/* 과거 7일 트렌드 */}
      <div className="card" style={{ marginTop: '30px' }}>
        <div className="card-header">
          <h2 className="card-title">
            <span>📊</span> 주간 KPI 트렌드 (최근 7일)
          </h2>
        </div>
        <div className="card-body">
          <KpiTrendChart data={kpiTrendData} />
        </div>
      </div>

      {/* 알람 빈도 */}
      <div className="card" style={{ marginTop: '30px' }}>
        <div className="card-header">
          <h2 className="card-title">
            <span>🔔</span> KPI별 알람 발생 통계
          </h2>
        </div>
        <div className="card-body">
          <AlarmFrequencyChart data={alarmFrequencyData} />
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;