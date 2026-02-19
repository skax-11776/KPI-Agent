/**
 * TypeScript 타입 정의
 */

export interface RootCause {
  cause: string;
  probability: number;
  evidence: string;
}

export interface AlarmAnalyzeResponse {
  success: boolean;
  message: string;
  alarm_date: string;
  alarm_eqp_id: string;
  alarm_kpi: string;
  root_causes: RootCause[];
  selected_cause: RootCause;
  final_report: string;
  report_id: string;
  rag_saved: boolean;
  llm_calls: number;
  processing_time?: number;
}

export interface SimilarReport {
  id: string;
  distance: number;
  metadata: {
    date: string;
    eqp_id: string;
    kpi: string;
    [key: string]: any;
  };
  preview: string;
}

export interface QuestionResponse {
  success: boolean;
  message: string;
  question: string;
  answer: string;
  report_exists: boolean;
  similar_reports: SimilarReport[];
  llm_calls: number;
  processing_time?: number;
}

export interface LatestAlarmResponse {
  success: boolean;
  date: string;
  eqp_id: string;
  kpi: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}