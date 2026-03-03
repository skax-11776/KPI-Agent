/**
 * 데이터베이스 조회 페이지 (Supabase 기반)
 */

import React, { useState, useEffect, useCallback } from 'react';
import CacheStats from '../components/CacheStats';

// ── 테이블별 API 설정 ────────────────────────────────────────────
// paginated: true → 서버사이드 페이지네이션 (page, page_size 파라미터 지원)
// paginated: false → 전체 데이터 한번에 반환
const TABLE_CONFIG: Record<string, { endpoint: string; paginated: boolean; hasDateFilter: boolean; hasEqpFilter: boolean }> = {
  KPI_DAILY:    { endpoint: '/api/kpi-daily',   paginated: false, hasDateFilter: true,  hasEqpFilter: true  },
  LOT_STATE:    { endpoint: '/api/lot-state',   paginated: true,  hasDateFilter: true,  hasEqpFilter: true  },
  EQP_STATE:    { endpoint: '/api/eqp-state',   paginated: true,  hasDateFilter: true,  hasEqpFilter: true  },
  RCP_STATE:    { endpoint: '/api/rcp-state',   paginated: false, hasDateFilter: false, hasEqpFilter: true  },
  SCENARIO_MAP: { endpoint: '/api/scenario-map',paginated: false, hasDateFilter: true,  hasEqpFilter: false },
};

const PAGE_SIZE = 500;

// ── 타입 ────────────────────────────────────────────────────────
interface FetchResult {
  data: Record<string, any>[];
  totalCount: number;
  totalPages: number;
}

// ── 컴포넌트 ────────────────────────────────────────────────────
const DatabasePage: React.FC = () => {
  const [selectedTable, setSelectedTable]   = useState<string>('KPI_DAILY');
  const [filterDate, setFilterDate]         = useState<string>('');
  const [filterEqp, setFilterEqp]           = useState<string>('');
  const [page, setPage]                     = useState<number>(1);

  const [data, setData]           = useState<Record<string, any>[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading]     = useState<boolean>(false);
  const [error, setError]         = useState<string | null>(null);

  const cfg = TABLE_CONFIG[selectedTable];

  // ── 데이터 fetch ──────────────────────────────────────────────
  const fetchData = useCallback(async (tbl: string, pg: number, date: string, eqp: string) => {
    const config = TABLE_CONFIG[tbl];
    if (!config) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (eqp)  params.set('eqp_id', eqp);
      if (config.paginated) {
        params.set('page', String(pg));
        params.set('page_size', String(PAGE_SIZE));
      }

      const url = `${config.endpoint}${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      const json = await res.json();

      if (!json.success) throw new Error(json.error || '조회 실패');

      const rows: Record<string, any>[] = json.data || [];
      const tc: number = json.total_count ?? json.count ?? rows.length;
      const tp: number = json.total_pages ?? 1;

      setData(rows);
      setTotalCount(tc);
      setTotalPages(tp);
    } catch (e: any) {
      setError(e.message || '데이터 조회 실패');
      setData([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  // 테이블·필터·페이지 변경 시 fetch
  useEffect(() => {
    fetchData(selectedTable, page, filterDate, filterEqp);
  }, [selectedTable, page, filterDate, filterEqp, fetchData]);

  // 테이블 변경 시 필터·페이지 초기화
  const handleTableChange = (tbl: string) => {
    setSelectedTable(tbl);
    setFilterDate('');
    setFilterEqp('');
    setPage(1);
  };

  // 필터 적용 시 페이지 1로 리셋
  const handleFilterApply = () => setPage(1);

  // ── 테이블 렌더 ───────────────────────────────────────────────
  const renderTable = () => {
    if (loading) return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>불러오는 중...</div>
    );
    if (error) return (
      <div style={{ padding: 20, color: '#f87171', background: 'rgba(248,113,113,0.08)', borderRadius: 8 }}>
        오류: {error}
      </div>
    );
    if (data.length === 0) return (
      <p style={{ color: '#94a3b8', padding: 20 }}>데이터 없음</p>
    );

    const columns = Object.keys(data[0]);
    return (
      <table className="data-table">
        <thead>
          <tr>{columns.map(col => <th key={col}>{col}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col}>{row[col] != null ? String(row[col]) : '-'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // ── UI ────────────────────────────────────────────────────────
  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span>📊</span>
            데이터베이스 조회
          </h2>
        </div>
        <div className="card-body">

          {/* 상단 컨트롤 영역 */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>

            {/* 테이블 선택 */}
            <div>
              <label style={labelStyle}>테이블</label>
              <select
                value={selectedTable}
                onChange={e => handleTableChange(e.target.value)}
                style={selectStyle}
              >
                {Object.keys(TABLE_CONFIG).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* 날짜 필터 */}
            {cfg.hasDateFilter && (
              <div>
                <label style={labelStyle}>날짜 (YYYY-MM-DD)</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  onBlur={handleFilterApply}
                  style={inputStyle}
                />
              </div>
            )}

            {/* EQP 필터 */}
            {cfg.hasEqpFilter && (
              <div>
                <label style={labelStyle}>장비 ID</label>
                <input
                  type="text"
                  value={filterEqp}
                  onChange={e => setFilterEqp(e.target.value)}
                  onBlur={handleFilterApply}
                  placeholder="예: EQP01"
                  style={{ ...inputStyle, width: 120 }}
                />
              </div>
            )}

            {/* 필터 초기화 */}
            {(filterDate || filterEqp) && (
              <button
                onClick={() => { setFilterDate(''); setFilterEqp(''); setPage(1); }}
                style={{ ...btnStyle(false), marginBottom: 0, alignSelf: 'flex-end' }}
              >
                필터 초기화
              </button>
            )}

            {/* 건수 표시 */}
            {!loading && !error && (
              <div style={{ color: '#94a3b8', fontSize: 13, alignSelf: 'flex-end', marginLeft: 'auto' }}>
                총 <strong style={{ color: '#e2e8f0' }}>{totalCount.toLocaleString()}</strong>건
                {cfg.paginated && totalPages > 1 && (
                  <span> · {page} / {totalPages} 페이지 ({PAGE_SIZE}건씩)</span>
                )}
              </div>
            )}
          </div>

          {/* 테이블 */}
          <div style={{ overflowX: 'auto' }}>
            {renderTable()}
          </div>

          {/* 페이지 네비게이션 (paginated 테이블만) */}
          {!loading && !error && cfg.paginated && totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center', alignItems: 'center' }}>
              <button onClick={() => setPage(1)}                         disabled={page === 1}          style={btnStyle(page === 1)}>처음</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))}  disabled={page === 1}          style={btnStyle(page === 1)}>이전</button>
              <span style={{ color: '#94a3b8', fontSize: 13, padding: '0 8px' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={btnStyle(page === totalPages)}>다음</button>
              <button onClick={() => setPage(totalPages)}                disabled={page === totalPages} style={btnStyle(page === totalPages)}>마지막</button>
            </div>
          )}

        </div>
      </div>

      {/* 캐시 통계 */}
      <CacheStats />
    </div>
  );
};

// ── 스타일 헬퍼 ────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 6, color: '#94a3b8', fontWeight: 600, fontSize: 13,
};

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 14,
  width: 220,
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 14,
  width: 160,
};

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 14px',
    backgroundColor: disabled ? '#1e293b' : '#334155',
    border: '1px solid #475569',
    borderRadius: 6,
    color: disabled ? '#475569' : '#e2e8f0',
    fontSize: 13,
    cursor: disabled ? 'default' : 'pointer',
  };
}

export default DatabasePage;
