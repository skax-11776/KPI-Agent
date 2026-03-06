// ================================================================
// App.tsx — KPI Monitoring Agent (Full Integration)
// 변경사항:
//   1. Alarm Center → 최신알람(2026-01-31) / 과거이력(PDF 11건) 탭 분리
//   2. Database 탭 → 5개 CSV 원본 테이블 뷰어
//   3. AI Assistant → Anthropic API 실제 LLM 호출
//   4. PDF 원본 내용 전문 표시
// ================================================================
import React, { useState, useEffect, useRef, useCallback } from "react";
import ContactModal from "./components/ContactModal";
import ReactMarkdown from "react-markdown";

// 타입
interface Report {
  id: number; filename: string; date: string; time: string;
  eqp_id: string; line_id: string; oper_id: string; alarm_kpi: string;
  target_raw: string; actual_raw: string; diff_raw: string;
  target_num: number; actual_num: number;
  causes: string[]; scenarios: string[]; results: string[];
  pdf_raw: { basic_info: string; problem: string; root_cause: string; scenario: string; result: string; };
}
interface ChatMessage { role: "user"|"assistant"; content: string; timestamp: string; source?: "llm"|"rag"|"error"; suggestedTab?: string; noSelect?: boolean; highlightedDate?: string; }
interface ChatExport { id:string; title:string; date:string; msgCount:number; messages:ChatMessage[]; savedToS3?:boolean; }
interface RealtimePoint { time: string; oee: number; thp: number; tat: number; wip: number; }
interface LiveKPI { oee:number;thp:number;tat:number;wip:number; oee_prev:number;thp_prev:number;tat_prev:number;wip_prev:number; }

// ────────────────────────── KPI Meta ──────────────────────────
const KPI_META: Record<string,{label:string;color:string;bg:string;textColor:string}> = {
  OEE:          {label:"OEE",        color:"#2563eb",bg:"#dbeafe",textColor:"#1d4ed8"},
  THP:          {label:"Throughput", color:"#059669",bg:"#d1fae5",textColor:"#065f46"},
  TAT:          {label:"TAT",        color:"#d97706",bg:"#fef3c7",textColor:"#92400e"},
  WIP_EXCEED:   {label:"WIP 초과",   color:"#dc2626",bg:"#fee2e2",textColor:"#991b1b"},
  WIP_SHORTAGE: {label:"WIP 부족",   color:"#7c3aed",bg:"#ede9fe",textColor:"#5b21b6"},
};

// ────────────────────────── 최신 알람 (2026-01-31 EQP12 THP) ──────────────────────────
const LATEST_ALARM = {
  date:"2026-01-31", time:"09:10", eqp_id:"EQP12", line_id:"LINE2", oper_id:"OPER4",
  alarm_kpi:"THP", thp_t:250, thp_v:227, oee_t:70, oee_v:76.44, tat_t:3.5, tat_v:2.27, wip_t:250, wip_v:250,
  causes:[
    "RCP23·RCP24 반복 처리 중 DOWN 이벤트 4회 발생 (총 다운타임 약 55분)",
    "RCP24 복잡도 10, RCP23 복잡도 8 — 고복잡도 레시피 연속 처리",
    "Throughput 목표 250 대비 실적 227 (-23) 미달",
    "LOT_02864~02868 구간 전체 처리 지연 발생",
  ],
  scenarios:[
    "RCP23·RCP24 파라미터 점검 및 복잡도 조정 검토",
    "EQP12 장비 긴급 점검 (DOWN 패턴: 매 LOT 처리 시작 55~65분 후 반복)",
    "고복잡도 레시피 처리 전 예방 점검 프로세스 강화",
    "LINE2 OPER4 구간 대체 장비(EQP11) 활용 검토",
  ],
  eqp_timeline:[
    {time:"00:00~00:30",state:"IDLE", lot:"-",                   rcp:"-"},
    {time:"00:30~01:25",state:"RUN",  lot:"LOT_20260131_02864",  rcp:"RCP23"},
    {time:"01:25~01:40",state:"DOWN", lot:"LOT_20260131_02864",  rcp:"RCP23"},
    {time:"01:40~02:35",state:"RUN",  lot:"LOT_20260131_02864",  rcp:"RCP23"},
    {time:"02:40~03:35",state:"RUN",  lot:"LOT_20260131_02865",  rcp:"RCP24"},
    {time:"03:35~03:50",state:"DOWN", lot:"LOT_20260131_02865",  rcp:"RCP24"},
    {time:"03:50~04:45",state:"RUN",  lot:"LOT_20260131_02865",  rcp:"RCP24"},
    {time:"05:45~06:00",state:"DOWN", lot:"LOT_20260131_02866",  rcp:"RCP23"},
    {time:"07:55~08:10",state:"DOWN", lot:"LOT_20260131_02867",  rcp:"RCP24"},
    {time:"09:10~11:00",state:"RUN",  lot:"LOT_20260131_02868",  rcp:"RCP23"},
  ],
};

// ────────────────────────── 과거 이력 PDF 11건 ──────────────────────────
const REPORTS: Report[] = [
  {id:1,filename:"report_20260120_EQP01_OEE.pdf",date:"2026-01-20",time:"15:56",eqp_id:"EQP01",line_id:"LINE1",oper_id:"OPER1",alarm_kpi:"OEE",target_raw:"70.0%",actual_raw:"57.73%",diff_raw:"-12.27%",target_num:70,actual_num:57.73,
   causes:["장비 다운타임 3시간 발생 (01:25~04:25)","RCP01 레시피 실행 중 HOLD 상태 발생","복잡도 높은 레시피(9/10) 사용으로 인한 처리 시간 증가"],
   scenarios:["장비 긴급 점검 및 유지보수 실시","다운타임 발생 원인 파악 (센서 오류)","레시피 파라미터 조정 (복잡도 낮은 RCP02로 전환)","예방 정비 스케줄 재조정"],
   results:["OEE 회복: 57.73% → 70.0% (다음날 예상)","다운타임 제로화","예상 손실 비용: 약 500만원 절감"],
   pdf_raw:{basic_info:"날짜: 2026-01-20 | 시간: 15:56 | 장비: EQP01 | 라인: LINE1 | 공정: OPER1",problem:"문제 KPI: OEE\n목표치: 70.0% | 실제치: 57.73% | 차이: -12.27%",root_cause:"1. 장비 다운타임 3시간 발생 (01:25~04:25)\n2. RCP01 레시피 실행 중 HOLD 상태 발생\n3. 복잡도 높은 레시피(9/10) 사용으로 인한 처리 시간 증가",scenario:"1. 장비 긴급 점검 및 유지보수 실시\n2. 다운타임 발생 원인 파악 (센서 오류)\n3. 레시피 파라미터 조정 (복잡도 낮은 RCP02로 전환)\n4. 예방 정비 스케줄 재조정",result:"OEE 회복: 57.73% → 70.0% (다음날 예상)\n다운타임 제로화\n예상 손실 비용: 약 500만원 절감"}},
  {id:2,filename:"report_20260121_EQP02_THP.pdf",date:"2026-01-21",time:"13:23",eqp_id:"EQP02",line_id:"LINE1",oper_id:"OPER2",alarm_kpi:"THP",target_raw:"1000UPH",actual_raw:"729UPH",diff_raw:"-271UPH",target_num:1000,actual_num:729,
   causes:["자재 공급 지연으로 인한 설비 유휴 시간 증가","로더(Loader) 모듈 일시적 통신 장애","신규 오퍼레이터의 조작 미숙으로 인한 택트 타임 증가"],
   scenarios:["AGV 물류 이동 경로 최적화 및 우선 순위 조정","로더 통신 케이블 교체 및 네트워크 리셋","오퍼레이터 추가 교육 실시 (SOP 준수 강화)","실시간 모니터링 알람 임계값 재설정"],
   results:["THP 정상화: 729UPH → 1000UPH 달성","물류 대기 시간 80% 감소","생산성 향상으로 인한 일일 목표량 달성 가능"],
   pdf_raw:{basic_info:"날짜: 2026-01-21 | 시간: 13:23 | 장비: EQP02 | 라인: LINE1 | 공정: OPER2",problem:"문제 KPI: THP (Throughput)\n목표치: 1000UPH | 실제치: 729UPH | 차이: -271UPH",root_cause:"1. 자재 공급 지연으로 인한 설비 유휴 시간 증가\n2. 로더(Loader) 모듈 일시적 통신 장애\n3. 신규 오퍼레이터의 조작 미숙으로 인한 택트 타임 증가",scenario:"1. AGV 물류 이동 경로 최적화 및 우선 순위 조정\n2. 로더 통신 케이블 교체 및 네트워크 리셋\n3. 오퍼레이터 추가 교육 실시 (SOP 준수 강화)\n4. 실시간 모니터링 알람 임계값 재설정",result:"THP 정상화: 729UPH → 1000UPH 달성\n물류 대기 시간 80% 감소\n생산성 향상으로 인한 일일 목표량 달성 가능"}},
  {id:3,filename:"report_20260122_EQP03_TAT.pdf",date:"2026-01-22",time:"18:48",eqp_id:"EQP03",line_id:"LINE2",oper_id:"OPER1",alarm_kpi:"TAT",target_raw:"48.0h",actual_raw:"61.71h",diff_raw:"+13.71h",target_num:48,actual_num:61.71,
   causes:["공정 챔버 내 온도 안정화 시간 과다 소요","이전 공정에서의 대기 큐(Queue) 적체","품질 검사(QA) 샘플링 비율 증가로 인한 지연"],
   scenarios:["온도 제어 PID 파라미터 튜닝","스케줄링 로직 변경 (FIFO → 긴급 우선)","공정 안정화 확인 후 샘플링 비율 정상화","히터 부품 예비품 교체 검토"],
   results:["TAT 단축: 61.71h → 48.0h 수준 회복","병목 공정(Bottleneck) 해소","납기 준수율 99% 유지"],
   pdf_raw:{basic_info:"날짜: 2026-01-22 | 시간: 18:48 | 장비: EQP03 | 라인: LINE2 | 공정: OPER1",problem:"문제 KPI: TAT (Turnaround Time)\n목표치: 48.0Hours | 실제치: 61.71Hours | 차이: +13.71Hours",root_cause:"1. 공정 챔버 내 온도 안정화 시간 과다 소요\n2. 이전 공정에서의 대기 큐(Queue) 적체\n3. 품질 검사(QA) 샘플링 비율 증가로 인한 지연",scenario:"1. 온도 제어 PID 파라미터 튜닝\n2. 스케줄링 로직 변경 (FIFO → 긴급 우선)\n3. 공정 안정화 확인 후 샘플링 비율 정상화\n4. 히터 부품 예비품 교체 검토",result:"TAT 단축: 61.71Hours → 48.0Hours 수준 회복\n병목 공정(Bottleneck) 해소\n납기 준수율 99% 유지"}},
  {id:4,filename:"report_20260123_EQP04_WIP_EXCEED.pdf",date:"2026-01-23",time:"10:36",eqp_id:"EQP04",line_id:"LINE2",oper_id:"OPER2",alarm_kpi:"WIP_EXCEED",target_raw:"500EA",actual_raw:"670EA",diff_raw:"+170EA",target_num:500,actual_num:670,
   causes:["전/후 공정 간의 생산 속도 불균형 (Line Balancing 이슈)","설비 일시 정지로 인한 재공 재고 변동","생산 계획 변경에 따른 긴급 랏(Lot) 투입"],
   scenarios:["라인 밸런싱 재조정 및 인원 재배치","버퍼(Buffer) 구간 용량 임시 증설","생산 계획 부서와 협의하여 투입량 조절","WIP 추적 시스템 동기화 점검"],
   results:["WIP 정상화: 670EA → 500EA","라인 흐름성(Flow) 개선","불필요한 재고 비용 및 공간 점유 해소"],
   pdf_raw:{basic_info:"날짜: 2026-01-23 | 시간: 10:36 | 장비: EQP04 | 라인: LINE2 | 공정: OPER2",problem:"문제 KPI: WIP (Work In Process) - 과다\n목표치: 500EA | 실제치: 670EA | 차이: +170EA",root_cause:"1. 전/후 공정 간의 생산 속도 불균형 (Line Balancing 이슈)\n2. 설비 일시 정지로 인한 재공 재고 변동\n3. 생산 계획 변경에 따른 긴급 랏(Lot) 투입",scenario:"1. 라인 밸런싱 재조정 및 인원 재배치\n2. 버퍼(Buffer) 구간 용량 임시 증설\n3. 생산 계획 부서와 협의하여 투입량 조절\n4. WIP 추적 시스템 동기화 점검",result:"WIP 정상화: 670EA → 500EA\n라인 흐름성(Flow) 개선\n불필요한 재고 비용 및 공간 점유 해소"}},
  {id:5,filename:"report_20260124_EQP05_WIP_SHORTAGE.pdf",date:"2026-01-24",time:"22:40",eqp_id:"EQP05",line_id:"LINE3",oper_id:"OPER1",alarm_kpi:"WIP_SHORTAGE",target_raw:"500EA",actual_raw:"218EA",diff_raw:"-282EA",target_num:500,actual_num:218,
   causes:["전/후 공정 간의 생산 속도 불균형 (Line Balancing 이슈)","설비 일시 정지로 인한 재공 재고 변동","생산 계획 변경에 따른 긴급 랏(Lot) 투입"],
   scenarios:["라인 밸런싱 재조정 및 인원 재배치","버퍼(Buffer) 구간 용량 임시 증설","생산 계획 부서와 협의하여 투입량 조절","WIP 추적 시스템 동기화 점검"],
   results:["WIP 정상화: 218EA → 500EA","라인 흐름성(Flow) 개선","불필요한 재고 비용 및 공간 점유 해소"],
   pdf_raw:{basic_info:"날짜: 2026-01-24 | 시간: 22:40 | 장비: EQP05 | 라인: LINE3 | 공정: OPER1",problem:"문제 KPI: WIP (Work In Process) - 부족\n목표치: 500EA | 실제치: 218EA | 차이: -282EA",root_cause:"1. 전/후 공정 간의 생산 속도 불균형 (Line Balancing 이슈)\n2. 설비 일시 정지로 인한 재공 재고 변동\n3. 생산 계획 변경에 따른 긴급 랏(Lot) 투입",scenario:"1. 라인 밸런싱 재조정 및 인원 재배치\n2. 버퍼(Buffer) 구간 용량 임시 증설\n3. 생산 계획 부서와 협의하여 투입량 조절\n4. WIP 추적 시스템 동기화 점검",result:"WIP 정상화: 218EA → 500EA\n라인 흐름성(Flow) 개선\n불필요한 재고 비용 및 공간 점유 해소"}},
  {id:6,filename:"report_20260125_EQP06_OEE.pdf",date:"2026-01-25",time:"14:14",eqp_id:"EQP06",line_id:"LINE3",oper_id:"OPER2",alarm_kpi:"OEE",target_raw:"70.0%",actual_raw:"56.48%",diff_raw:"-13.52%",target_num:70,actual_num:56.48,
   causes:["장비 다운타임 3시간 발생 (01:25~04:25)","RCP01 레시피 실행 중 HOLD 상태 발생","복잡도 높은 레시피(9/10) 사용으로 인한 처리 시간 증가"],
   scenarios:["장비 긴급 점검 및 유지보수 실시","다운타임 발생 원인 파악 (센서 오류)","레시피 파라미터 조정 (복잡도 낮은 RCP02로 전환)","예방 정비 스케줄 재조정"],
   results:["OEE 회복: 56.48% → 70.0% (다음날 예상)","다운타임 제로화","예상 손실 비용: 약 500만원 절감"],
   pdf_raw:{basic_info:"날짜: 2026-01-25 | 시간: 14:14 | 장비: EQP06 | 라인: LINE3 | 공정: OPER2",problem:"문제 KPI: OEE\n목표치: 70.0% | 실제치: 56.48% | 차이: -13.52%",root_cause:"1. 장비 다운타임 3시간 발생 (01:25~04:25)\n2. RCP01 레시피 실행 중 HOLD 상태 발생\n3. 복잡도 높은 레시피(9/10) 사용으로 인한 처리 시간 증가",scenario:"1. 장비 긴급 점검 및 유지보수 실시\n2. 다운타임 발생 원인 파악 (센서 오류)\n3. 레시피 파라미터 조정 (복잡도 낮은 RCP02로 전환)\n4. 예방 정비 스케줄 재조정",result:"OEE 회복: 56.48% → 70.0% (다음날 예상)\n다운타임 제로화\n예상 손실 비용: 약 500만원 절감"}},
  {id:7,filename:"report_20260126_EQP07_THP.pdf",date:"2026-01-26",time:"15:28",eqp_id:"EQP07",line_id:"LINE1",oper_id:"OPER1",alarm_kpi:"THP",target_raw:"1000UPH",actual_raw:"865UPH",diff_raw:"-135UPH",target_num:1000,actual_num:865,
   causes:["자재 공급 지연으로 인한 설비 유휴 시간 증가","로더(Loader) 모듈 일시적 통신 장애","신규 오퍼레이터의 조작 미숙으로 인한 택트 타임 증가"],
   scenarios:["AGV 물류 이동 경로 최적화 및 우선 순위 조정","로더 통신 케이블 교체 및 네트워크 리셋","오퍼레이터 추가 교육 실시 (SOP 준수 강화)","실시간 모니터링 알람 임계값 재설정"],
   results:["THP 정상화: 865UPH → 1000UPH 달성","물류 대기 시간 80% 감소","생산성 향상으로 인한 일일 목표량 달성 가능"],
   pdf_raw:{basic_info:"날짜: 2026-01-26 | 시간: 15:28 | 장비: EQP07 | 라인: LINE1 | 공정: OPER1",problem:"문제 KPI: THP (Throughput)\n목표치: 1000UPH | 실제치: 865UPH | 차이: -135UPH",root_cause:"1. 자재 공급 지연으로 인한 설비 유휴 시간 증가\n2. 로더(Loader) 모듈 일시적 통신 장애\n3. 신규 오퍼레이터의 조작 미숙으로 인한 택트 타임 증가",scenario:"1. AGV 물류 이동 경로 최적화 및 우선 순위 조정\n2. 로더 통신 케이블 교체 및 네트워크 리셋\n3. 오퍼레이터 추가 교육 실시 (SOP 준수 강화)\n4. 실시간 모니터링 알람 임계값 재설정",result:"THP 정상화: 865UPH → 1000UPH 달성\n물류 대기 시간 80% 감소\n생산성 향상으로 인한 일일 목표량 달성 가능"}},
  {id:8,filename:"report_20260127_EQP08_TAT.pdf",date:"2026-01-27",time:"15:52",eqp_id:"EQP08",line_id:"LINE1",oper_id:"OPER2",alarm_kpi:"TAT",target_raw:"48.0h",actual_raw:"62.26h",diff_raw:"+14.26h",target_num:48,actual_num:62.26,
   causes:["공정 챔버 내 온도 안정화 시간 과다 소요","이전 공정에서의 대기 큐(Queue) 적체","품질 검사(QA) 샘플링 비율 증가로 인한 지연"],
   scenarios:["온도 제어 PID 파라미터 튜닝","스케줄링 로직 변경 (FIFO → 긴급 우선)","공정 안정화 확인 후 샘플링 비율 정상화","히터 부품 예비품 교체 검토"],
   results:["TAT 단축: 62.26h → 48.0h 수준 회복","병목 공정(Bottleneck) 해소","납기 준수율 99% 유지"],
   pdf_raw:{basic_info:"날짜: 2026-01-27 | 시간: 15:52 | 장비: EQP08 | 라인: LINE1 | 공정: OPER2",problem:"문제 KPI: TAT (Turnaround Time)\n목표치: 48.0Hours | 실제치: 62.26Hours | 차이: +14.26Hours",root_cause:"1. 공정 챔버 내 온도 안정화 시간 과다 소요\n2. 이전 공정에서의 대기 큐(Queue) 적체\n3. 품질 검사(QA) 샘플링 비율 증가로 인한 지연",scenario:"1. 온도 제어 PID 파라미터 튜닝\n2. 스케줄링 로직 변경 (FIFO → 긴급 우선)\n3. 공정 안정화 확인 후 샘플링 비율 정상화\n4. 히터 부품 예비품 교체 검토",result:"TAT 단축: 62.26Hours → 48.0Hours 수준 회복\n병목 공정(Bottleneck) 해소\n납기 준수율 99% 유지"}},
  {id:9,filename:"report_20260128_EQP09_WIP_EXCEED.pdf",date:"2026-01-28",time:"22:14",eqp_id:"EQP09",line_id:"LINE2",oper_id:"OPER1",alarm_kpi:"WIP_EXCEED",target_raw:"500EA",actual_raw:"730EA",diff_raw:"+230EA",target_num:500,actual_num:730,
   causes:["전/후 공정 간의 생산 속도 불균형 (Line Balancing 이슈)","설비 일시 정지로 인한 재공 재고 변동","생산 계획 변경에 따른 긴급 랏(Lot) 투입"],
   scenarios:["라인 밸런싱 재조정 및 인원 재배치","버퍼(Buffer) 구간 용량 임시 증설","생산 계획 부서와 협의하여 투입량 조절","WIP 추적 시스템 동기화 점검"],
   results:["WIP 정상화: 730EA → 500EA","라인 흐름성(Flow) 개선","불필요한 재고 비용 및 공간 점유 해소"],
   pdf_raw:{basic_info:"날짜: 2026-01-28 | 시간: 22:14 | 장비: EQP09 | 라인: LINE2 | 공정: OPER1",problem:"문제 KPI: WIP (Work In Process) - 과다\n목표치: 500EA | 실제치: 730EA | 차이: +230EA",root_cause:"1. 전/후 공정 간의 생산 속도 불균형 (Line Balancing 이슈)\n2. 설비 일시 정지로 인한 재공 재고 변동\n3. 생산 계획 변경에 따른 긴급 랏(Lot) 투입",scenario:"1. 라인 밸런싱 재조정 및 인원 재배치\n2. 버퍼(Buffer) 구간 용량 임시 증설\n3. 생산 계획 부서와 협의하여 투입량 조절\n4. WIP 추적 시스템 동기화 점검",result:"WIP 정상화: 730EA → 500EA\n라인 흐름성(Flow) 개선\n불필요한 재고 비용 및 공간 점유 해소"}},
  {id:10,filename:"report_20260129_EQP10_WIP_SHORTAGE.pdf",date:"2026-01-29",time:"23:15",eqp_id:"EQP10",line_id:"LINE2",oper_id:"OPER2",alarm_kpi:"WIP_SHORTAGE",target_raw:"500EA",actual_raw:"295EA",diff_raw:"-205EA",target_num:500,actual_num:295,
   causes:["전/후 공정 간의 생산 속도 불균형 (Line Balancing 이슈)","설비 일시 정지로 인한 재공 재고 변동","생산 계획 변경에 따른 긴급 랏(Lot) 투입"],
   scenarios:["라인 밸런싱 재조정 및 인원 재배치","버퍼(Buffer) 구간 용량 임시 증설","생산 계획 부서와 협의하여 투입량 조절","WIP 추적 시스템 동기화 점검"],
   results:["WIP 정상화: 295EA → 500EA","라인 흐름성(Flow) 개선","불필요한 재고 비용 및 공간 점유 해소"],
   pdf_raw:{basic_info:"날짜: 2026-01-29 | 시간: 23:15 | 장비: EQP10 | 라인: LINE2 | 공정: OPER2",problem:"문제 KPI: WIP (Work In Process) - 부족\n목표치: 500EA | 실제치: 295EA | 차이: -205EA",root_cause:"1. 전/후 공정 간의 생산 속도 불균형 (Line Balancing 이슈)\n2. 설비 일시 정지로 인한 재공 재고 변동\n3. 생산 계획 변경에 따른 긴급 랏(Lot) 투입",scenario:"1. 라인 밸런싱 재조정 및 인원 재배치\n2. 버퍼(Buffer) 구간 용량 임시 증설\n3. 생산 계획 부서와 협의하여 투입량 조절\n4. WIP 추적 시스템 동기화 점검",result:"WIP 정상화: 295EA → 500EA\n라인 흐름성(Flow) 개선\n불필요한 재고 비용 및 공간 점유 해소"}},
  {id:11,filename:"report_20260130_EQP11_OEE.pdf",date:"2026-01-30",time:"22:51",eqp_id:"EQP11",line_id:"LINE3",oper_id:"OPER1",alarm_kpi:"OEE",target_raw:"70.0%",actual_raw:"50.56%",diff_raw:"-19.44%",target_num:70,actual_num:50.56,
   causes:["장비 다운타임 3시간 발생 (01:25~04:25)","RCP01 레시피 실행 중 HOLD 상태 발생","복잡도 높은 레시피(9/10) 사용으로 인한 처리 시간 증가"],
   scenarios:["장비 긴급 점검 및 유지보수 실시","다운타임 발생 원인 파악 (센서 오류)","레시피 파라미터 조정 (복잡도 낮은 RCP02로 전환)","예방 정비 스케줄 재조정"],
   results:["OEE 회복: 50.56% → 70.0% (다음날 예상)","다운타임 제로화","예상 손실 비용: 약 500만원 절감"],
   pdf_raw:{basic_info:"날짜: 2026-01-30 | 시간: 22:51 | 장비: EQP11 | 라인: LINE3 | 공정: OPER1",problem:"문제 KPI: OEE\n목표치: 70.0% | 실제치: 50.56% | 차이: -19.44%",root_cause:"1. 장비 다운타임 3시간 발생 (01:25~04:25)\n2. RCP01 레시피 실행 중 HOLD 상태 발생\n3. 복잡도 높은 레시피(9/10) 사용으로 인한 처리 시간 증가",scenario:"1. 장비 긴급 점검 및 유지보수 실시\n2. 다운타임 발생 원인 파악 (센서 오류)\n3. 레시피 파라미터 조정 (복잡도 낮은 RCP02로 전환)\n4. 예방 정비 스케줄 재조정",result:"OEE 회복: 50.56% → 70.0% (다음날 예상)\n다운타임 제로화\n예상 손실 비용: 약 500만원 절감"}},
];


