/**
 * KPI 트렌드 차트 컴포넌트
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

interface KpiTrendChartProps {
  data: Array<{
    date: string;
    oee_v: number;
    thp_v: number;
    oee_t: number;
    thp_t: number;
  }>;
}

const KpiTrendChart: React.FC<KpiTrendChartProps> = ({ data }) => {
  // 달성률(%) 변환: OEE는 실제/목표, THP도 실제/목표 × 100
  const rateData = data.map(d => ({
    date: d.date,
    oee_rate: Math.round(d.oee_v / d.oee_t * 1000) / 10,
    thp_rate: Math.round(d.thp_v / d.thp_t * 1000) / 10,
  }));

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <ResponsiveContainer>
        <LineChart
          data={rateData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 255, 65, 0.1)" />
          <XAxis
            dataKey="date"
            stroke="rgba(0, 255, 65, 0.5)"
            style={{ fontSize: '12px' }}
            tick={{ fill: 'rgba(0, 255, 65, 0.6)' }}
          />
          <YAxis
            domain={[70, 120]}
            tickFormatter={(v) => `${v}%`}
            stroke="rgba(0, 255, 65, 0.5)"
            style={{ fontSize: '12px' }}
            tick={{ fill: 'rgba(0, 255, 65, 0.6)' }}
          />
          <Tooltip
            formatter={(value: number | undefined) => value !== undefined ? [`${value.toFixed(1)}%`] : ['N/A']}
            contentStyle={{
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              border: '2px solid #00ff41',
              borderRadius: '4px',
              color: '#00ff41',
              fontFamily: 'Roboto Mono',
            }}
          />
          <Legend
            wrapperStyle={{ color: '#00ff41', fontSize: '13px' }}
          />
          <ReferenceLine
            y={100}
            stroke="#ff4444"
            strokeDasharray="6 3"
            strokeWidth={2}
            label={{ value: '목표 100%', fill: '#ff4444', fontSize: 11, position: 'right' }}
          />
          <Line
            type="monotone"
            dataKey="oee_rate"
            stroke="#00ff41"
            name="OEE 달성률"
            strokeWidth={2}
            dot={{ fill: '#00ff41', r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="thp_rate"
            stroke="#00d9ff"
            name="THP 달성률"
            strokeWidth={2}
            dot={{ fill: '#00d9ff', r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default KpiTrendChart;