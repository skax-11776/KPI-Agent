/**
 * 알람 빈도 차트 컴포넌트
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface AlarmFrequencyChartProps {
  data: Array<{
    kpi: string;
    count: number;
  }>;
}

const AlarmFrequencyChart: React.FC<AlarmFrequencyChartProps> = ({ data }) => {
  const colors: { [key: string]: string } = {
    OEE: '#00ff41',
    THP: '#00d9ff',
    TAT: '#ffff00',
    WIP_EXCEED: '#ff0051',
    WIP_SHORTAGE: '#ff00ff',
  };

  return (
    <div style={{ width: '100%', height: '300px' }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 255, 65, 0.1)" />
          <XAxis
            dataKey="kpi"
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
          <Legend wrapperStyle={{ color: '#00ff41', fontSize: '13px' }} />
          <Bar dataKey="count" name="알람 발생 횟수" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[entry.kpi] || '#64748b'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AlarmFrequencyChart;