// ────────────────────────── 유틸 함수 ──────────────────────────
function getRate(r:Report):number {
  if(r.alarm_kpi==="TAT"||r.alarm_kpi==="WIP_EXCEED") return Math.min((r.target_num/r.actual_num)*100,100);
  return Math.min((r.actual_num/r.target_num)*100,100);
}
function isBad(r:Report):boolean {
  if(r.alarm_kpi==="TAT"||r.alarm_kpi==="WIP_EXCEED") return r.actual_num>r.target_num;
  return r.actual_num<r.target_num;
}
function nowTime():string { return new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}); }
function jitter(base:number,range:number):number { return parseFloat((base+(Math.random()-0.5)*range).toFixed(2)); }

// ────────────────────────── LLM 시스템 프롬프트 ──────────────────────────
const SYSTEM_PROMPT = `당신은 반도체/제조 공장의 KPI 모니터링 AI 에이전트입니다.
현장 엔지니어에게 즉시 행동 가능한 간결한 보고서 형식으로 답변합니다.

## 필수 출력 형식 (반드시 준수)
모든 답변은 아래 3섹션 구조로만 작성하세요. 섹션 외 추가 설명은 금지합니다.

[현황] 장비·KPI·수치를 1~2문장으로 요약 (목표 vs 실적, 편차 포함)
[원인] 핵심 원인 1~3개를 번호 목록으로 (각 항목 20자 이내)
[조치] 즉시 실행 가능한 조치 1~3개를 번호 목록으로 (각 항목 20자 이내)

## 출력 예시
[현황] EQP12 THP 이상 · 목표 250 → 실적 227 (-9.2%) · 2026-01-31 09:10
[원인] ① RCP23/RCP24 DOWN 4회 반복 (총 55분) ② 고복잡도 레시피 연속 처리
[조치] ① EQP12 긴급 점검 요청 ② 레시피 복잡도 조정 ③ EQP11 대체 투입 검토

## 보유 데이터 (2026-01-20 ~ 2026-01-31)
알람 12건 요약:
| 날짜 | 장비 | KPI | Target | Actual | 주원인 |
|------|------|-----|--------|--------|--------|
| 2026-01-20 | EQP01 | OEE | 70% | 57.73% | 다운타임 3h, 고복잡도 레시피 |
| 2026-01-21 | EQP02 | THP | 1000UPH | 729UPH | 자재공급 지연, 로더 통신장애 |
| 2026-01-22 | EQP03 | TAT | 48h | 61.71h | 챔버 온도 불안정, 큐 적체 |
| 2026-01-23 | EQP04 | WIP_EXCEED | 500EA | 670EA | 라인 밸런싱 불균형 |
| 2026-01-24 | EQP05 | WIP_SHORTAGE | 500EA | 218EA | 라인 밸런싱 불균형 |
| 2026-01-25 | EQP06 | OEE | 70% | 56.48% | 다운타임 3h, 레시피 HOLD |
| 2026-01-26 | EQP07 | THP | 1000UPH | 865UPH | 자재공급 지연, 로더 장애 |
| 2026-01-27 | EQP08 | TAT | 48h | 62.26h | 챔버 온도, QA 샘플링 증가 |
| 2026-01-28 | EQP09 | WIP_EXCEED | 500EA | 730EA | 긴급 LOT 투입 |
| 2026-01-29 | EQP10 | WIP_SHORTAGE | 500EA | 295EA | 설비 정지, 라인 불균형 |
| 2026-01-30 | EQP11 | OEE | 70% | 50.56% | 다운타임 3h, RCP21/22 문제 |
| 2026-01-31 | EQP12 | THP | 250 | 227 | DOWN 4회(55분), RCP23/24 고복잡도 |

## 현재 실시간 KPI 목표
OEE ≥ 70% · THP ≥ 250 · TAT ≤ 3.5h · WIP 200~300EA

## 주의사항
- 데이터에 없는 내용 추측 시 반드시 "(추정)" 표시
- 섹션 레이블 [현황] [원인] [조치] 는 반드시 유지
- 불필요한 인사말, 마무리 문장 금지`;

// ────────────────────────── Anthropic API 호출 ──────────────────────────
// .env에 REACT_APP_ANTHROPIC_API_KEY=sk-ant-... 설정 필요
// CORS 이슈 시: 백엔드 FastAPI /api/chat 경유 (main.py 실행 후 사용)
async function callLLM(messages:{role:string;content:string}[], liveContext:string=""):Promise<{text:string;source:"llm"|"rag"|"error"}> {
  // 백엔드 FastAPI 서버 경유 (AWS Bedrock 사용)
  // 백엔드: backend/api/main.py 실행 필요
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages,
        system: SYSTEM_PROMPT,
        mode: "question",
        live_context: liveContext,
      }),
    });
    if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
    const data = await res.json();
    // 백엔드 응답 형식에 맞게 파싱
    const text = data.content || data.message || data.response || JSON.stringify(data);
    return { text, source: "llm" };
  } catch (err: any) {
    // 백엔드 미실행 시 로컬 폴백
    const fallback = getFallback(messages[messages.length - 1].content);
    return {
      text: `[백엔드 미연결] python backend/api/main.py 를 먼저 실행하세요.\n\n로컬 응답: ${fallback}`,
      source: "rag",
    };
  }
}

function getFallback(q:string):string {
  const ql=q.toLowerCase();
  if(ql.match(/eqp12/)){ return "EQP12 (2026-01-31): THP 알람\n목표 250 → 실적 227 (-23)\nRCP23·RCP24 DOWN 4회 반복 (총 55분 다운타임)\n복잡도 8·10의 고난도 레시피 처리 중 발생"; }
  const em=ql.match(/eqp0?(\d+)/);
  if(em){ const n=parseInt(em[1]); const r=REPORTS.find(x=>x.eqp_id===`EQP${String(n).padStart(2,"0")}`); if(r) return `${r.eqp_id}(${r.date}): ${KPI_META[r.alarm_kpi]?.label} 알람\n목표 ${r.target_raw} → 실적 ${r.actual_raw}\n주원인: ${r.causes[0]}`; }
  if(ql.includes("oee")||ql.includes("가동")) return "OEE 알람 3건: EQP01(57.73%), EQP06(56.48%), EQP11(50.56%)\n공통: 3h 다운타임 + 고복잡도 레시피(9/10)";
  if(ql.includes("thp")||ql.includes("처리량")) return "THP 알람: EQP02(729/1000UPH), EQP07(865/1000UPH), EQP12(227/250)\n원인: 자재공급지연, 로더장애, DOWN 이벤트";
  if(ql.includes("tat")) return "TAT 알람: EQP03(61.71h), EQP08(62.26h) — 목표 48h 초과\n원인: 챔버 온도 불안정, 큐 적체, QA 샘플링 증가";
  if(ql.includes("wip")) return "WIP 알람 4건: 초과(EQP04 670EA, EQP09 730EA), 부족(EQP05 218EA, EQP10 295EA)\n원인: 라인 밸런싱 불균형, 긴급 LOT 투입";
  if(ql.includes("최신")||ql.includes("오늘")||ql.includes("최근")) return "최신 알람: 2026-01-31 EQP12 THP\n목표 250 → 실적 227 / RCP23·RCP24 DOWN 4회";
  if(ql.includes("위험")||ql.includes("심각")) return "가장 심각: EQP11 OEE 50.56% (목표 대비 -28%) / EQP05 WIP 218EA (목표 대비 -56%)";
  return "질문에 EQP 번호, KPI 유형(OEE/THP/TAT/WIP)을 포함하시면 더 정확한 분석을 제공합니다.";
}

// ────────────────────────── 날짜 추출 헬퍼 ──────────────────────────
function extractDateFromQuestion(q: string): string | null {
  // "2026-01-25" 또는 "2026/01/25" 형식
  const full = q.match(/20\d{2}[-/](\d{1,2})[-/](\d{1,2})/);
  if (full) {
    const m = full[1].padStart(2, '0');
    const d = full[2].padStart(2, '0');
    return `2026-${m}-${d}`;
  }
  // "2026년 1월 25일" 형식
  const koFull = q.match(/20\d{2}년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (koFull) {
    const m = koFull[1].padStart(2, '0');
    const d = koFull[2].padStart(2, '0');
    return `2026-${m}-${d}`;
  }
  // "1월 25일" 형식 (연도 생략, 2026 가정)
  const ko = q.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (ko) {
    const m = ko[1].padStart(2, '0');
    const d = ko[2].padStart(2, '0');
    return `2026-${m}-${d}`;
  }
  // "01-25" 형식 (연도 생략, 2026 가정)
  const short = q.match(/\b(0[1-9]|1[0-2])-([0-2]\d|3[01])\b/);
  if (short) {
    return `2026-${short[1]}-${short[2]}`;
  }
  return null;
}

// ────────────────────────── 서브 컴포넌트 ──────────────────────────

// 실시간 SVG 차트
function RealtimeChart({data,width,height}:{data:RealtimePoint[];width:number;height:number}) {
  if(data.length<2) return null;
  const P={top:14,right:52,bottom:28,left:42};
  const W=width-P.left-P.right, H=height-P.top-P.bottom;
  const xS=(i:number)=>(i/(data.length-1))*W;
  const yS=(v:number,mn:number,mx:number)=>H-((v-mn)/(mx-mn+0.001))*H;
  const mk=(g:(p:RealtimePoint)=>number,mn:number,mx:number)=>data.map((p,i)=>`${i===0?"M":"L"}${xS(i).toFixed(1)},${yS(g(p),mn,mx).toFixed(1)}`).join(" ");
  const xl=[0,Math.floor(data.length/3),Math.floor(data.length*2/3),data.length-1];
  return(
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{overflow:"visible"}}>
      <g transform={`translate(${P.left},${P.top})`}>
        {[50,62,74,86,100].map(v=><line key={v} x1={0} y1={yS(v,50,100)} x2={W} y2={yS(v,50,100)} stroke="#f3f4f6" strokeWidth={1}/>)}
        <path d={mk(p=>p.wip,150,350)} fill="none" stroke="#8b5cf6" strokeWidth={1.5} opacity={0.6}/>
        <path d={mk(p=>p.tat,0,6)} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.6}/>
        <path d={mk(p=>p.thp,150,300)} fill="none" stroke="#10b981" strokeWidth={2}/>
        <path d={mk(p=>p.oee,50,100)} fill="none" stroke="#2563eb" strokeWidth={2.5}/>
        <line x1={0} y1={yS(70,50,100)} x2={W} y2={yS(70,50,100)} stroke="#2563eb" strokeWidth={1} strokeDasharray="4 3" opacity={0.35}/>
        <text x={W+3} y={yS(70,50,100)+4} fontSize={9} fill="#2563eb" opacity={0.5}>70%</text>
        {xl.map(i=>data[i]&&<text key={i} x={xS(i)} y={H+18} textAnchor="middle" fontSize={10} fill="#9ca3af">{data[i].time.slice(0,5)}</text>)}
        {[50,62,74,86,100].map(v=><text key={v} x={-4} y={yS(v,50,100)+4} textAnchor="end" fontSize={10} fill="#9ca3af">{v}</text>)}
        {(()=>{const l=data[data.length-1];const lx=xS(data.length-1);return<><circle cx={lx} cy={yS(l.oee,50,100)} r={4} fill="#2563eb"/><circle cx={lx} cy={yS(l.thp,150,300)} r={3} fill="#10b981"/></>;})()}
      </g>
    </svg>
  );
}

