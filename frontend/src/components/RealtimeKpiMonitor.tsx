/**
 * 실시간 KPI 모니터링 컴포넌트
 */

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface KpiData {
  time: string;
  oee: number;
  thp: number;
  tat: number;
  wip: number;
}

const RealtimeKpiMonitor: React.FC = () => {
  const [kpiData, setKpiData] = useState<KpiData[]>([]);
  const [currentKpi, setCurrentKpi] = useState({
    oee: 0,
    thp: 0,
    tat: 0,
    wip: 0,
  });
  const [trends, setTrends] = useState({
    oee: 0,
    thp: 0,
    tat: 0,
    wip: 0,
  });

  // 초기 데이터 생성
  useEffect(() => {
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
    });
  }, []);

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

  return () => clearInterval(interval);
}, []);

  const formatTrend = (value: number) => {
    const sign = value >= 0 ? '▲' : '▼';
    const color = value >= 0 ? '#00ff41' : '#ff0051';
    return (
      <span style={{ color }}>
        {sign} {Math.abs(value).toFixed(2)}
      </span>
    );
  };

  return (
    <div>
      {/* 실시간 KPI 카드 */}
      <div className="kpi-monitor-grid">
        {/* OEE */}
        <div className="kpi-monitor-card">
          <div className="kpi-label">OEE (Overall Equipment Effectiveness)</div>
          <div className="kpi-value">{currentKpi.oee.toFixed(1)}%</div>
          <div className={`kpi-trend ${trends.oee >= 0 ? 'up' : 'down'}`}>
            {formatTrend(trends.oee)}
            <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.7 }}>
              목표: 70%
            </span>
          </div>
        </div>

        {/* THP */}
        <div className="kpi-monitor-card">
          <div className="kpi-label">THP (Throughput)</div>
          <div className="kpi-value">{Math.round(currentKpi.thp)}</div>
          <div className={`kpi-trend ${trends.thp >= 0 ? 'up' : 'down'}`}>
            {formatTrend(trends.thp)}
            <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.7 }}>
              목표: 250개
            </span>
          </div>
        </div>

        {/* TAT */}
        <div className="kpi-monitor-card">
          <div className="kpi-label">TAT (Turn Around Time)</div>
          <div className="kpi-value">{currentKpi.tat.toFixed(2)}h</div>
          <div className={`kpi-trend ${trends.tat <= 0 ? 'up' : 'down'}`}>
            {formatTrend(-trends.tat)}
            <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.7 }}>
              목표: &lt;3.5h
            </span>
          </div>
        </div>

        {/* WIP */}
        <div className="kpi-monitor-card">
          <div className="kpi-label">WIP (Work In Process)</div>
          <div className="kpi-value">{Math.round(currentKpi.wip)}</div>
          <div className={`kpi-trend ${trends.wip >= 0 ? 'up' : 'down'}`}>
            {formatTrend(trends.wip)}
            <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.7 }}>
              목표: 250개
            </span>
          </div>
        </div>
      </div>

      {/* 실시간 차트 */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span>📈</span>
            실시간 KPI 트렌드 (최근 60초)
          </h2>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            🔴 LIVE - 0.5초마다 업데이트
          </div>
        </div>
        <div className="card-body">
          <div className="realtime-chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={kpiData}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="rgba(0, 255, 65, 0.1)" 
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  stroke="rgba(0, 255, 65, 0.5)"
                  style={{ fontSize: '10px' }}
                  tick={{ fill: 'rgba(0, 255, 65, 0.6)' }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="rgba(0, 255, 65, 0.5)"
                  style={{ fontSize: '10px' }}
                  tick={{ fill: 'rgba(0, 255, 65, 0.6)' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="rgba(0, 255, 65, 0.5)"
                  style={{ fontSize: '10px' }}
                  tick={{ fill: 'rgba(0, 255, 65, 0.6)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    border: '1px solid #00ff41',
                    borderRadius: '4px',
                    color: '#00ff41',
                    fontFamily: 'Roboto Mono',
                    fontSize: '12px',
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="oee"
                  stroke="#00ff41"
                  strokeWidth={2}
                  dot={false}
                  name="OEE (%)"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="thp"
                  stroke="#00d9ff"
                  strokeWidth={2}
                  dot={false}
                  name="THP (개)"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="tat"
                  stroke="#ffff00"
                  strokeWidth={2}
                  dot={false}
                  name="TAT (h)"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="wip"
                  stroke="#ff00ff"
                  strokeWidth={2}
                  dot={false}
                  name="WIP (개)"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealtimeKpiMonitor;