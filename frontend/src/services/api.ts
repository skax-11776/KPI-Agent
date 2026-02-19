/**
 * API 서비스
 */

import axios from 'axios';
import {
  AlarmAnalyzeResponse,
  QuestionResponse,
  LatestAlarmResponse,
} from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2분 (LLM 호출 시간 고려)
});

/**
 * 최신 알람 조회
 */
export const getLatestAlarm = async (): Promise<LatestAlarmResponse> => {
  const response = await apiClient.get<LatestAlarmResponse>('/alarm/latest');
  return response.data;
};

/**
 * 알람 분석
 */
export const analyzeAlarm = async (
  alarmDate?: string,
  alarmEqpId?: string,
  alarmKpi?: string
): Promise<AlarmAnalyzeResponse> => {
  const response = await apiClient.post<AlarmAnalyzeResponse>(
    '/alarm/analyze',
    {
      alarm_date: alarmDate,
      alarm_eqp_id: alarmEqpId,
      alarm_kpi: alarmKpi,
    }
  );
  return response.data;
};

/**
 * 질문 답변
 */
export const askQuestion = async (
  question: string
): Promise<QuestionResponse> => {
  const response = await apiClient.post<QuestionResponse>(
    '/question/answer',
    { question }
  );
  return response.data;
};

/**
 * 헬스체크
 */
export const healthCheck = async (): Promise<any> => {
  const response = await apiClient.get('/health');
  return response.data;
};