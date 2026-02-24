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
  return (
    <div style={{ width: '100%', height: '400px' }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
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
            stroke="rgba(0, 255, 65, 0.5)" 
            style={{ fontSize: '12px' }}
            tick={{ fill: 'rgba(0, 255, 65, 0.6)' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              border: '2px solid #00ff41',
              borderRadius: '4px',
              color: '#00ff41',
              fontFamily: 'Pretendard',
            }}
          />
          <Legend
            wrapperStyle={{ color: '#00ff41', fontSize: '13px' }}
          />
          <Line
            type="monotone"
            dataKey="oee_v"
            stroke="#00ff41"
            name="OEE 실제"
            strokeWidth={2}
            dot={{ fill: '#00ff41', r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="oee_t"
            stroke="rgba(0, 255, 65, 0.5)"
            name="OEE 목표"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="thp_v"
            stroke="#00d9ff"
            name="THP 실제"
            strokeWidth={2}
            dot={{ fill: '#00d9ff', r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="thp_t"
            stroke="rgba(0, 217, 255, 0.5)"
            name="THP 목표"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default KpiTrendChart;