// 달성률 바
function AchievementBar({report}:{report:Report}) {
  const rate=getRate(report),bad=isBad(report),color=bad?"#dc2626":"#16a34a";
  return(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{flex:1,height:6,background:"#f3f4f6",borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${rate}%`,height:"100%",background:color,borderRadius:3}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color,minWidth:36,textAlign:"right" as const,fontFamily:"Pretendard, sans-serif"}}>{rate.toFixed(0)}%</span>
    </div>
  );
}

// 섹션 레이블
function SL({children,style}:{children:React.ReactNode;style?:React.CSSProperties}) {
  return<div style={{fontSize:11,fontWeight:700,color:"#6b7280",letterSpacing:1,textTransform:"uppercase" as const,marginBottom:10,...style}}>{children}</div>;
}

// 리포트 상세 패널 (PDF 원본 보기 포함)
function ReportPanel({report,onClose,startRaw=false}:{report:Report;onClose:()=>void;startRaw?:boolean}) {
  const meta=KPI_META[report.alarm_kpi], bad=isBad(report), rate=getRate(report);
  const [raw,setRaw]=useState(startRaw);
  return(
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e=>e.stopPropagation()}>
        {/* 헤더 */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:12,height:12,borderRadius:"50%",background:meta.color,marginTop:4}}/>
            <div>
              <div style={{fontSize:17,fontWeight:700,color:"#0f172a"}}>{report.eqp_id} — {meta.label} 알람</div>
              <div style={{fontSize:12,color:"#9ca3af",marginTop:3,fontFamily:"Pretendard, sans-serif"}}>{report.date} {report.time} · {report.line_id} · {report.oper_id}</div>
            </div>
          </div>
          <button style={S.panelClose} onClick={onClose}>닫기</button>
        </div>

        {/* 파일명 + 원본 토글 */}
        <div style={{display:"flex",alignItems:"center",gap:8,background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:7,padding:"8px 12px",marginBottom:16}}>
          <span style={{fontSize:11,color:"#374151",fontFamily:"Pretendard, sans-serif",flex:1}}>{report.filename}</span>
          <span style={{fontSize:10,fontWeight:700,color:"#7c3aed",background:"#ede9fe",padding:"2px 7px",borderRadius:4}}>RAG</span>
          <button style={{fontSize:11,color:"#2563eb",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:4,padding:"3px 10px",cursor:"pointer"}} onClick={()=>setRaw(!raw)}>
            {raw?"구조화 보기":"PDF 원본 보기"}
          </button>
        </div>

        {/* PDF 원본 모드 */}
        {raw?(
          <div style={{background:"#0f172a",borderRadius:10,padding:20,marginBottom:16,fontFamily:"Pretendard, sans-serif",fontSize:12}}>
            <div style={{color:"#60a5fa",fontSize:11,letterSpacing:1,marginBottom:14}}>── KPI 알람 분석 보고서 (PDF 원본) ──</div>
            <ReactMarkdown components={{
              p:      ({children})=><p style={{color:"#e2e8f0",lineHeight:1.7,margin:"3px 0"}}>{children}</p>,
              ul:     ({children})=><ul style={{color:"#e2e8f0",paddingLeft:18,margin:"4px 0"}}>{children}</ul>,
              ol:     ({children})=><ol style={{color:"#e2e8f0",paddingLeft:18,margin:"4px 0"}}>{children}</ol>,
              li:     ({children})=><li style={{color:"#e2e8f0",lineHeight:1.7,margin:"2px 0"}}>{children}</li>,
              strong: ({children})=><strong style={{color:"#fbbf24",fontWeight:700}}>{children}</strong>,
              h1:     ({children})=><div style={{color:"#60a5fa",fontWeight:700,fontSize:14,margin:"14px 0 4px",borderBottom:"1px solid #1e3a5f",paddingBottom:4}}>{children}</div>,
              h2:     ({children})=><div style={{color:"#60a5fa",fontWeight:700,fontSize:13,margin:"12px 0 4px",borderBottom:"1px solid #1e3a5f",paddingBottom:3}}>{children}</div>,
              h3:     ({children})=><div style={{color:"#93c5fd",fontWeight:600,fontSize:12,margin:"8px 0 3px"}}>{children}</div>,
              code:   ({children})=><code style={{background:"#1e293b",color:"#7dd3fc",padding:"1px 5px",borderRadius:3,fontFamily:"monospace"}}>{children}</code>,
              hr:     ()=><hr style={{border:"none",borderTop:"1px solid #334155",margin:"8px 0"}}/>,
            }}>{[
              `## 기본 정보\n${report.pdf_raw.basic_info}`,
              `## 문제 정의\n${report.pdf_raw.problem}`,
              `## 근본 원인\n${report.pdf_raw.root_cause}`,
              `## 해결 시나리오\n${report.pdf_raw.scenario}`,
              `## 조치 결과\n${report.pdf_raw.result}`,
            ].join('\n\n')}</ReactMarkdown>
          </div>
        ):(
          <>
            {/* KPI 비교 */}
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <div style={{flex:1,background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"14px 16px",textAlign:"center" as const}}>
                <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase" as const,marginBottom:6,letterSpacing:0.6}}>Target</div>
                <div style={{fontSize:22,fontWeight:700,fontFamily:"Pretendard, sans-serif"}}>{report.target_raw}</div>
              </div>
              <div style={{textAlign:"center" as const,width:44}}>
                <div style={{color:bad?"#dc2626":"#16a34a",fontSize:22,fontWeight:700}}>{bad?"↓":"↑"}</div>
                <div style={{fontSize:12,color:bad?"#dc2626":"#16a34a",fontWeight:600}}>{report.diff_raw}</div>
              </div>
              <div style={{flex:1,background:bad?"#fef2f2":"#f0fdf4",border:`1px solid ${bad?"#fecaca":"#bbf7d0"}`,borderRadius:8,padding:"14px 16px",textAlign:"center" as const}}>
                <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase" as const,marginBottom:6,letterSpacing:0.6}}>Actual</div>
                <div style={{fontSize:22,fontWeight:700,fontFamily:"Pretendard, sans-serif",color:bad?"#dc2626":"#16a34a"}}>{report.actual_raw}</div>
              </div>
            </div>
            {/* 달성률 */}
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <SL style={{marginBottom:0}}>달성률</SL>
                <span style={{fontSize:13,fontWeight:700,color:bad?"#dc2626":"#16a34a",fontFamily:"Pretendard, sans-serif"}}>{rate.toFixed(1)}%</span>
              </div>
              <div style={{height:8,background:"#f3f4f6",borderRadius:4,overflow:"hidden"}}>
                <div style={{width:`${rate}%`,height:"100%",background:bad?"#dc2626":"#16a34a",borderRadius:4}}/>
              </div>
            </div>
            {/* 근본 원인 */}
            <SL>근본 원인 분석</SL>
            {report.causes.map((c,i)=>(
              <div key={i} style={{display:"flex",gap:10,marginBottom:8}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:meta.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",flexShrink:0,marginTop:1}}>{i+1}</div>
                <div style={{fontSize:13,color:"#374151",lineHeight:1.6}}>{c}</div>
              </div>
            ))}
            {/* 해결 시나리오 */}
            <SL style={{marginTop:14}}>해결 시나리오</SL>
            {report.scenarios.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:10,marginBottom:8}}>
                <span style={{color:"#16a34a",fontWeight:700,flexShrink:0,marginTop:2}}>✓</span>
                <div style={{fontSize:13,color:"#374151",lineHeight:1.6}}>{s}</div>
              </div>
            ))}
            {/* 조치 결과 */}
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"14px 16px",marginTop:14}}>
              <SL style={{color:"#16a34a",marginBottom:8}}>조치 결과</SL>
              {report.results.map((r,i)=><div key={i} style={{fontSize:13,color:"#166534",marginBottom:5,lineHeight:1.5}}>• {r}</div>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
const API_BASE = "";

// 백엔드에서 PDF 목록 가져오기
async function fetchReportList(): Promise<{filename:string;size:number;created_at:string}[]> {
  try {
    const res = await fetch(`${API_BASE}/api/reports`);
    const data = await res.json();
    return data.reports || [];
  } catch {
    return []; // 백엔드 미실행 시 빈 배열
  }
}

// PDF 저장 API 호출
async function saveReportToPdf(filename: string, content: string, metadata: Record<string,string>): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/reports/save`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ filename, content, metadata }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// PDF 삭제 API 호출
async function deleteReportFile(filename: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/reports/${filename}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

// ← 여기서부터
function AnalyticsPage({reports}: {reports: any[]}) {
  const [kpiTab, setKpiTab] = React.useState<string>("OEE");
  
  const kpiCount: Record<string,number> = {OEE:0,THP:0,TAT:0,WIP_EXCEED:0,WIP_SHORTAGE:0};
  reports.forEach(r => { kpiCount[r.alarm_kpi] = (kpiCount[r.alarm_kpi]||0)+1; });
  const COLORS: Record<string,string> = {OEE:"#2563eb",THP:"#059669",TAT:"#d97706",WIP_EXCEED:"#dc2626",WIP_SHORTAGE:"#7c3aed"};

  // KPI별 평균 달성률 계산
  const avgRate = (kpi: string) => {
    const filtered = reports.filter(r => r.alarm_kpi === kpi);
    if(!filtered.length) return 0;
    return filtered.reduce((sum,r) => {
      const rate = kpi==="TAT"||kpi==="WIP_EXCEED"
        ? (r.target_num/r.actual_num)*100
        : (r.actual_num/r.target_num)*100;
      return sum + Math.min(rate, 100);
    }, 0) / filtered.length;
  };

  const kpiMeta = [
    {key:"OEE", label:"OEE", unit:"%", target:"70%"},
    {key:"THP", label:"THP", unit:"UPH", target:"250"},
    {key:"TAT", label:"TAT", unit:"h", target:"<3.5h"},
    {key:"WIP_EXCEED", label:"WIP 초과", unit:"EA", target:"500EA"},
    {key:"WIP_SHORTAGE", label:"WIP 부족", unit:"EA", target:"500EA"},
  ];

  const selectedReports = reports.filter(r => r.alarm_kpi === kpiTab);

  return (
    <div style={{padding:"24px 32px"}}>
      {/* 요약 카드 3개 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:28}}>
        {[
          {label:"총 알람 건수", value:`${reports.length}건`, color:"#dc2626"},
          {label:"알람 발생 장비", value:"12대", color:"#2563eb"},
          {label:"전체 평균 달성률", value:`${(kpiMeta.reduce((s,k)=>s+avgRate(k.key),0)/kpiMeta.length).toFixed(1)}%`, color:"#059669"},
        ].map(({label,value,color})=>(
          <div key={label} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"18px 20px"}}>
            <div style={{fontSize:11,color:"#9ca3af",fontWeight:600,marginBottom:6}}>{label}</div>
            <div style={{fontSize:28,fontWeight:800,color,fontFamily:"Pretendard, sans-serif"}}>{value}</div>
          </div>
        ))}
      </div>

      {/* KPI별 평균 달성률 탭 */}
      <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"20px 24px",marginBottom:20}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:16}}>KPI별 평균 달성률</div>
        {/* 탭 버튼 */}
        <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap" as const}}>
          {kpiMeta.map(({key,label})=>(
            <button key={key} onClick={()=>setKpiTab(key)} style={{
              padding:"6px 16px", borderRadius:8, border:"none", cursor:"pointer",
              background: kpiTab===key ? COLORS[key] : "#f3f4f6",
              color: kpiTab===key ? "#fff" : "#374151",
              fontWeight: kpiTab===key ? 700 : 400, fontSize:13,
            }}>{label}</button>
          ))}
        </div>
        {/* 선택된 KPI 상세 */}
        {kpiMeta.filter(k=>k.key===kpiTab).map(({key,label,unit,target})=>{
          const rate = avgRate(key);
          const color = COLORS[key];
          return (
            <div key={key}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:10}}>
                <div>
                  <span style={{fontSize:13,color:"#6b7280"}}>목표: {target} · 알람 {kpiCount[key]}건</span>
                </div>
                <span style={{fontSize:28,fontWeight:800,fontFamily:"Pretendard, sans-serif",color}}>{rate.toFixed(1)}%</span>
              </div>
              <div style={{height:14,background:"#f3f4f6",borderRadius:7,overflow:"hidden",marginBottom:20}}>
                <div style={{width:`${rate}%`,height:"100%",background:color,borderRadius:7,transition:"width 0.5s"}}/>
              </div>
              {/* 해당 KPI 알람 목록 */}
              {selectedReports.map((r,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",borderRadius:8,background:"#f9fafb",marginBottom:6}}>
                  <span style={{fontSize:11,fontFamily:"Pretendard, sans-serif",color:"#9ca3af",width:80,flexShrink:0}}>{r.date}</span>
                  <span style={{fontWeight:700,fontSize:12,width:50,flexShrink:0}}>{r.eqp_id}</span>
                  <span style={{fontSize:11,color:"#6b7280",flex:1}}>{r.causes[0]}</span>
                  <span style={{fontSize:12,fontFamily:"Pretendard, sans-serif",fontWeight:700,color,flexShrink:0}}>
                    {r.actual_raw} / {r.target_raw}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* KPI별 알람 빈도 바 차트 */}
      <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"20px 24px",marginBottom:20}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:18}}>KPI별 알람 발생 빈도</div>
        {Object.entries(kpiCount).map(([kpi,count])=>(
          <div key={kpi} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:12,fontWeight:600}}>{kpi}</span>
              <span style={{fontSize:12,fontFamily:"Pretendard, sans-serif"}}>{count}건</span>
            </div>
            <div style={{height:10,background:"#f3f4f6",borderRadius:5,overflow:"hidden"}}>
              <div style={{width:`${(count/reports.length)*100}%`,height:"100%",background:COLORS[kpi],borderRadius:5}}/>
            </div>
          </div>
        ))}
      </div>

      {/* 일별 알람 타임라인 */}
      <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"20px 24px"}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:16}}>일별 알람 타임라인</div>
        {reports.map((r,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",borderRadius:8,background:"#f9fafb",marginBottom:6}}>
            <span style={{fontSize:11,fontFamily:"Pretendard, sans-serif",color:"#9ca3af",width:80,flexShrink:0}}>{r.date}</span>
            <span style={{fontWeight:700,fontSize:12,width:50,flexShrink:0}}>{r.eqp_id}</span>
            <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,background:COLORS[r.alarm_kpi]+"22",color:COLORS[r.alarm_kpi]}}>{r.alarm_kpi}</span>
            <span style={{fontSize:11,color:"#6b7280",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{r.causes[0]}</span>
            <span style={{fontSize:11,fontFamily:"Pretendard, sans-serif",color:"#dc2626",flexShrink:0}}>{r.diff_raw}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Thresholds = {oee_min:number;thp_min:number;tat_max:number;wip_min:number;wip_max:number};

function SettingsPage({thresholds,setThresholds}:{thresholds:Thresholds;setThresholds:React.Dispatch<React.SetStateAction<Thresholds>>}) {
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/system/settings/targets", {
        method: "PUT",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(thresholds),
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({detail:`HTTP ${res.status}`}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "업데이트 실패");
      setSaved(true);
      setTimeout(()=>setSaved(false), 2000);
    } catch(e: any) {
      setSaveError(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{padding:"24px 32px",maxWidth:600}}>
      <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"24px 28px",marginBottom:20}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:20}}>알람 임계값 설정</div>
        {[
          {key:"oee_min",label:"OEE 최소값 (%)",unit:"%"},
          {key:"thp_min",label:"THP 최소값 (UPH)",unit:"UPH"},
          {key:"tat_max",label:"TAT 최대값 (h)",unit:"h"},
          {key:"wip_min",label:"WIP 최소값 (EA)",unit:"EA"},
          {key:"wip_max",label:"WIP 최대값 (EA)",unit:"EA"},
        ].map(({key,label,unit})=>(
          <div key={key} style={{marginBottom:16}}>
            <label style={{fontSize:13,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>{label}</label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" value={(thresholds as any)[key]}
                onChange={e=>setThresholds(p=>({...p,[key]:Number(e.target.value)}))}
                style={{flex:1,padding:"8px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:14,fontFamily:"Pretendard, sans-serif",outline:"none"}}/>
              <span style={{fontSize:12,color:"#9ca3af",width:32}}>{unit}</span>
            </div>
          </div>
        ))}
        <button onClick={handleSave} disabled={saving}
          style={{width:"100%",padding:"12px",borderRadius:8,border:"none",background:saved?"#22c55e":saveError?"#dc2626":"#0f172a",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>
          {saved?"저장되었습니다!":saving?"저장 중...":"설정 저장"}
        </button>
        {saveError&&<div style={{marginTop:8,fontSize:12,color:"#dc2626",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"6px 10px"}}>{saveError}</div>}
      </div>

      <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"20px 24px"}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>시스템 정보</div>
        {[
          {label:"백엔드 서버",value:"http://localhost:8000"},
          {label:"LLM 모델",value:"AWS Bedrock / Claude Haiku"},
          {label:"Vector DB",value:"ChromaDB · ./backend/data/chromadb"},
          {label:"관계형 DB",value:"Amazon RDS (PostgreSQL)"},
          {label:"보고서 폴더",value:"./backend/data/reports/"},
        ].map(({label,value})=>(
          <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f3f4f6"}}>
            <span style={{fontSize:13,color:"#374151"}}>{label}</span>
            <span style={{fontSize:12,fontFamily:"Pretendard, sans-serif",color:"#6b7280"}}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
// ────────────────────────── Tab PiP Carousel ──────────────────────────
interface TabCarouselProps {
  initialTab: string;
  kpi: LiveKPI;
  thresholds: {oee_min:number;thp_min:number;tat_max:number;wip_min:number;wip_max:number};
  historyList: Report[];
  dbKpiData: any[];
  dbEqpData: any[];
  dbLotData: any[];
  dbRcpData: any[];
  dbScenarioData: any[];
  onNavigate: (tab: string) => void;
  highlightedDate?: string;
}
function TabCarousel({initialTab,kpi,thresholds,historyList,dbKpiData,dbEqpData,dbLotData,dbRcpData,dbScenarioData,onNavigate,highlightedDate}:TabCarouselProps) {
  const [cur, setCur] = React.useState(initialTab);
  const [dbSub, setDbSub] = React.useState<string>("kpi_daily");
  const [filterDate, setFilterDate] = React.useState<string>("all");
  const [filterEqp, setFilterEqp] = React.useState<string>("all");
  const TABS=[
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"analytics",icon:"📈",label:"Analytics"},
    {id:"alarms",   icon:"🔔",label:"Alarms"},
    {id:"database", icon:"🗄️",label:"Database"},
    {id:"settings", icon:"⚙️",label:"Settings"},
  ];
  const td=(v:number,t:number,inv=false)=>inv?v>t:v<t;
  const kpiRows=[
    {label:"OEE",val:`${kpi.oee.toFixed(1)}%`,target:`목표 ${thresholds.oee_min}%`,bad:td(kpi.oee,thresholds.oee_min)},
    {label:"THP",val:`${kpi.thp}개`,          target:`목표 ${thresholds.thp_min}개`,bad:td(kpi.thp,thresholds.thp_min)},
    {label:"TAT",val:`${kpi.tat.toFixed(2)}h`, target:`상한 ${thresholds.tat_max}h`, bad:td(kpi.tat,thresholds.tat_max,true)},
    {label:"WIP",val:`${kpi.wip}개`,           target:`${thresholds.wip_min}~${thresholds.wip_max}개`,bad:kpi.wip<thresholds.wip_min||kpi.wip>thresholds.wip_max},
  ];

  const content=()=>{
    if(cur==="dashboard") return(
      <div style={{padding:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          {kpiRows.map(({label,val,target,bad})=>(
            <div key={label} style={{padding:"10px 12px",borderRadius:8,background:bad?"#fee2e2":"#f0fdf4",border:`1px solid ${bad?"#fecaca":"#bbf7d0"}`}}>
              <div style={{fontSize:10,color:"#9ca3af",fontWeight:700}}>{label}</div>
              <div style={{fontSize:20,fontWeight:800,color:bad?"#dc2626":"#16a34a",margin:"2px 0"}}>{val}</div>
              <div style={{fontSize:9,color:"#6b7280"}}>{target}  {bad?"이상":"정상"}</div>
            </div>
          ))}
        </div>
        {dbKpiData.length>0&&<>
          <div style={{fontSize:10,fontWeight:700,color:"#374151",marginBottom:4}}>최근 KPI 데이터</div>
          <div style={{fontSize:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr",color:"#9ca3af",fontWeight:700,paddingBottom:3,borderBottom:"1px solid #e2e8f0"}}>
              <span>날짜</span><span>장비</span><span>OEE</span><span>THP</span><span>TAT</span><span>WIP</span>
            </div>
            {dbKpiData.slice(0,6).map((r:any,i:number)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr",padding:"3px 0",borderBottom:"1px solid #f9fafb",color:"#374151"}}>
                <span>{r.date?.slice(5)}</span><span>{r.eqp_id}</span>
                <span style={{color:r.oee_v<r.oee_t?"#dc2626":"#16a34a",fontWeight:600}}>{r.oee_v}%</span>
                <span style={{color:r.thp_v<r.thp_t?"#dc2626":"#16a34a",fontWeight:600}}>{r.thp_v}</span>
                <span style={{color:r.tat_v>r.tat_t?"#dc2626":"#16a34a",fontWeight:600}}>{r.tat_v}h</span>
                <span>{r.wip_v}</span>
              </div>
            ))}
          </div>
        </>}
      </div>
    );

    if(cur==="analytics") {
      // KPI별 건수 집계
      const kpiCount: Record<string,number> = {};
      historyList.forEach(r=>{ kpiCount[r.alarm_kpi]=(kpiCount[r.alarm_kpi]||0)+1; });
      const kpiColors: Record<string,string> = {OEE:"#2563eb",THP:"#059669",TAT:"#d97706",WIP:"#7c3aed"};
      const maxCnt = Math.max(...Object.values(kpiCount), 1);
      return(
        <div style={{padding:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#374151",marginBottom:8}}>알람 KPI 분포 ({historyList.length}건)</div>
          {/* KPI 건수 바 차트 */}
          <div style={{marginBottom:12}}>
            {Object.entries(kpiCount).map(([kpi,cnt])=>(
              <div key={kpi} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                <span style={{width:80,fontSize:10,fontWeight:700,color:kpiColors[kpi]||"#374151",flexShrink:0}}>{kpi}</span>
                <div style={{flex:1,height:12,background:"#f1f5f9",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(cnt/maxCnt)*100}%`,background:kpiColors[kpi]||"#94a3b8",borderRadius:4}}/>
                </div>
                <span style={{fontSize:10,color:"#374151",fontWeight:600}}>{cnt}건</span>
              </div>
            ))}
          </div>
          {/* 알람 이력 목록 */}
          <div style={{fontSize:10,fontWeight:700,color:"#374151",marginBottom:6}}>알람 이력 (달성률 기준)</div>
          <div style={{fontSize:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 0.8fr 1fr 0.8fr",color:"#9ca3af",fontWeight:700,paddingBottom:3,borderBottom:"1px solid #e2e8f0"}}>
              <span>날짜</span><span>장비</span><span>KPI</span><span>목표→실적</span><span>달성률</span>
            </div>
            {historyList.slice(0,10).map((r,i)=>{
              const rate = r.alarm_kpi==="TAT" ? (r.target_num/r.actual_num*100) : (r.actual_num/r.target_num*100);
              const bad = rate < 90;
              return(
                <div key={i} style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 0.8fr 1fr 0.8fr",padding:"3px 0",borderBottom:"1px solid #f9fafb",color:"#374151"}}>
                  <span>{r.date}</span>
                  <span>{r.eqp_id}</span>
                  <span style={{color:kpiColors[r.alarm_kpi]||"#374151",fontWeight:600}}>{r.alarm_kpi}</span>
                  <span>{r.target_raw}→{r.actual_raw}</span>
                  <span style={{color:bad?"#dc2626":"#16a34a",fontWeight:600}}>{rate.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if(cur==="alarms") {
      // 날짜 매칭: REPORTS에서 먼저 찾고, 없으면 LATEST_ALARM 확인
      const matchedReport = highlightedDate ? historyList.find(r=>r.date===highlightedDate) : null;
      const isLatestMatch = highlightedDate === LATEST_ALARM.date;
      const showHighlight = !!highlightedDate;

      // 빨간 박스에 보여줄 알람 정보 결정
      const boxTitle = matchedReport
        ? `${matchedReport.eqp_id} — ${KPI_META[matchedReport.alarm_kpi]?.label || matchedReport.alarm_kpi} 알람`
        : isLatestMatch
          ? `${LATEST_ALARM.eqp_id} — THP 알람 (최신)`
          : `${LATEST_ALARM.eqp_id} — THP 이상`;
      const boxDate = matchedReport
        ? `${matchedReport.date} ${matchedReport.time}`
        : `${LATEST_ALARM.date} ${LATEST_ALARM.time}`;
      const boxLabel = showHighlight ? `🔴 ${highlightedDate} 알람` : "🔴 최신 알람";
      const boxCauses = matchedReport
        ? matchedReport.causes.slice(0,2)
        : LATEST_ALARM.causes.slice(0,2);
      const boxKpiLine = matchedReport
        ? `목표 ${matchedReport.target_raw} → 실적 ${matchedReport.actual_raw}  (${matchedReport.diff_raw})`
        : `목표 ${LATEST_ALARM.thp_t}개 → 실적 ${LATEST_ALARM.thp_v}개  (${LATEST_ALARM.thp_v-LATEST_ALARM.thp_t})`;

      return(
        <div style={{padding:12}}>
          <div style={{padding:"10px 12px",borderRadius:8,background:"#fee2e2",border:`2px solid ${showHighlight?"#dc2626":"#fecaca"}`,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontWeight:700,fontSize:12,color:"#991b1b"}}>{boxLabel}</span>
              <span style={{fontSize:9,color:"#9ca3af"}}>{boxDate}</span>
            </div>
            <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{boxTitle}</div>
            <div style={{fontSize:10,color:"#374151"}}>{boxKpiLine}</div>
            <div style={{fontSize:10,color:"#374151",marginTop:4}}>
              {boxCauses.map((c,i)=><div key={i} style={{marginTop:2}}>· {c}</div>)}
            </div>
          </div>
          <div style={{fontSize:11,fontWeight:700,color:"#374151",marginBottom:6}}>과거 이력 ({historyList.length}건)</div>
          {historyList.slice(0,6).map((r,i)=>(
            <div key={i} style={{padding:"6px 10px",borderRadius:6,background:r.date===highlightedDate?"#fef2f2":"#f9fafb",border:`1px solid ${r.date===highlightedDate?"#fecaca":"#f3f4f6"}`,marginBottom:4,fontSize:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontWeight:700,color:r.date===highlightedDate?"#dc2626":"inherit"}}>{r.eqp_id} — {r.alarm_kpi}</span>
                <span style={{color:"#9ca3af"}}>{r.date}</span>
              </div>
              <div style={{color:"#374151"}}>목표 {r.target_raw} → 실적 {r.actual_raw} <span style={{color:"#dc2626",fontWeight:600}}>{r.diff_raw}</span></div>
            </div>
          ))}
        </div>
      );
    }

    if(cur==="database") {
      const tableMap: Record<string,any[]> = {
        kpi_daily: dbKpiData, eqp_state: dbEqpData,
        lot_state: dbLotData, rcp_state: dbRcpData, scenario_map: dbScenarioData,
      };
      const curData = tableMap[dbSub] || [];
      const getDate=(r:any)=>r.date?.slice(0,10)||r.event_time?.slice(0,10)||null;
      // scenario_map은 eqp 필드명이 alarm_eqp_id
      const getEqp=(r:any)=>dbSub==="scenario_map"?r.alarm_eqp_id:r.eqp_id;
      const uniqDates = Array.from(new Set(curData.map(getDate).filter(Boolean))).sort() as string[];
      const uniqEqps  = Array.from(new Set(curData.map(getEqp).filter(Boolean))).sort() as string[];
      const filtered = curData.filter((r:any)=>{
        if(filterDate!=="all" && getDate(r)!==filterDate) return false;
        if(filterEqp!=="all"  && getEqp(r)!==filterEqp)  return false;
        return true;
      });
      const selectStyle:React.CSSProperties={fontSize:10,padding:"2px 4px",border:"1px solid #e2e8f0",borderRadius:4,background:"#fff",cursor:"pointer",color:"#374151"};
      const subTabs=[
        {id:"kpi_daily",label:"KPI_DAILY"},
        {id:"eqp_state",label:"EQP_STATE"},
        {id:"lot_state",label:"LOT_STATE"},
        {id:"rcp_state",label:"RCP_STATE"},
        {id:"scenario_map",label:"SCENARIO"},
      ];
      return(
        <div style={{padding:12}}>
          {/* 서브 테이블 선택 */}
          <div style={{display:"flex",gap:4,flexWrap:"wrap" as const,marginBottom:8}}>
            {subTabs.map(t=>(
              <button key={t.id} onClick={()=>{setDbSub(t.id);setFilterDate("all");setFilterEqp("all");}} style={{
                fontSize:9,fontWeight:dbSub===t.id?700:400,padding:"3px 8px",
                border:`1px solid ${dbSub===t.id?"#2563eb":"#e2e8f0"}`,borderRadius:4,
                background:dbSub===t.id?"#eff6ff":"#fff",
                color:dbSub===t.id?"#1d4ed8":"#374151",cursor:"pointer",
              }}>{t.label}</button>
            ))}
          </div>
          {/* 필터 행 */}
          <div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center"}}>
            {uniqDates.length>0&&(
              <select value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={selectStyle}>
                <option value="all">날짜 전체</option>
                {uniqDates.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            )}
            {uniqEqps.length>0&&(
              <select value={filterEqp} onChange={e=>setFilterEqp(e.target.value)} style={selectStyle}>
                <option value="all">장비 전체</option>
                {uniqEqps.map(e=><option key={e} value={e}>{e}</option>)}
              </select>
            )}
            <span style={{fontSize:9,color:"#9ca3af",marginLeft:"auto"}}>{filtered.length}건</span>
          </div>
          {/* 테이블 데이터 */}
          {filtered.length===0?(
            <div style={{color:"#9ca3af",fontSize:11,textAlign:"center" as const,padding:"20px 0"}}>
              {curData.length===0?"데이터 없음 (Database 탭 방문 후 로드됩니다)":"필터 결과 없음"}
            </div>
          ):(
            <div style={{fontSize:10,overflowX:"auto" as const}}>
              {dbSub==="kpi_daily"&&<>
                <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr",color:"#9ca3af",fontWeight:700,paddingBottom:3,borderBottom:"1px solid #e2e8f0",minWidth:340}}>
                  <span>날짜</span><span>장비</span><span>OEE목</span><span>OEE실</span><span>THP목</span><span>THP실</span><span>TAT목</span><span>TAT실</span>
                </div>
                {filtered.slice(0,15).map((r:any,i:number)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr",padding:"3px 0",borderBottom:"1px solid #f9fafb",color:"#374151",minWidth:340}}>
                    <span>{r.date?.slice(5)}</span><span>{r.eqp_id}</span>
                    <span>{r.oee_t}%</span><span style={{color:r.oee_v<r.oee_t?"#dc2626":"#16a34a",fontWeight:600}}>{r.oee_v}%</span>
                    <span>{r.thp_t}</span><span style={{color:r.thp_v<r.thp_t?"#dc2626":"#16a34a",fontWeight:600}}>{r.thp_v}</span>
                    <span>{r.tat_t}h</span><span style={{color:r.tat_v>r.tat_t?"#dc2626":"#16a34a",fontWeight:600}}>{r.tat_v}h</span>
                  </div>
                ))}
              </>}
              {dbSub==="eqp_state"&&<>
                <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr 1.2fr 0.8fr 0.8fr",color:"#9ca3af",fontWeight:700,paddingBottom:3,borderBottom:"1px solid #e2e8f0",minWidth:340}}>
                  <span>이벤트 시간</span><span>장비</span><span>LOT</span><span>RCP</span><span>상태</span>
                </div>
                {filtered.slice(0,15).map((r:any,i:number)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1.6fr 1fr 1.2fr 0.8fr 0.8fr",padding:"3px 0",borderBottom:"1px solid #f9fafb",color:"#374151",minWidth:340}}>
                    <span>{r.event_time?.slice(5,16)}</span><span>{r.eqp_id}</span>
                    <span style={{fontSize:9,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{r.lot_id}</span>
                    <span>{r.rcp_id}</span>
                    <span style={{color:r.eqp_state==="DOWN"?"#dc2626":r.eqp_state==="RUN"?"#16a34a":"#374151",fontWeight:600}}>{r.eqp_state}</span>
                  </div>
                ))}
              </>}
              {dbSub==="lot_state"&&<>
                <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr 1fr 0.8fr 0.6fr 0.6fr",color:"#9ca3af",fontWeight:700,paddingBottom:3,borderBottom:"1px solid #e2e8f0",minWidth:340}}>
                  <span>이벤트 시간</span><span>장비</span><span>LOT ID</span><span>상태</span><span>투입</span><span>HOLD</span>
                </div>
                {filtered.slice(0,15).map((r:any,i:number)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1.6fr 1fr 1fr 0.8fr 0.6fr 0.6fr",padding:"3px 0",borderBottom:"1px solid #f9fafb",color:"#374151",minWidth:340}}>
                    <span>{r.event_time?.slice(5,16)}</span><span>{r.eqp_id}</span>
                    <span style={{fontSize:9,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{r.lot_id}</span>
                    <span style={{color:r.lot_state==="HOLD"?"#dc2626":r.lot_state==="RUN"?"#16a34a":"#374151",fontWeight:600}}>{r.lot_state}</span>
                    <span>{r.in_cnt}</span>
                    <span style={{color:r.hold_cnt>0?"#dc2626":"#374151",fontWeight:r.hold_cnt>0?700:400}}>{r.hold_cnt}</span>
                  </div>
                ))}
              </>}
              {dbSub==="rcp_state"&&<>
                <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr",color:"#9ca3af",fontWeight:700,paddingBottom:3,borderBottom:"1px solid #e2e8f0",minWidth:220}}>
                  <span>RCP ID</span><span>장비</span><span>복잡도</span>
                </div>
                {filtered.slice(0,15).map((r:any,i:number)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr",padding:"3px 0",borderBottom:"1px solid #f9fafb",color:"#374151",minWidth:220}}>
                    <span>{r.rcp_id}</span><span>{r.eqp_id}</span>
                    <span style={{fontWeight:700,color:r.complex_level>=9?"#dc2626":r.complex_level>=7?"#d97706":"#16a34a"}}>Lv.{r.complex_level}</span>
                  </div>
                ))}
              </>}
              {dbSub==="scenario_map"&&<>
                <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 0.8fr",color:"#9ca3af",fontWeight:700,paddingBottom:3,borderBottom:"1px solid #e2e8f0",minWidth:240}}>
                  <span>날짜</span><span>장비</span><span>KPI</span>
                </div>
                {filtered.slice(0,15).map((r:any,i:number)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 0.8fr",padding:"3px 0",borderBottom:"1px solid #f9fafb",color:"#374151",minWidth:240}}>
                    <span>{r.date?.slice(5)}</span><span>{r.alarm_eqp_id}</span>
                    <span style={{color:"#2563eb",fontWeight:600}}>{r.alarm_kpi}</span>
                  </div>
                ))}
              </>}
            </div>
          )}
        </div>
      );
    }

    if(cur==="settings") return(
      <div style={{padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:"#374151",marginBottom:10}}>알람 임계값 설정</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            {label:"OEE 하한 (이하 알람)",val:`${thresholds.oee_min}%`,color:"#2563eb"},
            {label:"THP 하한 (이하 알람)",val:`${thresholds.thp_min}개`,color:"#059669"},
            {label:"TAT 상한 (이상 알람)",val:`${thresholds.tat_max}h`,color:"#d97706"},
            {label:"WIP 하한",            val:`${thresholds.wip_min}개`,color:"#7c3aed"},
            {label:"WIP 상한",            val:`${thresholds.wip_max}개`,color:"#7c3aed"},
          ].map(({label,val,color})=>(
            <div key={label} style={{padding:"8px 10px",borderRadius:7,background:"#f8fafc",border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:9,color:"#9ca3af",marginBottom:2}}>{label}</div>
              <div style={{fontSize:18,fontWeight:800,color}}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    );
    return null;
  };

  return(
    <div style={{marginTop:8,border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden",background:"#fff"}}>
      {/* 탭 헤더 */}
      <div style={{display:"flex",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",overflowX:"auto" as const}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setCur(t.id)} style={{
            flex:"0 0 auto",padding:"7px 10px",border:"none",background:"transparent",
            borderBottom:cur===t.id?"2px solid #2563eb":"2px solid transparent",
            color:cur===t.id?"#2563eb":"#6b7280",
            fontWeight:cur===t.id?700:400,fontSize:10,cursor:"pointer",whiteSpace:"nowrap" as const,
          }}>{t.icon} {t.label}</button>
        ))}
      </div>
      {/* 콘텐츠 영역 */}
      <div style={{height:360,overflowY:"auto" as const}}>{content()}</div>
      {/* 하단 이동 버튼 */}
      <div style={{padding:"6px 12px",background:"#f8fafc",borderTop:"1px solid #e2e8f0",display:"flex",justifyContent:"flex-end"}}>
        <button onClick={()=>onNavigate(cur)} style={{
          fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:5,
          border:"1px solid #bfdbfe",background:"#eff6ff",color:"#1d4ed8",cursor:"pointer",
        }}>전체 화면에서 보기 →</button>
      </div>
    </div>
  );
}

// ────────────────────────── 메인 App ──────────────────────────
export default function App() {
  type Tab = "dashboard"|"alarms"|"chat"|"database"|"analytics"|"settings";
  type DbTable = "kpi_daily"|"scenario_map"|"rcp_state"|"eqp_state"|"lot_state";
  type AlarmSub = "latest"|"history"|"chatlogs";

  const [activeTab, setActiveTab]     = useState<Tab>("chat");
  const [alarmSub,  setAlarmSub]      = useState<AlarmSub>("latest");
  const [chatExports, setChatExports] = useState<ChatExport[]>([]);
  const [thresholds, setThresholds]   = useState<Thresholds>({oee_min:70,thp_min:250,tat_max:3.5,wip_min:200,wip_max:300});
  const [dbTable,   setDbTable]       = useState<DbTable>("kpi_daily");
  const [selReport, setSelReport]     = useState<Report|null>(null);
  const [selReportRaw, setSelReportRaw] = useState(false);
  const [latestSaved, setLatestSaved] = useState(false);
  const [latestAlarmCount, setLatestAlarmCount] = useState(1);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showRagModal, setShowRagModal] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [historyList, setHistoryList] = useState(REPORTS);
  const [pdfFiles, setPdfFiles] = useState<{filename:string;size:number;created_at:string}[]>([]);
  const [dbKpiData, setDbKpiData] = useState<any[]>([]);
  const [dbLotData, setDbLotData] = useState<any[]>([]);
  const [dbEqpData, setDbEqpData] = useState<any[]>([]);
  const [dbRcpData, setDbRcpData] = useState<any[]>([]);
  const [dbScenarioData, setDbScenarioData] = useState<any[]>([]);
  const [_dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [dbFilterDate, setDbFilterDate] = useState<string>("all");
  const [dbFilterEqp,  setDbFilterEqp]  = useState<string>("all");
  const [dbPage,       setDbPage]       = useState<number>(1);
  const [dbEqpTotal,   setDbEqpTotal]   = useState<number>(0);
  const [dbLotTotal,   setDbLotTotal]   = useState<number>(0);
  const [dbLoading,    setDbLoading]    = useState<boolean>(false);
  const [dbError,      setDbError]      = useState<string|null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [pdfSelectMode, setPdfSelectMode] = useState(false);
  const [pdfSelected, setPdfSelected] = useState<Set<number>>(new Set());

// PDF 목록 로드 (컴포넌트 마운트 시 + 저장/삭제 후)
useEffect(()=>{
  fetchReportList().then(setPdfFiles);
  const interval = setInterval(()=>{
    fetchReportList().then(setPdfFiles);
  }, 5000);  // 5초마다 폴더 스캔
  return () => clearInterval(interval);
}, []);
// 대시보드 요약 로드 (마운트 시 1회)
useEffect(()=>{
  fetch("/api/rds/kpi-daily")
    .then(r=>r.json())
    .then(d=>{ if(d.success && d.data?.length>0) {
      const sorted=[...d.data].sort((a:any,b:any)=>b.date?.localeCompare(a.date));
      setDashboardSummary(sorted[0]);
    }})
    .catch(()=>{});
}, []);

  // 챗봇
  const [msgs,      setMsgs]      = useState<ChatMessage[]>([{
    role:"assistant",
    content:"안녕하세요. KPI Monitoring Agent입니다.\n\n- LLM: AWS Bedrock (Claude Haiku) 연동\n- RAG: ChromaDB (PDF 11건 인덱싱)\n- 데이터: 2026-01-20 ~ 2026-01-31 알람 12건",
    timestamp:nowTime(), source:"llm",
  }]);
  const [input,     setInput]     = useState("");
  const [typing,    setTyping]    = useState(false);
  const [history,   setHistory]   = useState<{role:string;content:string}[]>([]);
  const chatEnd = useRef<HTMLDivElement>(null);

  // 실시간 KPI
  const [kpi, setKpi] = useState<LiveKPI>({oee:76,thp:258,tat:2.47,wip:252,oee_prev:75,thp_prev:260,tat_prev:2.45,wip_prev:250});
  const [rt,  setRt]  = useState<RealtimePoint[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(900);

  useEffect(()=>{
    const now=new Date();
    setRt(Array.from({length:30},(_,i)=>{
      const t=new Date(now.getTime()-(29-i)*5000);
      const ts=t.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
      return{time:ts,oee:parseFloat(Math.max(71,Math.min(82,74+(Math.random()-0.5)*2)).toFixed(2)),thp:Math.round(Math.max(245,Math.min(275,260+(Math.random()-0.5)*6))),tat:parseFloat(Math.max(1.8,Math.min(3.2,2.5+(Math.random()-0.5)*0.1)).toFixed(2)),wip:Math.round(Math.max(220,Math.min(280,250+(Math.random()-0.5)*6)))};
    }));
  },[]);

  useEffect(()=>{
    const iv=setInterval(()=>{
      setKpi(p=>{
        const o=parseFloat(Math.max(71,Math.min(82,p.oee+(Math.random()-0.5)*2)).toFixed(2));
        const t=Math.round(Math.max(245,Math.min(275,p.thp+(Math.random()-0.5)*3)));
        const ta=parseFloat(Math.max(1.8,Math.min(3.2,p.tat+(Math.random()-0.5)*0.04)).toFixed(2));
        const w=Math.round(Math.max(220,Math.min(280,p.wip+(Math.random()-0.5)*4)));
        return{oee:o,thp:t,tat:ta,wip:w,oee_prev:p.oee,thp_prev:p.thp,tat_prev:p.tat,wip_prev:p.wip};
      });
      setRt(p=>[...p.slice(-29),{time:nowTime(),oee:parseFloat(Math.max(71,Math.min(82,74+(Math.random()-0.5)*2)).toFixed(2)),thp:Math.round(Math.max(245,Math.min(275,260+(Math.random()-0.5)*6))),tat:parseFloat(Math.max(1.8,Math.min(3.2,2.5+(Math.random()-0.5)*0.1)).toFixed(2)),wip:Math.round(Math.max(220,Math.min(280,250+(Math.random()-0.5)*6)))}]);
    },5000);
    return()=>clearInterval(iv);
  },[]);

 
  useEffect(()=>{
    const el = chartRef.current;
    if (!el) return;
    // 즉시 측정 (탭 전환 후 재렌더 시)
    const w = el.getBoundingClientRect().width;
    if (w > 0) setChartW(w);
    const ro = new ResizeObserver(e => setChartW(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab]); // ← activeTab 추가가 핵심!

  useEffect(()=>{ chatEnd.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

// Database 탭 - 테이블 전환 시 RDS에서 데이터 로드
// 앱 시작 시 모든 DB 테이블 백그라운드 프리로드 (Carousel 프리뷰용)
useEffect(()=>{
  const init: [string, (r:any[], d:any)=>void][] = [
    ["/api/rds/kpi-daily",    (r)=>setDbKpiData(r)],
    ["/api/rds/scenario-map", (r)=>setDbScenarioData(r)],
    ["/api/rds/rcp-state",    (r)=>setDbRcpData(r)],
    ["/api/rds/eqp-state",    (r,d)=>{setDbEqpData(r);setDbEqpTotal(d.count||r.length);}],
    ["/api/rds/lot-state",    (r,d)=>{setDbLotData(r);setDbLotTotal(d.count||r.length);}],
  ];
  init.forEach(([url,cb])=>{
    fetch(url).then(r=>r.json()).then(d=>{if(d.success)cb(d.data||[],d);}).catch(()=>{});
  });
  // 대화 기록 로드: localStorage(미저장) + S3(저장됨) 병합
  const localRaw: ChatExport[] = (() => { try{ return JSON.parse(localStorage.getItem('chat_exports')||'[]'); }catch{ return []; } })();
  fetch("/api/chatlogs").then(r=>r.json()).then(d=>{
    const s3Items: ChatExport[] = (d.success ? d.data||[] : []).map((e:ChatExport)=>({...e,savedToS3:true}));
    const s3Ids = new Set(s3Items.map((e:ChatExport)=>e.id));
    // localStorage 항목 중 S3에 없는 것만 (미업로드)
    const localOnly = localRaw.filter(e=>!s3Ids.has(e.id));
    setChatExports([...localOnly, ...s3Items].sort((a,b)=>Number(b.id)-Number(a.id)));
  }).catch(()=>{
    setChatExports(localRaw);
  });
}, []);

useEffect(()=>{
  setDbLoading(true);
  setDbError(null);
  setDbFilterDate("all");
  setDbFilterEqp("all");
  setDbPage(1);

  const endpoints: Record<string, string> = {
    kpi_daily:    "/api/rds/kpi-daily",
    scenario_map: "/api/rds/scenario-map",
    rcp_state:    "/api/rds/rcp-state",
    eqp_state:    "/api/rds/eqp-state",
    lot_state:    "/api/rds/lot-state",
  };

  fetch(endpoints[dbTable])
    .then(r=>r.json())
    .then(d=>{
      if(!d.success) throw new Error(d.error||d.detail||"조회 실패");
      const rows = d.data || [];
      if      (dbTable==="kpi_daily")    { setDbKpiData(rows); }
      else if (dbTable==="scenario_map") { setDbScenarioData(rows); }
      else if (dbTable==="rcp_state")    { setDbRcpData(rows); }
      else if (dbTable==="eqp_state")    { setDbEqpData(rows); setDbEqpTotal(d.count||rows.length); }
      else if (dbTable==="lot_state")    { setDbLotData(rows); setDbLotTotal(d.count||rows.length); }
    })
    .catch(e=>{ setDbError(e.message||"백엔드 연결 실패"); })
    .finally(()=>{ setDbLoading(false); });
}, [dbTable]);

  // 질문/답변 키워드로 관련 탭 감지
  const detectTab = (question: string, answer: string): string|null => {
    const text = (question + ' ' + answer).toLowerCase();
    if (/알람|alarm|경보|신규|이력|eqp12/.test(text)) return 'alarms';
    if (/설정|임계값|threshold|oee_min|thp_min/.test(text)) return 'settings';
    if (/데이터베이스|database|lot_state|eqp_state|rcp_state/.test(text)) return 'database';
    if (/analytics|분석|일별|추이|트렌드/.test(text)) return 'analytics';
    if (/oee|thp|tat|wip|대시보드|dashboard|라인/.test(text)) return 'dashboard';
    return null;
  };

  // ── 채팅 내용 PDF 내보내기 ──────────────────────────────────────
  // 팝업으로 마크다운 렌더링 미리보기 (보기 버튼용)
  const openChatPreview = (msgList: ChatMessage[], title: string) => {
    const now = new Date().toLocaleString('ko-KR');
    const rows = msgList.map((m, idx) => {
      const isUser = m.role === "user";
      const bg = isUser ? "#eff6ff" : "#f8fafc";
      const border = isUser ? "#bfdbfe" : "#e2e8f0";
      const label = isUser ? "👤 사용자" : "🤖 AI Assistant";
      const labelColor = isUser ? "#1d4ed8" : "#374151";
      const safe = m.content.replace(/`/g,"&#96;").replace(/\$/g,"&#36;");
      return `<div style="margin-bottom:14px;padding:14px 18px;background:${bg};border:1px solid ${border};border-radius:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:700;color:${labelColor};">${label}</span>
          <span style="font-size:11px;color:#9ca3af;">${m.timestamp}</span>
        </div>
        <div class="md-body" data-src="${encodeURIComponent(safe)}" style="font-size:13px;color:#374151;line-height:1.75;"></div>
      </div>`;
    }).join('');
    const win = window.open('', '_blank', 'width=840,height=940');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>${title}</title>
      <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:36px;color:#0f172a;background:#fff;max-width:780px;}
        h1{font-size:20px;font-weight:700;margin:0 0 4px;}
        .meta{font-size:12px;color:#9ca3af;margin-bottom:24px;padding-bottom:14px;border-bottom:2px solid #e2e8f0;}
        .print-btn{padding:8px 22px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:24px;}
        .md-body h1,.md-body h2{font-size:15px;margin:10px 0 6px;}
        .md-body h3{font-size:13px;margin:8px 0 4px;}
        .md-body p{margin:4px 0;}
        .md-body ul,.md-body ol{margin:4px 0;padding-left:20px;}
        .md-body li{margin:3px 0;}
        .md-body strong{font-weight:700;}
        .md-body code{background:#f1f5f9;padding:1px 5px;border-radius:3px;font-size:12px;font-family:monospace;}
        .md-body pre{background:#f1f5f9;padding:10px 14px;border-radius:6px;overflow-x:auto;font-size:12px;}
        .md-body table{border-collapse:collapse;width:100%;font-size:12px;margin:8px 0;}
        .md-body th,.md-body td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left;}
        .md-body th{background:#f8fafc;font-weight:700;}
        @media print{.print-btn{display:none;}}
      </style>
    </head><body>
      <h1>🤖 AI Assistant 대화 내용</h1>
      <div class="meta">${title} &nbsp;·&nbsp; ${msgList.length}개 메시지 &nbsp;·&nbsp; 열람: ${now}</div>
      <button class="print-btn" onclick="window.print()">PDF로 저장 (Ctrl+P)</button>
      ${rows}
      <script>
        document.querySelectorAll('.md-body').forEach(el=>{
          el.innerHTML = marked.parse(decodeURIComponent(el.getAttribute('data-src')||''));
        });
      <\/script>
    </body></html>`);
    win.document.close();
  };

  // 대화 기록 탭에 저장 (로컬 state + localStorage)
  const saveChatLog = (msgList: ChatMessage[]) => {
    const now = new Date().toLocaleString('ko-KR');
    const firstAns = msgList.find(m=>m.role==="assistant");
    let title = `대화 기록 — ${now}`;
    if (firstAns) {
      const ansIdx = msgs.findIndex(m=>m.timestamp===firstAns.timestamp && m.content===firstAns.content);
      for (let i = ansIdx - 1; i >= 0; i--) {
        if (msgs[i].role==="user") {
          const q = msgs[i].content;
          title = `${q.slice(0,45)}${q.length>45?"…":""}`;
          break;
        }
      }
    }
    const newExport: ChatExport = {
      id: Date.now().toString(),
      title,
      date: now,
      msgCount: msgList.length,
      messages: msgList,
      savedToS3: false,
    };
    setChatExports(prev=>{
      const updated = [newExport, ...prev];
      try{ localStorage.setItem('chat_exports', JSON.stringify(updated)); }catch{}
      return updated;
    });
  };

  // LLM 전송
  const handleSend = useCallback(async()=>{
    if(!input.trim()||typing) return;
    const q=input.trim();
    const t=nowTime();

    // PDF 내보내기 키워드 감지 (LLM 호출 없이 처리)
    if(/pdf/i.test(q) || (/내보내기|export/i.test(q) && /대화|채팅|chat|기록/i.test(q))) {
      setMsgs(p=>[...p,{role:"user",content:q,timestamp:t}]);
      setInput("");
      if(msgs.length===0){
        setMsgs(p=>[...p,{role:"assistant",content:"저장할 대화 내용이 없습니다. 먼저 질문을 해보세요.",timestamp:nowTime(),source:"llm"}]);
      } else {
        // 선택 모드 진입 — AI 답변만 기본 선택 (첫 인사 메시지 제외)
        const firstAssistantIdx = msgs.findIndex(m=>m.role==="assistant");
        const answerIndices = new Set(
          msgs
            .map((m,i)=>({m,i}))
            .filter(({m,i})=>m.role==="assistant" && i!==firstAssistantIdx && !m.noSelect)
            .map(({i})=>i)
        );
        setPdfSelected(answerIndices);
        setPdfSelectMode(true);
        setMsgs(p=>[...p,{role:"assistant",content:"AI 답변 메시지를 클릭해서 선택하세요. 선택 후 상단 저장 버튼을 누르면 Alarm Center 대화 기록 탭에 저장됩니다.",timestamp:nowTime(),source:"llm"}]);
      }
      return;
    }

    const newH=[...history,{role:"user",content:q}];
    setMsgs(p=>[...p,{role:"user",content:q,timestamp:t}]);
    setInput("");
    setTyping(true);
    setHistory(newH);
    try{
      // 실시간 KPI 스냅샷만 전달 (최소 컨텍스트)
      const liveContext = [
        `## 현재 KPI (실시간)`,
        `- OEE: ${kpi.oee.toFixed(1)}% (목표: ${thresholds.oee_min}%)`,
        `- THP: ${kpi.thp}개 (목표: ${thresholds.thp_min}개)`,
        `- TAT: ${kpi.tat.toFixed(2)}h (목표: ${thresholds.tat_max}h)`,
        `- WIP: ${kpi.wip}개 (목표 범위: ${thresholds.wip_min}~${thresholds.wip_max}개)`,
      ].join('\n');
      const {text,source}=await callLLM(newH, liveContext);
      // LLM이 반환한 [탭:xxx] 태그 추출 후 제거
      const tabMatch = text.match(/\[탭:(\w+)\]/);
      const llmTab = tabMatch ? tabMatch[1] : null;
      const cleanText = text.replace(/\[탭:\w+\]\s*/g,'').trimEnd();
      // 키워드 기반 fallback (LLM 태그 없거나 none일 때)
      const suggestedTab = (llmTab && llmTab!=='none') ? llmTab : detectTab(q, cleanText) ?? undefined;
      const extractedDate = extractDateFromQuestion(q);
      const hasReport = extractedDate !== null
        ? (REPORTS.some(r => r.date === extractedDate) || extractedDate === LATEST_ALARM.date)
        : false;
      const highlightedDate: string | undefined = (hasReport && extractedDate !== null) ? extractedDate : undefined;
      setHistory(h=>[...h,{role:"assistant",content:cleanText}]);
      setMsgs(p=>[...p,{role:"assistant",content:cleanText,timestamp:nowTime(),source,suggestedTab,highlightedDate}]);
    }catch(e){
      setMsgs(p=>[...p,{role:"assistant",content:"오류가 발생했습니다. 잠시 후 다시 시도해주세요.",timestamp:nowTime(),source:"error"}]);
    }finally{ setTyping(false); }
  },[input,history,typing,kpi,thresholds,msgs,saveChatLog]);

  const delta=(cur:number,prev:number,inv=false)=>{
    const up=cur>prev; const good=inv?!up:up;
    return{arrow:up?"▲":"▼",color:good?"#16a34a":"#dc2626",val:Math.abs(cur-prev).toFixed(2)};
  };

  // ── DB 필터 헬퍼 ──────────────────────────────────────────────
  const activeDbData =
    dbTable==="kpi_daily"    ? dbKpiData :
    dbTable==="scenario_map" ? dbScenarioData :
    dbTable==="rcp_state"    ? dbRcpData :
    dbTable==="eqp_state"    ? dbEqpData :
                               dbLotData;
  const dbGetDate=(row:any):string|null=>
    dbTable==="kpi_daily"||dbTable==="scenario_map" ? (row.date??null) :
    dbTable==="eqp_state"||dbTable==="lot_state"    ? (row.event_time?.slice(0,10)??null) : null;
  const dbGetEqp=(row:any):string|null=>
    dbTable==="scenario_map" ? (row.alarm_eqp_id??null) : (row.eqp_id??null);
  const isPaged = dbTable==="eqp_state"||dbTable==="lot_state";
  // RDS에서 전체 데이터 로드 → 모든 테이블 클라이언트 필터 적용
  const filteredDbData = activeDbData.filter(row=>{
    const dOk=dbFilterDate==="all"||dbGetDate(row)===dbFilterDate;
    const eOk=dbFilterEqp==="all"||dbGetEqp(row)===dbFilterEqp;
    return dOk&&eOk;
  });
  // 드롭다운 옵션: 로드된 데이터에서 추출
  const dbUniqDates=Array.from(new Set(activeDbData.map(dbGetDate).filter(Boolean) as string[])).sort();
  const dbUniqEqps =Array.from(new Set(activeDbData.map(dbGetEqp).filter(Boolean) as string[])).sort();
  const filterDates = dbUniqDates;
  const filterEqps  = dbUniqEqps;
  const DB_PAGE_SIZE = 200;
  const dbTotalCount = dbTable==="eqp_state" ? dbEqpTotal : dbTable==="lot_state" ? dbLotTotal : filteredDbData.length;
  const dbTotalPages = isPaged ? Math.max(1, Math.ceil(filteredDbData.length / DB_PAGE_SIZE)) : 1;
  const pagedDbData  = isPaged ? filteredDbData.slice((dbPage-1)*DB_PAGE_SIZE, dbPage*DB_PAGE_SIZE) : filteredDbData;

  const NAV_ITEMS = [
  {id:"chat"      as Tab, label:"AI Assistant", desc:"LLM + RAG",     icon:"🤖"},
  {id:"dashboard" as Tab, label:"Dashboard",    desc:"실시간 현황",    icon:"📊"},
  {id:"alarms"    as Tab, label:"Alarm Center", desc:"최신·과거 알람", icon:"🔔"},
  {id:"analytics" as Tab, label:"Analytics",    desc:"KPI 트렌드 분석",icon:"📈"},
  {id:"database"  as Tab, label:"Database",     desc:"원본 데이터",    icon:"🗄️"},
  {id:"settings"  as Tab, label:"Settings",     desc:"알람 설정",      icon:"⚙️"},
];

  return(
    <div style={S.root}>
      {/* ── 담당자 연결 모달 ── */}
      <ContactModal open={showContactModal} onClose={()=>setShowContactModal(false)}/>
      {/* ── SIDEBAR ── */}
      <aside style={S.sidebar}>
        <div style={S.logo}>
          <div style={S.logoMark}>KPI</div>
          <div><div style={{color:"#f1f5f9",fontWeight:600,fontSize:14}}>Monitor</div><div style={{color:"#475569",fontSize:10,marginTop:1}}>Agent v1.0</div></div>
        </div>
        <nav style={S.nav}>
          {NAV_ITEMS.map(it=>(
            <button key={it.id} style={{...S.navItem,...(activeTab===it.id?S.navActive:{})}} onClick={()=>setActiveTab(it.id)}>
              <span style={{width:6,height:6,borderRadius:"50%",background:activeTab===it.id?"#3b82f6":"#334155",flexShrink:0,marginTop:5}}/>
              <div style={{textAlign:"left" as const}}>
                <div style={{fontSize:13,fontWeight:activeTab===it.id?600:400,color:activeTab===it.id?"#f1f5f9":"#94a3b8"}}>{it.label}</div>
                <div style={{fontSize:10,color:"#475569",marginTop:1}}>{it.desc}</div>
              </div>
            </button>
          ))}
        </nav>
        {/* 알람 분포 */}
        <div style={S.sideStats}>
          <div style={{fontSize:10,fontWeight:700,color:"#475569",letterSpacing:0.8,textTransform:"uppercase" as const,marginBottom:10}}>알람 분포 (12건)</div>
          {[{k:"OEE",n:3},{k:"THP",n:3},{k:"TAT",n:2},{k:"WIP_EXCEED",n:2},{k:"WIP_SHORTAGE",n:2}].map(({k,n})=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:KPI_META[k].color,flexShrink:0}}/>
              <span style={{fontSize:11,color:"#94a3b8",flex:1}}>{KPI_META[k].label}</span>
              <span style={{fontSize:12,fontWeight:600,color:"#e2e8f0",fontFamily:"Pretendard, sans-serif"}}>{n}</span>
            </div>
          ))}
        </div>
        <div style={{padding:"14px 18px",borderTop:"1px solid #1e293b",display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:"#22c55e"}}/>
          <span style={{color:"#475569",fontSize:11}}>System Online</span>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={S.main}>
        {/* 헤더 */}
        <header style={{...S.header, padding:"12px 32px"}}>
  <div style={{display:"flex",alignItems:"center",gap:16}}>
    <div>
      <h1 style={S.pageTitle}>
        {activeTab==="dashboard"?"📊 Dashboard":
         activeTab==="alarms"?"🔔 Alarm Center":
         activeTab==="chat"?"🤖 AI Assistant":
         activeTab==="analytics"?"📈 Analytics":
         activeTab==="settings"?"⚙️ Settings":"🗄️ Database"}
      </h1>
      <p style={S.pageSub}>
        {activeTab==="dashboard"?"생산 KPI 실시간 모니터링 · 2026-01-20 ~ 2026-01-31":
         activeTab==="alarms"?"최신 알람(2026-01-31) / 과거 이력 PDF 11건":
         activeTab==="chat"?"AWS Bedrock Claude Haiku · RAG(ChromaDB) 기반 분석":
         activeTab==="analytics"?"KPI 장기 트렌드 · 알람 패턴 분석":
         activeTab==="settings"?"알람 임계값 · 알림 설정":"Amazon RDS (PostgreSQL) · 5개 테이블"}
      </p>
    </div>
  </div>
  <div style={{display:"flex",alignItems:"center",gap:10}}>
    
    {[
  {label:"OEE", val:`${kpi.oee.toFixed(1)}%`, bad:kpi.oee<thresholds.oee_min, color:"#2563eb"},
  {label:"THP", val:String(kpi.thp), bad:kpi.thp<thresholds.thp_min, color:"#059669"},
  {label:"TAT", val:`${kpi.tat.toFixed(2)}h`, bad:kpi.tat>thresholds.tat_max, color:"#d97706"},
  {label:"WIP", val:String(kpi.wip), bad:kpi.wip<thresholds.wip_min||kpi.wip>thresholds.wip_max, color:"#7c3aed"},
].map(({label,val,bad,color})=>(
  <div key={label} style={{
    padding:"5px 12px", borderRadius:8,
    background: bad?"#fee2e2":"#f8fafc",
    border:`1px solid ${bad?"#fecaca":"#e2e8f0"}`,
    display:"flex", alignItems:"center", gap:6,
  }}>
        <span style={{fontSize:10,fontWeight:700,color:"#9ca3af"}}>{label}</span>
        <span style={{fontSize:13,fontWeight:700,fontFamily:"Pretendard, sans-serif",color:bad?"#dc2626":color}}>{val}</span>
        {bad && <span style={{width:6,height:6,borderRadius:"50%",background:"#dc2626",animation:"pulse 1s infinite"}}/>}
      </div>
    ))}
    <div style={S.dateChip}>{new Date().toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false})}</div>
    {(kpi.oee<thresholds.oee_min||kpi.thp<thresholds.thp_min||kpi.tat>thresholds.tat_max||kpi.wip<thresholds.wip_min||kpi.wip>thresholds.wip_max)&&<div style={S.alarmChip}>🔴 신규 알람 1건</div>}
    <button
      onClick={()=>setShowContactModal(true)}
      style={{
        padding:"6px 14px", borderRadius:8, border:"1px solid #3b82f6",
        background:"#eff6ff", color:"#1d4ed8", fontWeight:700, fontSize:12,
        cursor:"pointer", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap",
      }}
    >
      담당자 연결
    </button>
  </div>
        </header>

        {/* ═══ DASHBOARD ═══ */}
        {activeTab==="dashboard"&&(
          <div style={S.content}>
            <SL>실시간 KPI 현황</SL>
            <div style={S.rtGrid}>
              {([
                {label:"OEE",sub:"Overall Equipment Effectiveness",val:`${kpi.oee.toFixed(1)}%`,cur:kpi.oee,prev:kpi.oee_prev,tgt:`목표 ${thresholds.oee_min}%`,bad:kpi.oee<thresholds.oee_min,inv:false},
                {label:"THP",sub:"Throughput (UPH)",val:String(kpi.thp),cur:kpi.thp,prev:kpi.thp_prev,tgt:`목표 ${thresholds.thp_min}`,bad:kpi.thp<thresholds.thp_min,inv:false},
                {label:"TAT",sub:"Turn-Around Time",val:`${kpi.tat.toFixed(2)}h`,cur:kpi.tat,prev:kpi.tat_prev,tgt:`목표 <${thresholds.tat_max}h`,bad:kpi.tat>thresholds.tat_max,inv:true},
                {label:"WIP",sub:"Work In Process",val:String(kpi.wip),cur:kpi.wip,prev:kpi.wip_prev,tgt:`목표 ${thresholds.wip_min}~${thresholds.wip_max}EA`,bad:kpi.wip<thresholds.wip_min||kpi.wip>thresholds.wip_max,inv:false},
              ]).map((c,i)=>{
                const d=delta(c.cur,c.prev,c.inv);
                return(
                  <div key={i} style={{...S.rtCard,borderTop:`3px solid ${c.bad?"#dc2626":"#e5e7eb"}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:"#9ca3af",letterSpacing:0.8,textTransform:"uppercase" as const}}>{c.label}</span>
                      {c.bad&&<span style={{fontSize:10,fontWeight:600,color:"#dc2626",background:"#fee2e2",padding:"2px 7px",borderRadius:4}}>이상</span>}
                    </div>
                    <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                      <div style={{fontSize:26,fontWeight:700,fontFamily:"Pretendard, sans-serif",color:c.bad?"#dc2626":"#0f172a",lineHeight:1}}>{c.val}</div>
                      <span style={{fontSize:11,color:d.color,fontWeight:600}}>{d.arrow} {d.val}</span>
                    </div>
                    <div style={{fontSize:11,color:"#9ca3af",marginTop:6}}>{c.sub} · {c.tgt}</div>
                  </div>
                );
              })}
            </div>
            {/* 실시간 차트 */}
            <div style={S.chartCard}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>실시간 KPI 트렌드</div>
                  <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}></div>
                </div>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  {[{c:"#2563eb",l:"OEE"},{c:"#10b981",l:"THP"},{c:"#f59e0b",l:"TAT"},{c:"#8b5cf6",l:"WIP"}].map(({c,l})=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:"50%",background:c}}/><span style={{fontSize:11,color:"#6b7280"}}>{l}</span></div>
                  ))}
                </div>
              </div>
              <div ref={chartRef} style={{width:"100%",height:200}}><RealtimeChart data={rt} width={chartW} height={200}/></div>
            </div>
            {/* 최신 알람 하이라이트 */}
            <SL style={{marginTop:24}}>최신 알람 — 2026-01-31</SL>
            <div style={{...S.card,borderLeft:"4px solid #059669",cursor:"pointer"}} onClick={()=>{setActiveTab("alarms");setAlarmSub("latest");}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>EQP12 — Throughput 알람</span>
                <span style={{...S.badge,background:"#d1fae5",color:"#065f46"}}>THP · 신규</span>
              </div>
              <div style={{fontSize:11,color:"#9ca3af",marginBottom:10,fontFamily:"Pretendard, sans-serif"}}>2026-01-31 09:10 · LINE2 · OPER4</div>
              <div style={{display:"flex",gap:10,padding:"10px 14px",background:"#f9fafb",borderRadius:8,marginBottom:10}}>
                <div style={{flex:1}}><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase" as const,marginBottom:2}}>Target</div><div style={{fontSize:16,fontWeight:700,fontFamily:"Pretendard, sans-serif"}}>250</div></div>
                <div style={{color:"#dc2626",fontSize:20,fontWeight:700,alignSelf:"center"}}>↓</div>
                <div style={{flex:1}}><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase" as const,marginBottom:2}}>Actual</div><div style={{fontSize:16,fontWeight:700,fontFamily:"Pretendard, sans-serif",color:"#dc2626"}}>227</div></div>
                <div style={{flex:1}}><div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase" as const,marginBottom:2}}>Diff</div><div style={{fontSize:16,fontWeight:700,fontFamily:"Pretendard, sans-serif",color:"#dc2626"}}>-23</div></div>
              </div>
              <div style={{fontSize:12,color:"#374151"}}>{LATEST_ALARM.causes[0]}</div>
              <div style={{fontSize:11,color:"#2563eb",fontWeight:500,marginTop:8,textAlign:"right" as const}}>Alarm Center에서 상세 보기 →</div>
            </div>
          </div>
        )}

        {/* ═══ ALARM CENTER ═══ */}
        {activeTab==="alarms"&&(
          <div style={S.content}>
            {/* 서브탭 */}
            <div style={S.subTabBar}>
              <button style={{...S.subTab,...(alarmSub==="latest"?S.subTabOn:{})}} onClick={()=>setAlarmSub("latest")}>
                최신 알람
                <span style={{marginLeft:6,fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:10,background:alarmSub==="latest"?"#dc2626":"#fee2e2",color:alarmSub==="latest"?"#fff":"#991b1b"}}>{latestAlarmCount}</span>
              </button>
              <button style={{...S.subTab,...(alarmSub==="history"?S.subTabOn:{})}} onClick={()=>setAlarmSub("history")}>
                과거 이력 (PDF)
                <span style={{marginLeft:6,fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:10,background:alarmSub==="history"?"#0f172a":"#e5e7eb",color:alarmSub==="history"?"#fff":"#374151"}}>{historyList.length}</span>
              </button>
              <button style={{...S.subTab,...(alarmSub==="chatlogs"?S.subTabOn:{})}} onClick={()=>setAlarmSub("chatlogs")}>
                대화 기록
                <span style={{marginLeft:6,fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:10,background:alarmSub==="chatlogs"?"#7c3aed":"#ede9fe",color:alarmSub==="chatlogs"?"#fff":"#7c3aed"}}>{chatExports.length}</span>
              </button>
            </div>

            {/* 최신 알람 상세 */}
            {alarmSub==="latest"&&(
              <>
              <div style={{...S.card,borderLeft:"4px solid #059669"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
                  <div>
                    <div style={{fontSize:20,fontWeight:700,color:"#0f172a"}}>EQP12 — Throughput 알람</div>
                    <div style={{fontSize:12,color:"#9ca3af",marginTop:4,fontFamily:"Pretendard, sans-serif"}}>2026-01-31 09:10 · LINE2 · OPER4 · RCP23 / RCP24</div>
                  </div>
                  <span style={{...S.badge,background:"#d1fae5",color:"#065f46",alignSelf:"flex-start"}}>THP · 신규</span>
                </div>
                {/* KPI 4개 */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
                  {[
                    {label:"OEE",t:"70%",v:"76.44%",bad:false},
                    {label:"THP",t:"250",v:"227",bad:true},
                    {label:"TAT",t:"3.5h",v:"2.27h",bad:false},
                    {label:"WIP",t:"250EA",v:"250EA",bad:false},
                  ].map((kv,i)=>(
                    <div key={i} style={{background:"#f9fafb",border:`1px solid ${kv.bad?"#fecaca":"#e5e7eb"}`,borderRadius:8,padding:"12px 14px"}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase" as const,marginBottom:6,letterSpacing:0.5}}>{kv.label}</div>
                      <div style={{fontSize:11,color:"#9ca3af",fontFamily:"Pretendard, sans-serif",marginBottom:2}}>T: {kv.t}</div>
                      <div style={{fontSize:17,fontWeight:700,fontFamily:"Pretendard, sans-serif",color:kv.bad?"#dc2626":"#059669"}}>A: {kv.v}</div>
                      {kv.bad&&<div style={{marginTop:5}}><span style={{fontSize:10,fontWeight:600,color:"#dc2626",background:"#fef2f2",padding:"2px 7px",borderRadius:4}}>미달</span></div>}
                    </div>
                  ))}
                </div>
                {/* 근본 원인 */}
                <SL>근본 원인 분석</SL>
                {LATEST_ALARM.causes.map((c,i)=>(
                  <div key={i} style={{display:"flex",gap:10,marginBottom:8}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:"#059669",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",flexShrink:0}}>{i+1}</div>
                    <div style={{fontSize:13,color:"#374151",lineHeight:1.6}}>{c}</div>
                  </div>
                ))}
                {/* EQP 타임라인 */}
                <SL style={{marginTop:18}}>장비 상태 타임라인 (EQP_STATE · 2026-01-31 EQP12)</SL>
                <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,overflow:"hidden",marginBottom:16}}>
                  <div style={{display:"grid",gridTemplateColumns:"120px 80px 1fr 80px",padding:"8px 14px",background:"#f3f4f6",borderBottom:"1px solid #e5e7eb"}}>
                    {["시간","상태","LOT ID","레시피"].map((h,i)=><div key={i} style={{fontSize:10,fontWeight:700,color:"#6b7280",letterSpacing:0.4}}>{h}</div>)}
                  </div>
                  {LATEST_ALARM.eqp_timeline.map((row,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"120px 80px 1fr 80px",padding:"8px 14px",borderBottom:i<LATEST_ALARM.eqp_timeline.length-1?"1px solid #f3f4f6":"none",background:row.state==="DOWN"?"#fef2f2":"#fff"}}>
                      <div style={{fontSize:11,fontFamily:"Pretendard, sans-serif",color:"#374151"}}>{row.time}</div>
                      <div><span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:4,background:row.state==="DOWN"?"#fee2e2":row.state==="RUN"?"#dcfce7":"#f1f5f9",color:row.state==="DOWN"?"#991b1b":row.state==="RUN"?"#166534":"#475569"}}>{row.state}</span></div>
                      <div style={{fontSize:11,fontFamily:"Pretendard, sans-serif",color:"#6b7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{row.lot}</div>
                      <div style={{fontSize:11,fontFamily:"Pretendard, sans-serif",color:"#374151"}}>{row.rcp}</div>
                    </div>
                  ))}
                </div>
                {/* 해결 시나리오 */}
                <SL>해결 시나리오</SL>
                {LATEST_ALARM.scenarios.map((s,i)=>(
                  <div key={i} style={{display:"flex",gap:10,marginBottom:8}}>
                    <span style={{color:"#16a34a",fontWeight:700,flexShrink:0,marginTop:2}}>✓</span>
                    <div style={{fontSize:13,color:"#374151",lineHeight:1.6}}>{s}</div>
                  </div>
                ))}
              </div>
              <div style={{borderTop:"1px solid #f3f4f6",paddingTop:16,marginTop:8,display:"flex",gap:12,alignItems:"center"}}>
                <button
                  onClick={()=>setShowPdfModal(true)}
                  style={{padding:"7px 14px",borderRadius:6,border:"none",background:"#2563eb",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}
                >
                  PDF 보고서 생성
                </button>
                {latestSaved&&<span style={{color:"#16a34a",fontWeight:600,fontSize:13}}>RAG에 저장됨</span>}
                <button
                  style={{padding:"6px 12px",borderRadius:6,border:"1px solid #d1d5db",background:"#fff",color:"#6b7280",fontWeight:600,fontSize:13,cursor:"pointer"}}
                  onClick={async ()=>{
                    if(window.confirm("초기화하면 추가된 보고서 파일도 삭제됩니다. 계속하시겠습니까?")){
                      if(latestSaved){
                        await deleteReportFile("report_20260131_EQP12_THP.pdf");
                      }
                      setHistoryList(REPORTS);
                      setLatestSaved(false);
                      setLatestAlarmCount(1);
                      fetchReportList().then(setPdfFiles);
                    }
                  }}
                >
                  초기화
                </button>
              </div>
              </>
            )}

            {/* 과거 이력 */}
            {alarmSub==="history"&&(
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginTop:16,marginBottom:16,padding:"10px 16px",background:"#ede9fe",border:"1px solid #c4b5fd",borderRadius:8}}>
                  <span style={{fontSize:11,fontWeight:700,color:"#5b21b6",letterSpacing:0.5}}>RAG DB</span>
                  <span style={{fontSize:13,color:"#4c1d95"}}>ChromaDB에 인덱싱된 PDF 리포트 11건 — 클릭 시 PDF 원본 내용을 확인할 수 있습니다</span>
                </div>
                <div style={S.alarmGrid}>
                  {historyList.map((r,i)=>{
                    const meta=KPI_META[r.alarm_kpi]; const bad=isBad(r);
                    return(
                      <div key={i} style={{...S.card,borderLeft:`4px solid ${meta.color}`,cursor:"pointer"}} onClick={()=>{setSelReportRaw(false);setSelReport(r);}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:15,fontWeight:700,fontFamily:"Pretendard, sans-serif"}}>{r.eqp_id}</span>
                          <span style={{...S.badge,background:meta.bg,color:meta.textColor}}>{meta.label}</span>
                        </div>
                        <div style={{fontSize:11,color:"#9ca3af",marginBottom:10,fontFamily:"Pretendard, sans-serif"}}>{r.date} {r.time} · {r.line_id}</div>
                        <div style={{display:"flex",gap:8,padding:"10px 12px",background:"#f9fafb",borderRadius:7,marginBottom:10}}>
                          <div style={{flex:1}}><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase" as const,marginBottom:2}}>Target</div><div style={{fontSize:14,fontWeight:700,fontFamily:"Pretendard, sans-serif"}}>{r.target_raw}</div></div>
                          <div style={{color:bad?"#dc2626":"#16a34a",fontSize:18,fontWeight:700,alignSelf:"center"}}>{bad?"↓":"↑"}</div>
                          <div style={{flex:1}}><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase" as const,marginBottom:2}}>Actual</div><div style={{fontSize:14,fontWeight:700,fontFamily:"Pretendard, sans-serif",color:bad?"#dc2626":"#16a34a"}}>{r.actual_raw}</div></div>
                        </div>
                        <AchievementBar report={r}/>
                        <div style={{fontSize:12,color:"#6b7280",marginTop:8,lineHeight:1.5}}>{r.causes[0]}</div>
                        <div style={{marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontSize:10,color:"#7c3aed",background:"#ede9fe",padding:"2px 7px",borderRadius:4,fontWeight:600,cursor:"pointer"}} onClick={e=>{e.stopPropagation();setSelReportRaw(true);setSelReport(r);}}>PDF 원본 보기 →</span>
                          <span style={{fontSize:10,color:"#9ca3af",fontFamily:"Pretendard, sans-serif"}}>{r.filename.replace("report_","").replace(".pdf","")}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 대화 기록 */}
            {alarmSub==="chatlogs"&&(
              <div>
                {chatExports.length===0?(
                  <div style={{textAlign:"center" as const,padding:"48px 0",color:"#9ca3af"}}>
                    <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>저장된 대화 기록 없음</div>
                    <div style={{fontSize:12}}>AI Assistant에서 "대화 내용 저장해줘"라고 입력하면 여기에 기록됩니다.</div>
                  </div>
                ):(
                  <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                    {chatExports.map((ex)=>{
                      const deleteFn=async()=>{
                        if(ex.savedToS3){
                          try{ await fetch(`/api/chatlogs/${ex.id}`,{method:"DELETE"}); }
                          catch(e){ console.error("S3 삭제 실패",e); }
                        }
                        setChatExports(prev=>{
                          const updated=prev.filter(e=>e.id!==ex.id);
                          try{ localStorage.setItem('chat_exports',JSON.stringify(updated)); }catch{}
                          return updated;
                        });
                      };
                      const saveToS3Fn=async()=>{
                        try{
                          await fetch("/api/chatlogs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(ex)});
                          setChatExports(prev=>{
                            const updated=prev.map(e=>e.id===ex.id?{...e,savedToS3:true}:e);
                            try{ localStorage.setItem('chat_exports',JSON.stringify(updated)); }catch{}
                            return updated;
                          });
                        }catch(e){ console.error("S3 저장 실패",e); }
                      };
                      const viewFn=()=>openChatPreview(ex.messages, ex.title);
                      const firstAns = ex.messages.find(m=>m.role==="assistant");
                      const preview = firstAns ? firstAns.content.replace(/[#*`]/g,"").slice(0,100)+"…" : "";
                      return(
                        <div key={ex.id} style={{padding:"16px 20px",borderRadius:10,background:"#fff",border:`1px solid ${ex.savedToS3?"#bbf7d0":"#e2e8f0"}`}}>
                          <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:preview?10:0}}>
                            <div style={{flex:1}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                                <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{ex.title}</div>
                                {ex.savedToS3
                                  ? <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:4,background:"#dcfce7",color:"#166534"}}>S3 저장됨</span>
                                  : <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:4,background:"#f1f5f9",color:"#64748b"}}>로컬</span>
                                }
                              </div>
                              <div style={{fontSize:11,color:"#9ca3af"}}>{ex.date} · {ex.msgCount}개 메시지</div>
                            </div>
                            <div style={{display:"flex",gap:8,flexShrink:0}}>
                              <button onClick={viewFn} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #bfdbfe",background:"#eff6ff",color:"#1d4ed8",fontSize:12,fontWeight:600,cursor:"pointer"}}>보기</button>
                              {!ex.savedToS3&&(
                                <button onClick={saveToS3Fn} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #bbf7d0",background:"#f0fdf4",color:"#166534",fontSize:12,fontWeight:600,cursor:"pointer"}}>S3 저장</button>
                              )}
                              <button onClick={deleteFn} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",fontSize:12,fontWeight:600,cursor:"pointer"}}>삭제</button>
                            </div>
                          </div>
                          {preview&&(
                            <div style={{fontSize:12,color:"#475569",lineHeight:1.6,background:"#f8fafc",borderRadius:6,padding:"8px 12px",borderLeft:"3px solid #cbd5e1"}}>{preview}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ AI ASSISTANT ═══ */}
        {activeTab==="chat"&&(
          <div style={{display:"flex",height:"calc(100vh - 65px)"}}>
            {/* RAG 소스 패널 */}
            <div style={S.ragPanel}>
              <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:2}}>RAG 데이터 소스</div>
              <div style={{fontSize:10,color:"#9ca3af",marginBottom:4}}>ChromaDB · 11개 PDF</div>
              <div style={{fontSize:10,fontWeight:700,color:"#7c3aed",background:"#ede9fe",padding:"3px 8px",borderRadius:4,marginBottom:10,letterSpacing:0.3,display:"inline-block"}}>LLM: Claude Haiku</div>
              <div style={{flex:1,overflowY:"auto" as const,display:"flex",flexDirection:"column" as const,gap:4}}>
                {/* 최신 알람 (RAG 미등록) */}
                <div style={{padding:"8px 10px",borderRadius:7,background:"#dcfce7",border:"1px solid #bbf7d0",cursor:"pointer",marginBottom:4}} onClick={()=>{setActiveTab("alarms");setAlarmSub("latest");}}>
                  <div style={{fontSize:11,fontWeight:600,color:"#166534"}}>EQP12 · THP (신규)</div>
                  <div style={{fontSize:10,color:"#16a34a",fontFamily:"Pretendard, sans-serif"}}>2026-01-31 · 미등록</div>
                </div>
                {REPORTS.map((r,i)=>(
                  <div key={i} style={S.ragItem} onClick={()=>setSelReport(r)}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:KPI_META[r.alarm_kpi].color,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:500,color:"#374151"}}>{r.eqp_id} · {KPI_META[r.alarm_kpi].label}</div>
                      <div style={{fontSize:10,color:"#9ca3af",fontFamily:"Pretendard, sans-serif"}}>{r.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 챗봇 */}
            <div style={{flex:1,display:"flex",flexDirection:"column" as const,overflow:"hidden"}}>

              {/* 선택 모드 컨트롤 바 */}
              {pdfSelectMode&&(
                <div style={{padding:"10px 20px",background:"#eff6ff",borderBottom:"2px solid #bfdbfe",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
                  <span style={{fontSize:13,fontWeight:700,color:"#1d4ed8"}}>💾 저장할 메시지를 클릭해서 선택하세요 &nbsp;·&nbsp; <span style={{color:"#2563eb"}}>{pdfSelected.size}개</span> 선택됨</span>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setPdfSelected(new Set(msgs.map((_,i)=>i)))} style={{fontSize:11,padding:"4px 12px",borderRadius:5,border:"1px solid #93c5fd",background:"#fff",color:"#1d4ed8",cursor:"pointer",fontWeight:600}}>전체 선택</button>
                    <button onClick={()=>setPdfSelected(new Set())} style={{fontSize:11,padding:"4px 12px",borderRadius:5,border:"1px solid #d1d5db",background:"#fff",color:"#6b7280",cursor:"pointer"}}>전체 해제</button>
                    <button
                      disabled={pdfSelected.size===0}
                      onClick={()=>{
                        const selected=msgs.filter((_,i)=>pdfSelected.has(i));
                        saveChatLog(selected);
                        setPdfSelectMode(false);setPdfSelected(new Set());
                        setMsgs(p=>[...p,{role:"assistant",content:`**${selected.length}개 메시지**를 대화 기록에 저장했습니다.\nAlarm Center → **대화 기록** 탭에서 확인할 수 있습니다.`,timestamp:nowTime(),source:"llm",noSelect:true}]);
                      }}
                      style={{fontSize:11,padding:"4px 14px",borderRadius:5,border:"none",background:pdfSelected.size===0?"#93c5fd":"#2563eb",color:"#fff",fontWeight:700,cursor:pdfSelected.size===0?"default":"pointer"}}
                    >저장 ({pdfSelected.size}개)</button>
                    <button onClick={()=>{setPdfSelectMode(false);setPdfSelected(new Set());}} style={{fontSize:11,padding:"4px 12px",borderRadius:5,border:"1px solid #fca5a5",background:"#fff",color:"#dc2626",cursor:"pointer"}}>취소</button>
                  </div>
                </div>
              )}

              <div style={{flex:1,overflowY:"auto" as const,padding:"20px 28px",display:"flex",flexDirection:"column" as const,gap:14}}>
                {msgs.map((m,i)=>{
                  const firstAssistantIdx = msgs.findIndex(m=>m.role==="assistant");
                  // suggestedTab이 있는 마지막 assistant 메시지 (저장 완료 메시지 등에 의해 밀리지 않도록)
                  const lastSuggestedIdx = msgs.reduce((acc,msg,idx)=>msg.role==="assistant"&&msg.suggestedTab?idx:acc, -1);
                  // 선택 가능: assistant 메시지 중 첫 인사 제외
                  const isSelectable = pdfSelectMode && m.role==="assistant" && i!==firstAssistantIdx && !m.noSelect;
                  const checked = isSelectable && pdfSelected.has(i);
                  const toggleSelect = ()=>{
                    if(!isSelectable) return;
                    setPdfSelected(prev=>{const next=new Set(prev); checked?next.delete(i):next.add(i); return next;});
                  };
                  return(
                  <div
                    key={i}
                    onClick={toggleSelect}
                    style={{
                      display:"flex",alignItems:"flex-end",gap:8,
                      justifyContent:m.role==="user"?"flex-end":"flex-start",
                      cursor:isSelectable?"pointer":"default",
                      borderRadius:12,
                      transition:"background 0.15s",
                      background:isSelectable?(checked?"#dbeafe":"rgba(239,246,255,0.5)"):"transparent",
                      outline:checked?"2px solid #3b82f6":"none",
                      padding:isSelectable?"6px 8px":"0",
                      margin:isSelectable?"0 -8px":"0",
                      opacity:pdfSelectMode&&!isSelectable?0.45:1,
                    }}
                  >
                    {/* 선택 모드: AI 답변에만 체크박스 표시 */}
                    {isSelectable&&(
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={toggleSelect}
                        onClick={e=>e.stopPropagation()}
                        style={{flexShrink:0,width:16,height:16,cursor:"pointer",alignSelf:"center",accentColor:"#2563eb"}}
                      />
                    )}
                    {m.role==="assistant"&&(
                      <div style={{width:30,height:30,borderRadius:8,background:"#0f172a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,fontFamily:"Pretendard, sans-serif"}}>AI</div>
                    )}
                    <div style={{maxWidth:"72%"}}>
                      <div style={m.role==="user"?S.userBubble:{...S.aiBubble, lineHeight:1.7}}>
                        {m.role==="user"
                          ? m.content.split("\n").map((l,j,a)=><React.Fragment key={j}>{l}{j<a.length-1&&<br/>}</React.Fragment>)
                          : <ReactMarkdown
                              components={{
                                p:  ({children})=><p style={{margin:"2px 0"}}>{children}</p>,
                                ul: ({children})=><ul style={{margin:"4px 0",paddingLeft:18}}>{children}</ul>,
                                ol: ({children})=><ol style={{margin:"4px 0",paddingLeft:18}}>{children}</ol>,
                                li: ({children})=><li style={{margin:"2px 0"}}>{children}</li>,
                                strong: ({children})=><strong style={{fontWeight:700}}>{children}</strong>,
                                h1: ({children})=><div style={{fontWeight:700,fontSize:14,margin:"6px 0 2px"}}>{children}</div>,
                                h2: ({children})=><div style={{fontWeight:700,fontSize:13,margin:"6px 0 2px"}}>{children}</div>,
                                h3: ({children})=><div style={{fontWeight:600,fontSize:12,margin:"4px 0 2px"}}>{children}</div>,
                                code: ({children})=><code style={{background:"#f1f5f9",padding:"1px 4px",borderRadius:3,fontSize:11,fontFamily:"monospace"}}>{children}</code>,
                                hr: ()=><hr style={{border:"none",borderTop:"1px solid #e2e8f0",margin:"6px 0"}}/>,
                              }}
                            >{m.content}</ReactMarkdown>
                        }
                      </div>
                      <div style={{display:"flex",gap:6,marginTop:3,justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"center"}}>
                        <span style={{fontSize:10,color:"#9ca3af"}}>{m.timestamp}</span>
                        {m.source&&m.role==="assistant"&&(
                          <span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:3,
                            background:m.source==="llm"?"#dbeafe":m.source==="rag"?"#ede9fe":"#fee2e2",
                            color:m.source==="llm"?"#1d4ed8":m.source==="rag"?"#5b21b6":"#991b1b"}}>
                            {m.source==="llm"?"LLM":m.source==="rag"?"LOCAL":"ERR"}
                          </span>
                        )}
                      </div>
                      {m.suggestedTab&&m.role==="assistant"&&i===lastSuggestedIdx&&(
                        <TabCarousel
                          initialTab={m.suggestedTab}
                          kpi={kpi}
                          thresholds={thresholds}
                          historyList={historyList}
                          dbKpiData={dbKpiData}
                          dbEqpData={dbEqpData}
                          dbLotData={dbLotData}
                          dbRcpData={dbRcpData}
                          dbScenarioData={dbScenarioData}
                          onNavigate={t=>setActiveTab(t as Tab)}
                          highlightedDate={m.highlightedDate}
                        />
                      )}
                    </div>
                  </div>
                  );
                })}
                {typing&&(
                  <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
                    <div style={{width:30,height:30,borderRadius:8,background:"#0f172a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,fontFamily:"Pretendard, sans-serif"}}>AI</div>
                    <div style={S.aiBubble}><div style={{display:"flex",gap:4}}>{[0,0.2,0.4].map((d,i)=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#94a3b8",animation:`bounce ${d}s infinite`}}/>)}</div></div>
                  </div>
                )}
                <div ref={chatEnd}/>
              </div>

              {/* 빠른 질문 */}
              {!pdfSelectMode&&(
                <div style={{padding:"0 28px 10px",display:"flex",gap:7,flexWrap:"wrap" as const}}>
                  {[
                    "지금 OEE·THP 정상이야?",
                    "이번 달 KPI 추이 어때?",
                    "최근 알람 원인 뭐야?",
                    "장비 상태 이상 있어?",
                    "지금 임계값 기준 맞아?",
                    "가장 문제 많은 장비 어디야?",
                    "THP 저하 원인 알려줘",
                  ].map((s,i)=>(
                    <button key={i} style={S.chip} onClick={()=>setInput(s)}>{s}</button>
                  ))}
                </div>
              )}
              <div style={{padding:"12px 28px 18px",display:"flex",gap:10,borderTop:"1px solid #e5e7eb",background:"#fff"}}>
                <input style={S.chatInput} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!typing&&handleSend()} placeholder="KPI 데이터 기반 분석 질문... (Enter)"/>
                {!pdfSelectMode&&(
                  <button
                    onClick={()=>{
                      if(msgs.length===0) return;
                      const firstAssistantIdx = msgs.findIndex(m=>m.role==="assistant");
                      const answerIndices = new Set(
                        msgs.map((m,i)=>({m,i}))
                          .filter(({m,i})=>m.role==="assistant" && i!==firstAssistantIdx && !m.noSelect)
                          .map(({i})=>i)
                      );
                      setPdfSelected(answerIndices);
                      setPdfSelectMode(true);
                    }}
                    disabled={msgs.length===0}
                    style={{padding:"8px 14px",borderRadius:8,border:"1px solid #d1d5db",background:"#f8fafc",color:"#374151",fontSize:13,fontWeight:600,cursor:msgs.length===0?"default":"pointer",whiteSpace:"nowrap" as const,flexShrink:0}}
                  >대화 저장</button>
                )}
                <button style={{...S.sendBtn,opacity:typing?0.5:1}} onClick={handleSend} disabled={typing}>{typing?"분석 중...":"전송"}</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ DATABASE ═══ */}
        {activeTab==="database"&&(
          <div style={S.content}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,padding:"12px 16px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8}}>
              <span style={{fontSize:11,fontWeight:700,color:"#166534",letterSpacing:0.5}}>Amazon RDS (PostgreSQL)</span>
              <span style={{fontSize:13,color:"#166534"}}>5개 테이블 원본 데이터 · 읽기 전용</span>
            </div>
            {/* 테이블 탭 */}
            <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap" as const}}>
              {([
                {id:"kpi_daily"    as DbTable,label:"KPI_DAILY",    rows: dbKpiData.length>0      ? dbKpiData.length.toLocaleString()      : "144"},
                {id:"scenario_map" as DbTable,label:"SCENARIO_MAP", rows: dbScenarioData.length>0 ? dbScenarioData.length.toLocaleString() : "12"},
                {id:"rcp_state"    as DbTable,label:"RCP_STATE",    rows: dbRcpData.length>0      ? dbRcpData.length.toLocaleString()      : "24"},
                {id:"eqp_state"    as DbTable,label:"EQP_STATE",    rows: dbEqpTotal>0            ? dbEqpTotal.toLocaleString()            : "3,042"},
                {id:"lot_state"    as DbTable,label:"LOT_STATE",    rows: dbLotTotal>0            ? dbLotTotal.toLocaleString()            : "5,771"},
              ]).map(t=>(
                <button key={t.id} style={{...S.filterBtn,...(dbTable===t.id?S.filterBtnOn:{})}} onClick={()=>{setDbTable(t.id);setDbFilterDate("all");setDbFilterEqp("all");setDbPage(1);}}>
                  {t.label}
                  <span style={{fontSize:10,padding:"1px 5px",borderRadius:8,background:dbTable===t.id?"rgba(255,255,255,0.2)":"#e5e7eb",color:dbTable===t.id?"#fff":"#6b7280",marginLeft:5}}>{t.rows}</span>
                </button>
              ))}
            </div>

            {/* 로딩 / 에러 상태 */}
            {dbLoading && (
              <div style={{textAlign:"center" as const,padding:"32px",color:"#6b7280",fontSize:13}}>
                데이터 불러오는 중...
              </div>
            )}
            {!dbLoading && dbError && (
              <div style={{padding:"14px 18px",marginBottom:16,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,color:"#dc2626",fontSize:13}}>
                <strong>연결 오류:</strong> {dbError}
                <div style={{marginTop:6,fontSize:11,color:"#9ca3af"}}>
                  로컬 개발 시: <code>kubectl port-forward svc/kpi-backend 8000:8000 -n team-4</code> 실행 후 새로고침
                </div>
              </div>
            )}

            {/* 날짜 · EQP 필터 바 */}
            {!dbLoading && !dbError && (
            <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center",flexWrap:"wrap" as const,padding:"10px 14px",background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:8}}>
              {dbTable!=="rcp_state"&&(
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:12,color:"#6b7280",fontWeight:600}}>날짜</span>
                  <select value={dbFilterDate}
                    onChange={e=>{setDbFilterDate(e.target.value); if(isPaged) setDbPage(1);}}
                    style={{fontSize:12,padding:"4px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontFamily:"Pretendard, sans-serif",background:"#fff",color:"#374151",outline:"none"}}>
                    <option value="all">전체</option>
                    {filterDates.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:12,color:"#6b7280",fontWeight:600}}>EQP</span>
                <select value={dbFilterEqp}
                  onChange={e=>{setDbFilterEqp(e.target.value); if(isPaged) setDbPage(1);}}
                  style={{fontSize:12,padding:"4px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontFamily:"Pretendard, sans-serif",background:"#fff",color:"#374151",outline:"none"}}>
                  <option value="all">전체</option>
                  {filterEqps.map(e=><option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:11,color:"#9ca3af"}}>
                  {filteredDbData.length}행 표시 / 전체 {dbTotalCount}행
                </span>
                {isPaged&&(
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <button disabled={dbPage<=1} onClick={()=>setDbPage(p=>p-1)}
                      style={{fontSize:11,padding:"3px 10px",borderRadius:5,border:"1px solid #e5e7eb",background:dbPage<=1?"#f3f4f6":"#fff",cursor:dbPage<=1?"default":"pointer",color:dbPage<=1?"#9ca3af":"#374151"}}>
                      이전
                    </button>
                    <span style={{fontSize:12,color:"#374151",minWidth:70,textAlign:"center" as const,fontWeight:600}}>
                      {dbPage} / {dbTotalPages} 페이지
                    </span>
                    <button disabled={dbPage>=dbTotalPages} onClick={()=>setDbPage(p=>p+1)}
                      style={{fontSize:11,padding:"3px 10px",borderRadius:5,border:"1px solid #e5e7eb",background:dbPage>=dbTotalPages?"#f3f4f6":"#fff",cursor:dbPage>=dbTotalPages?"default":"pointer",color:dbPage>=dbTotalPages?"#9ca3af":"#374151"}}>
                      다음
                    </button>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* KPI_DAILY */}
            {dbTable==="kpi_daily"&&(
              <div style={S.tableWrap}>
                <div style={S.tableHeader}>
                  <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>KPI_DAILY — alarm_flag = 1</span>
                  <span style={{fontSize:11,color:"#9ca3af"}}>총 {filteredDbData.filter((r:any)=>r.alarm_flag===1).length} rows</span>
                </div>
                <div style={{overflowX:"auto" as const}}>
                  <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12,fontFamily:"Pretendard, sans-serif"}}>
                    <thead>
                      <tr style={{background:"#f3f4f6",borderBottom:"2px solid #e5e7eb"}}>
                        {["date","eqp_id","line","oper","oee_t","oee_v","thp_t","thp_v","good_out","tat_t","tat_v","wip_t","wip_v","alarm"].map(h=>(
                          <th key={h} style={{padding:"8px 12px",textAlign:"left" as const,fontSize:10,fontWeight:700,color:"#6b7280",letterSpacing:0.4,whiteSpace:"nowrap" as const}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDbData.filter((r:any)=>r.alarm_flag===1).map((row,i)=>(
                        <tr key={i} style={{borderBottom:"1px solid #f3f4f6",background:row.alarm_flag===1?"#fefce8":"#fff"}}>
                          <td style={{padding:"8px 12px",color:"#374151",whiteSpace:"nowrap" as const}}>{row.date}</td>
                          <td style={{padding:"8px 12px",fontWeight:700}}>{row.eqp_id}</td>
                          <td style={{padding:"8px 12px",color:"#6b7280"}}>{row.line_id}</td>
                          <td style={{padding:"8px 12px",color:"#6b7280"}}>{row.oper_id}</td>
                          <td style={{padding:"8px 12px",color:"#9ca3af"}}>{row.oee_t}</td>
                          <td style={{padding:"8px 12px",fontWeight:600,color:row.oee_v<row.oee_t?"#dc2626":"#374151"}}>{row.oee_v}</td>
                          <td style={{padding:"8px 12px",color:"#9ca3af"}}>{row.thp_t}</td>
                          <td style={{padding:"8px 12px",fontWeight:600,color:row.thp_v<row.thp_t?"#dc2626":"#374151"}}>{row.thp_v}</td>
                          <td style={{padding:"8px 12px",color:"#374151"}}>{row.good_out_qty}</td>
                          <td style={{padding:"8px 12px",color:"#9ca3af"}}>{row.tat_t}</td>
                          <td style={{padding:"8px 12px",fontWeight:600,color:row.tat_v>row.tat_t?"#dc2626":"#374151"}}>{row.tat_v}</td>
                          <td style={{padding:"8px 12px",color:"#9ca3af"}}>{row.wip_t}</td>
                          <td style={{padding:"8px 12px",color:"#374151"}}>{row.wip_v}</td>
                          <td style={{padding:"8px 12px"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,background:row.alarm_flag===1?"#fee2e2":"#dcfce7",color:row.alarm_flag===1?"#991b1b":"#166534"}}>{row.alarm_flag===1?"ALARM":"OK"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SCENARIO_MAP */}
            {dbTable==="scenario_map"&&(
              <div style={S.tableWrap}>
                <div style={S.tableHeader}>
                  <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>SCENARIO_MAP — 알람 발생 이력</span>
                  <span style={{fontSize:11,color:"#9ca3af"}}>총 12 rows</span>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:13}}>
                  <thead><tr style={{background:"#f3f4f6",borderBottom:"2px solid #e5e7eb"}}>
                    {["date","alarm_eqp_id","alarm_kpi"].map(h=><th key={h} style={{padding:"10px 16px",textAlign:"left" as const,fontSize:10,fontWeight:700,color:"#6b7280",letterSpacing:0.5}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filteredDbData.map((row,i)=>{
                      const meta=KPI_META[row.alarm_kpi];
                      return(
                        <tr key={i} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                          <td style={{padding:"10px 16px",fontFamily:"Pretendard, sans-serif",color:"#374151"}}>{row.date}</td>
                          <td style={{padding:"10px 16px",fontWeight:700,fontFamily:"Pretendard, sans-serif"}}>{row.alarm_eqp_id}</td>
                          <td style={{padding:"10px 16px"}}><span style={{...S.badge,background:meta.bg,color:meta.textColor}}>{row.alarm_kpi}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* RCP_STATE */}
            {dbTable==="rcp_state"&&(
              <div style={S.tableWrap}>
                <div style={S.tableHeader}>
                  <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>RCP_STATE — 레시피 복잡도</span>
                  <span style={{fontSize:11,color:"#9ca3af"}}>총 24 rows · EQP당 2개 레시피</span>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:13}}>
                  <thead><tr style={{background:"#f3f4f6",borderBottom:"2px solid #e5e7eb"}}>
                    {["rcp_id","eqp_id","complex_level"].map(h=><th key={h} style={{padding:"10px 16px",textAlign:"left" as const,fontSize:10,fontWeight:700,color:"#6b7280",letterSpacing:0.5}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filteredDbData.map((row,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                        <td style={{padding:"10px 16px",fontFamily:"Pretendard, sans-serif",color:"#374151"}}>{row.rcp_id}</td>
                        <td style={{padding:"10px 16px",fontWeight:700,fontFamily:"Pretendard, sans-serif"}}>{row.eqp_id}</td>
                        <td style={{padding:"10px 16px"}}>
                          <span style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:5,fontFamily:"Pretendard, sans-serif",
                            background:row.complex_level>=9?"#fee2e2":row.complex_level>=7?"#fef3c7":"#f0fdf4",
                            color:row.complex_level>=9?"#991b1b":row.complex_level>=7?"#92400e":"#166534"}}>
                            Lv.{row.complex_level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* EQP_STATE */}
            {dbTable==="eqp_state"&&(
              <div style={S.tableWrap}>
                <div style={S.tableHeader}>
                  <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>EQP_STATE — 장비 상태 이벤트</span>
                  <span style={{fontSize:11,color:"#9ca3af"}}>총 {dbEqpTotal>0?dbEqpTotal.toLocaleString():"3,042"} rows</span>
                </div>
                <div style={{overflowX:"auto" as const}}>
                  <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12,fontFamily:"Pretendard, sans-serif"}}>
                    <thead><tr style={{background:"#f3f4f6",borderBottom:"2px solid #e5e7eb"}}>
                      {["event_time","end_time","eqp_id","line","oper","lot_id","rcp_id","state"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left" as const,fontSize:10,fontWeight:700,color:"#6b7280",whiteSpace:"nowrap" as const}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {pagedDbData.map((row,i)=>(
                        <tr key={i} style={{borderBottom:"1px solid #f3f4f6",background:row.eqp_state==="DOWN"?"#fef2f2":i%2===0?"#fff":"#fafafa"}}>
                          <td style={{padding:"8px 12px",whiteSpace:"nowrap" as const,color:"#374151"}}>{row.event_time}</td>
                          <td style={{padding:"8px 12px",whiteSpace:"nowrap" as const,color:"#6b7280"}}>{row.end_time}</td>
                          <td style={{padding:"8px 12px",fontWeight:700}}>{row.eqp_id}</td>
                          <td style={{padding:"8px 12px",color:"#6b7280"}}>{row.line_id}</td>
                          <td style={{padding:"8px 12px",color:"#6b7280"}}>{row.oper_id}</td>
                          <td style={{padding:"8px 12px",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const,color:"#374151"}}>{row.lot_id}</td>
                          <td style={{padding:"8px 12px",color:"#374151"}}>{row.rcp_id}</td>
                          <td style={{padding:"8px 12px"}}><span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:4,background:row.eqp_state==="DOWN"?"#fee2e2":row.eqp_state==="RUN"?"#dcfce7":"#f1f5f9",color:row.eqp_state==="DOWN"?"#991b1b":row.eqp_state==="RUN"?"#166534":"#475569"}}>{row.eqp_state}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* LOT_STATE */}
            {dbTable==="lot_state"&&(
              <div style={S.tableWrap}>
                <div style={S.tableHeader}>
                  <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>LOT_STATE — LOT 처리 이력</span>
                  <span style={{fontSize:11,color:"#9ca3af"}}>총 {dbLotTotal>0?dbLotTotal.toLocaleString():"5,771"} rows</span>
                </div>
                <div style={{overflowX:"auto" as const}}>
                  <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12,fontFamily:"Pretendard, sans-serif"}}>
                    <thead><tr style={{background:"#f3f4f6",borderBottom:"2px solid #e5e7eb"}}>
                      {["event_time","lot_id","line","oper","eqp_id","rcp_id","lot_state","in_cnt","hold","scrap"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left" as const,fontSize:10,fontWeight:700,color:"#6b7280",whiteSpace:"nowrap" as const}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {pagedDbData.map((row,i)=>(
                        <tr key={i} style={{borderBottom:"1px solid #f3f4f6",background:row.lot_state==="HOLD"?"#fef2f2":i%2===0?"#fff":"#fafafa"}}>
                          <td style={{padding:"8px 12px",whiteSpace:"nowrap" as const,color:"#374151"}}>{row.event_time}</td>
                          <td style={{padding:"8px 12px",maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const,color:"#374151"}}>{row.lot_id}</td>
                          <td style={{padding:"8px 12px",color:"#6b7280"}}>{row.line_id}</td>
                          <td style={{padding:"8px 12px",color:"#6b7280"}}>{row.oper_id}</td>
                          <td style={{padding:"8px 12px",fontWeight:700}}>{row.eqp_id}</td>
                          <td style={{padding:"8px 12px",color:"#374151"}}>{row.rcp_id}</td>
                          <td style={{padding:"8px 12px"}}><span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:4,background:row.lot_state==="HOLD"?"#fee2e2":row.lot_state==="RUN"?"#dcfce7":row.lot_state==="END"?"#dbeafe":"#f1f5f9",color:row.lot_state==="HOLD"?"#991b1b":row.lot_state==="RUN"?"#166534":row.lot_state==="END"?"#1d4ed8":"#475569"}}>{row.lot_state}</span></td>
                          <td style={{padding:"8px 12px",color:"#374151"}}>{row.in_cnt}</td>
                          <td style={{padding:"8px 12px",color:row.hold_cnt>0?"#dc2626":"#374151",fontWeight:row.hold_cnt>0?700:400}}>{row.hold_cnt}</td>
                          <td style={{padding:"8px 12px",color:"#374151"}}>{row.scrap_cnt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        {/* PDF 미리보기 모달 */}
{showPdfModal&&(
  <div onClick={()=>setShowPdfModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,padding:28,width:560,maxHeight:"80vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
        <h3 style={{margin:0,fontSize:16,fontWeight:700}}>📄 PDF 보고서 미리보기</h3>
        <button onClick={()=>setShowPdfModal(false)} style={{border:"none",background:"none",fontSize:18,cursor:"pointer"}}>✕</button>
      </div>
      <pre style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:16,fontSize:11,fontFamily:"Pretendard, sans-serif",whiteSpace:"pre-wrap",lineHeight:1.8,marginBottom:16}}>
{`════════════════════════════════
  KPI 이상 분석 보고서
════════════════════════════════
장비: EQP12 | KPI: THP | 날짜: 2026-01-31
목표: 250 | 실적: 227 | 차이: -23
────────────────────────────────
■ 근본 원인
${LATEST_ALARM.causes.map((c,i)=>`${i+1}. ${c}`).join("\n")}

■ 해결 시나리오
${LATEST_ALARM.scenarios.map((s,i)=>`${i+1}. ${s}`).join("\n")}
════════════════════════════════`}
      </pre>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={()=>setShowPdfModal(false)} style={{padding:"9px 18px",borderRadius:8,border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer"}}>닫기</button>
        <button
          onClick={()=>{setShowPdfModal(false);setShowRagModal(true);}}
          disabled={latestSaved}
          style={{padding:"9px 20px",borderRadius:8,border:"none",background:latestSaved?"#9ca3af":"#22c55e",color:"#fff",fontWeight:700,cursor:latestSaved?"not-allowed":"pointer"}}
        >{latestSaved?"이미 저장됨":"RAG 저장"}</button>
      </div>
    </div>
  </div>
)}

{/* RAG 확인 모달 */}
{showRagModal&&(
  <div onClick={()=>setShowRagModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:32,width:420,textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:12}}>🗄️</div>
      <h3 style={{margin:"0 0 10px",fontSize:18,fontWeight:700}}>RAG DB에 저장할까요?</h3>
      <p style={{fontSize:13,color:"#6b7280",marginBottom:20,lineHeight:1.6}}>ChromaDB에 저장하면 AI Assistant가<br/>향후 유사 알람 분석 시 참고합니다.</p>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setShowRagModal(false)} style={{flex:1,padding:"11px",borderRadius:8,border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer"}}>취소</button>
        <button
          onClick={async ()=>{
            setShowRagModal(false);
            const filename = "report_20260131_EQP12_THP.pdf";
            const content = `KPI 이상 분석 보고서
장비: EQP12 | KPI: THP | 날짜: 2026-01-31
목표: 250 | 실적: 227 | 차이: -23

■ 근본 원인
${LATEST_ALARM.causes.map((c,i)=>`${i+1}. ${c}`).join("\n")}

■ 해결 시나리오
${LATEST_ALARM.scenarios.map((s,i)=>`${i+1}. ${s}`).join("\n")}`;
            try {
  await saveReportToPdf(filename, content, {"장비":"EQP12","KPI":"THP","날짜":"2026-01-31"});
} catch(e) {
  console.log("PDF 저장 실패 (백엔드 미연결)", e);
}
            if(!latestSaved){
              setHistoryList(p=>[...p,{...REPORTS[0],id:12,filename,date:"2026-01-31",time:"09:10",eqp_id:"EQP12",line_id:"LINE2",oper_id:"OPER4",alarm_kpi:"THP",target_raw:"250",actual_raw:"227",diff_raw:"-23",target_num:250,actual_num:227,causes:LATEST_ALARM.causes,scenarios:LATEST_ALARM.scenarios,results:["THP 목표 250 달성 목표"],pdf_raw:{basic_info:"날짜: 2026-01-31 | EQP12 | LINE2",problem:"THP 목표 250 → 실적 227",root_cause:LATEST_ALARM.causes.join("\n"),scenario:LATEST_ALARM.scenarios.join("\n"),result:"THP 정상화 목표"}}]);
              setLatestSaved(true);
              setLatestAlarmCount(0);
            }
            fetchReportList().then(setPdfFiles);
            setShowSavedToast(true);
            setTimeout(()=>setShowSavedToast(false),2500);
          }}
          style={{flex:1,padding:"11px",borderRadius:8,border:"none",background:"#2563eb",color:"#fff",fontWeight:700,cursor:"pointer"}}
        >저장</button>
      </div>
    </div>
  </div>
)}

{/* 저장 완료 토스트 */}
{showSavedToast&&(
  <div style={{position:"fixed",bottom:28,right:28,background:"#0f172a",color:"#fff",padding:"14px 20px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:999,display:"flex",gap:8,alignItems:"center",boxShadow:"0 8px 24px rgba(0,0,0,0.3)"}}>
    RAG 저장 완료! 과거이력에 추가되었습니다.
  </div>
)}
{activeTab==="analytics"&&<AnalyticsPage reports={historyList}/>}
        {activeTab==="settings"&&<SettingsPage thresholds={thresholds} setThresholds={setThresholds}/>}
      </main>

      {selReport&&<ReportPanel report={selReport} onClose={()=>setSelReport(null)} startRaw={selReportRaw}/>}

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Pretendard',sans-serif;background:#f8f9fa}
        button{cursor:pointer;font-family:'Pretendard',sans-serif}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
      `}</style>
    </div>
  );
}

// ────────────────────────── 스타일 객체 ──────────────────────────
const S: Record<string,React.CSSProperties> = {
  root:       {display:"flex",minHeight:"100vh",background:"#f8f9fa"},
  sidebar:    {width:230,background:"#0f172a",display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:100,padding:"24px 0"},
  logo:       {display:"flex",alignItems:"center",gap:12,padding:"0 18px 24px",borderBottom:"1px solid #1e293b"},
  logoMark:   {width:36,height:36,background:"#2563eb",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"Pretendard, sans-serif",fontWeight:700,fontSize:11},
  nav:        {padding:"16px 10px",flex:1,display:"flex",flexDirection:"column",gap:2},
  navItem:    {display:"flex",alignItems:"flex-start",gap:10,width:"100%",padding:"10px 12px",borderRadius:7,border:"none",background:"transparent"},
  navActive:  {background:"#1e293b"},
  sideStats:  {margin:"0 10px 16px",background:"#1e293b",borderRadius:8,padding:"12px 14px"},
  main:       {marginLeft:230,flex:1,display:"flex",flexDirection:"column",minHeight:"100vh"},
  header:     {background:"#fff",borderBottom:"1px solid #e5e7eb",padding:"16px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:90},
  pageTitle:  {fontSize:18,fontWeight:600,color:"#0f172a"},
  pageSub:    {fontSize:12,color:"#94a3b8",marginTop:2},
  dateChip:   {fontSize:11,color:"#64748b",background:"#f1f5f9",padding:"5px 12px",borderRadius:20,fontFamily:"Pretendard, sans-serif"},
  alarmChip:  {fontSize:11,color:"#991b1b",background:"#fee2e2",padding:"4px 10px",borderRadius:20,fontWeight:600},
  content:    {padding:"24px 32px",flex:1},
  rtGrid:     {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:16},
  rtCard:     {background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"16px 18px"},
  chartCard:  {background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"18px 24px"},
  card:       {background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"20px 24px",marginBottom:12},
  badge:      {fontSize:11,fontWeight:600,padding:"3px 8px",borderRadius:4,fontFamily:"Pretendard, sans-serif"},
  subTabBar:  {display:"flex",gap:4,marginBottom:20,padding:"4px",background:"#f3f4f6",borderRadius:10,width:"fit-content"},
  subTab:     {fontSize:13,fontWeight:500,padding:"8px 18px",borderRadius:8,border:"none",background:"transparent",color:"#6b7280"},
  subTabOn:   {background:"#fff",color:"#0f172a",fontWeight:600,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"},
  alarmGrid:  {display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14},
  filterBtn:  {fontSize:12,fontWeight:500,padding:"7px 14px",borderRadius:7,border:"1px solid #e5e7eb",background:"#fff",color:"#374151"},
  filterBtnOn:{background:"#0f172a",color:"#fff",border:"1px solid #0f172a"},
  tableWrap:  {background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,overflow:"hidden"},
  tableHeader:{padding:"12px 16px",borderBottom:"1px solid #e5e7eb",background:"#f9fafb",display:"flex",justifyContent:"space-between",alignItems:"center"},
  ragPanel:   {width:210,background:"#f9fafb",borderRight:"1px solid #e5e7eb",padding:"20px 14px",display:"flex",flexDirection:"column",overflowY:"auto"},
  ragItem:    {display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:7,cursor:"pointer",background:"#fff",border:"1px solid #f3f4f6",marginBottom:2},
  userBubble: {background:"#0f172a",color:"#fff",padding:"10px 14px",borderRadius:"12px 12px 4px 12px",fontSize:13,lineHeight:1.6},
  aiBubble:   {background:"#fff",border:"1px solid #e5e7eb",color:"#374151",padding:"10px 14px",borderRadius:"12px 12px 12px 4px",fontSize:13,lineHeight:1.6},
  chatInput:  {flex:1,padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,outline:"none",fontFamily:"'Pretendard',sans-serif"},
  sendBtn:    {padding:"10px 20px",background:"#0f172a",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"},
  chip:       {fontSize:11.5,color:"#374151",background:"#f1f5f9",border:"1px solid #e5e7eb",borderRadius:20,padding:"5px 12px",cursor:"pointer"},
  overlay:    {position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(2px)",zIndex:200,display:"flex",justifyContent:"flex-end"},
  panel:      {width:520,background:"#fff",height:"100%",overflowY:"auto",padding:"24px 28px",boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"},
  panelClose: {fontSize:12,color:"#6b7280",background:"#f3f4f6",border:"1px solid #e5e7eb",borderRadius:6,padding:"5px 12px",cursor:"pointer",flexShrink:0},
};
