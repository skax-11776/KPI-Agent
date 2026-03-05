/**
 * 캐시 통계 컴포넌트
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CacheStats: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/system/cache/stats');
      setStats(response.data);
    } catch (error) {
      console.error('캐시 통계 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async (cacheType: string) => {
    try {
      await axios.post(`/api/system/cache/clear?cache_type=${cacheType}`);
      alert(`${cacheType} 캐시가 초기화되었습니다.`);
      fetchStats();
    } catch (error) {
      console.error('캐시 초기화 실패:', error);
      alert('캐시 초기화에 실패했습니다.');
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return <div>로딩 중...</div>;
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">
          <span>💾</span>
          캐시 통계
        </h2>
        <button onClick={fetchStats} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
          🔄 새로고침
        </button>
      </div>
      <div className="card-body">
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* 알람 분석 캐시 */}
            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid #334155',
              borderRadius: '8px',
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#60a5fa' }}>
                🚨 알람 분석 캐시
              </h3>
              <div style={{ fontSize: '13px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>저장된 항목:</span>{' '}
                  <strong>{stats.analysis_cache.total_items}개</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>유효 시간:</span>{' '}
                  <strong>{stats.analysis_cache.ttl_seconds / 60}분</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>정리된 만료 항목:</span>{' '}
                  <strong>{stats.analysis_cache.expired_cleaned}개</strong>
                </div>
              </div>
              <button
                onClick={() => clearCache('analysis')}
                className="btn btn-secondary btn-full"
                style={{ marginTop: '12px', padding: '8px', fontSize: '13px' }}
              >
                초기화
              </button>
            </div>

            {/* 질문 답변 캐시 */}
            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid #334155',
              borderRadius: '8px',
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#4ade80' }}>
                💬 질문 답변 캐시
              </h3>
              <div style={{ fontSize: '13px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>저장된 항목:</span>{' '}
                  <strong>{stats.qa_cache.total_items}개</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>유효 시간:</span>{' '}
                  <strong>{stats.qa_cache.ttl_seconds / 60}분</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>정리된 만료 항목:</span>{' '}
                  <strong>{stats.qa_cache.expired_cleaned}개</strong>
                </div>
              </div>
              <button
                onClick={() => clearCache('qa')}
                className="btn btn-secondary btn-full"
                style={{ marginTop: '12px', padding: '8px', fontSize: '13px' }}
              >
                초기화
              </button>
            </div>
          </div>
        )}

        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid #2563eb',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#94a3b8',
        }}>
          <strong style={{ color: '#60a5fa' }}>💡 캐싱 효과</strong>
          <ul style={{ marginTop: '8px', marginLeft: '20px', lineHeight: '1.6' }}>
            <li>동일한 알람 재분석 시 LLM 호출 생략 → 비용 절감</li>
            <li>응답 속도 대폭 향상 (1분 → 즉시)</li>
            <li>서버 부하 감소</li>
          </ul>
        </div>

        <button
          onClick={() => clearCache('all')}
          className="btn btn-secondary btn-full"
          style={{ marginTop: '16px' }}
        >
          🗑️ 전체 캐시 초기화
        </button>
      </div>
    </div>
  );
};

export default CacheStats;