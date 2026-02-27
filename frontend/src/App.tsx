// ================================================================
// App.tsx — KPI Monitoring Agent (Full Integration)
// 변경사항:
//   1. Alarm Center → 최신알람(2026-01-31) / 과거이력(PDF 11건) 탭 분리
//   2. Database 탭 → 5개 CSV 원본 테이블 뷰어
//   3. AI Assistant → Anthropic API 실제 LLM 호출
//   4. PDF 원본 내용 전문 표시
// ================================================================
import React, { useState, useEffect, useRef, useCallback } from "react";

// ────────────────────────── 타입 ──────────────────────────
interface Report {
  id: number; filename: string; date: string; time: string;
  eqp_id: string; line_id: string; oper_id: string; alarm_kpi: string;
  target_raw: string; actual_raw: string; diff_raw: string;
  target_num: number; actual_num: number;
  causes: string[]; scenarios: string[]; results: string[];
  pdf_raw: { basic_info: string; problem: string; root_cause: string; scenario: string; result: string; };
}
interface ChatMessage { role: "user"|"assistant"; content: string; timestamp: string; source?: "llm"|"rag"|"error"; }
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

// ────────────────────────── DB 원본 데이터 샘플 ──────────────────────────
const DB_KPI_DAILY = [
  {date:"2026-01-20",eqp_id:"EQP01",line_id:"LINE1",oper_id:"OPER1",oee_t:70,oee_v:53.51,thp_t:175,thp_v:175,good_out_qty:175,tat_t:3.5,tat_v:3.02,wip_t:250,wip_v:250,alarm_flag:1},
  {date:"2026-01-21",eqp_id:"EQP02",line_id:"LINE1",oper_id:"OPER1",oee_t:70,oee_v:76.44,thp_t:250,thp_v:228,good_out_qty:228,tat_t:3.5,tat_v:2.27,wip_t:250,wip_v:250,alarm_flag:1},
  {date:"2026-01-22",eqp_id:"EQP03",line_id:"LINE1",oper_id:"OPER1",oee_t:70,oee_v:76.44,thp_t:250,thp_v:240,good_out_qty:240,tat_t:3.5,tat_v:4.10,wip_t:250,wip_v:250,alarm_flag:1},
  {date:"2026-01-23",eqp_id:"EQP04",line_id:"LINE1",oper_id:"OPER2",oee_t:70,oee_v:76.44,thp_t:250,thp_v:250,good_out_qty:250,tat_t:3.5,tat_v:2.17,wip_t:250,wip_v:670,alarm_flag:1},
  {date:"2026-01-24",eqp_id:"EQP05",line_id:"LINE1",oper_id:"OPER2",oee_t:70,oee_v:76.44,thp_t:250,thp_v:250,good_out_qty:250,tat_t:3.5,tat_v:2.17,wip_t:250,wip_v:218,alarm_flag:1},
  {date:"2026-01-25",eqp_id:"EQP06",line_id:"LINE1",oper_id:"OPER2",oee_t:70,oee_v:56.48,thp_t:250,thp_v:250,good_out_qty:250,tat_t:3.5,tat_v:2.17,wip_t:250,wip_v:250,alarm_flag:1},
  {date:"2026-01-26",eqp_id:"EQP07",line_id:"LINE2",oper_id:"OPER3",oee_t:70,oee_v:76.44,thp_t:250,thp_v:232,good_out_qty:232,tat_t:3.5,tat_v:2.17,wip_t:250,wip_v:250,alarm_flag:1},
  {date:"2026-01-27",eqp_id:"EQP08",line_id:"LINE2",oper_id:"OPER3",oee_t:70,oee_v:76.44,thp_t:250,thp_v:250,good_out_qty:250,tat_t:3.5,tat_v:4.25,wip_t:250,wip_v:250,alarm_flag:1},
  {date:"2026-01-28",eqp_id:"EQP09",line_id:"LINE2",oper_id:"OPER3",oee_t:70,oee_v:76.44,thp_t:250,thp_v:250,good_out_qty:250,tat_t:3.5,tat_v:2.17,wip_t:250,wip_v:730,alarm_flag:1},
  {date:"2026-01-29",eqp_id:"EQP10",line_id:"LINE2",oper_id:"OPER4",oee_t:70,oee_v:76.44,thp_t:250,thp_v:250,good_out_qty:250,tat_t:3.5,tat_v:2.17,wip_t:250,wip_v:295,alarm_flag:1},
  {date:"2026-01-30",eqp_id:"EQP11",line_id:"LINE2",oper_id:"OPER4",oee_t:70,oee_v:50.56,thp_t:250,thp_v:175,good_out_qty:175,tat_t:3.5,tat_v:3.02,wip_t:250,wip_v:250,alarm_flag:1},
  {date:"2026-01-31",eqp_id:"EQP12",line_id:"LINE2",oper_id:"OPER4",oee_t:70,oee_v:76.44,thp_t:250,thp_v:227,good_out_qty:227,tat_t:3.5,tat_v:2.27,wip_t:250,wip_v:250,alarm_flag:1},
];
const DB_SCENARIO_MAP = [
  {date:"2026-01-20",alarm_eqp_id:"EQP01",alarm_kpi:"OEE"},
  {date:"2026-01-21",alarm_eqp_id:"EQP02",alarm_kpi:"THP"},
  {date:"2026-01-22",alarm_eqp_id:"EQP03",alarm_kpi:"TAT"},
  {date:"2026-01-23",alarm_eqp_id:"EQP04",alarm_kpi:"WIP_EXCEED"},
  {date:"2026-01-24",alarm_eqp_id:"EQP05",alarm_kpi:"WIP_SHORTAGE"},
  {date:"2026-01-25",alarm_eqp_id:"EQP06",alarm_kpi:"OEE"},
  {date:"2026-01-26",alarm_eqp_id:"EQP07",alarm_kpi:"THP"},
  {date:"2026-01-27",alarm_eqp_id:"EQP08",alarm_kpi:"TAT"},
  {date:"2026-01-28",alarm_eqp_id:"EQP09",alarm_kpi:"WIP_EXCEED"},
  {date:"2026-01-29",alarm_eqp_id:"EQP10",alarm_kpi:"WIP_SHORTAGE"},
  {date:"2026-01-30",alarm_eqp_id:"EQP11",alarm_kpi:"OEE"},
  {date:"2026-01-31",alarm_eqp_id:"EQP12",alarm_kpi:"THP"},
];
const DB_RCP_STATE = [
  {rcp_id:"RCP01",eqp_id:"EQP01",complex_level:9},{rcp_id:"RCP02",eqp_id:"EQP01",complex_level:4},
  {rcp_id:"RCP03",eqp_id:"EQP02",complex_level:3},{rcp_id:"RCP04",eqp_id:"EQP02",complex_level:8},
  {rcp_id:"RCP05",eqp_id:"EQP03",complex_level:5},{rcp_id:"RCP06",eqp_id:"EQP03",complex_level:6},
  {rcp_id:"RCP07",eqp_id:"EQP04",complex_level:3},{rcp_id:"RCP08",eqp_id:"EQP04",complex_level:5},
  {rcp_id:"RCP09",eqp_id:"EQP05",complex_level:8},{rcp_id:"RCP10",eqp_id:"EQP05",complex_level:5},
  {rcp_id:"RCP11",eqp_id:"EQP06",complex_level:9},{rcp_id:"RCP12",eqp_id:"EQP06",complex_level:9},
  {rcp_id:"RCP13",eqp_id:"EQP07",complex_level:8},{rcp_id:"RCP14",eqp_id:"EQP07",complex_level:10},
  {rcp_id:"RCP15",eqp_id:"EQP08",complex_level:8},{rcp_id:"RCP16",eqp_id:"EQP08",complex_level:4},
  {rcp_id:"RCP17",eqp_id:"EQP09",complex_level:9},{rcp_id:"RCP18",eqp_id:"EQP09",complex_level:8},
  {rcp_id:"RCP19",eqp_id:"EQP10",complex_level:3},{rcp_id:"RCP20",eqp_id:"EQP10",complex_level:5},
  {rcp_id:"RCP21",eqp_id:"EQP11",complex_level:4},{rcp_id:"RCP22",eqp_id:"EQP11",complex_level:10},
  {rcp_id:"RCP23",eqp_id:"EQP12",complex_level:8},{rcp_id:"RCP24",eqp_id:"EQP12",complex_level:10},
];
const DB_EQP_STATE = [
  {event_time:"2026-01-31 00:00",end_time:"2026-01-31 00:30",eqp_id:"EQP12",line_id:"LINE2",oper_id:"OPER4",lot_id:"-",rcp_id:"-",eqp_state:"IDLE"},
  {event_time:"2026-01-31 00:30",end_time:"2026-01-31 01:25",eqp_id:"EQP12",line_id:"LINE2",oper_id:"OPER4",lot_id:"LOT_20260131_02864",rcp_id:"RCP23",eqp_state:"RUN"},
  {event_time:"2026-01-31 01:25",end_time:"2026-01-31 01:40",eqp_id:"EQP12",line_id:"LINE2",oper_id:"OPER4",lot_id:"LOT_20260131_02864",rcp_id:"RCP23",eqp_state:"DOWN"},
  {event_time:"2026-01-31 01:40",end_time:"2026-01-31 02:35",eqp_id:"EQP12",line_id:"LINE2",oper_id:"OPER4",lot_id:"LOT_20260131_02864",rcp_id:"RCP23",eqp_state:"RUN"},
  {event_time:"2026-01-31 02:35",end_time:"2026-01-31 02:40",eqp_id:"EQP12",line_id:"LINE2",oper_id:"OPER4",lot_id:"-",rcp_id:"-",eqp_state:"IDLE"},
  {event_time:"2026-01-31 02:40",end_time:"2026-01-31 03:35",eqp_id:"EQP12",line_id:"LINE2",oper_id:"OPER4",lot_id:"LOT_20260131_02865",rcp_id:"RCP24",eqp_state:"RUN"},
  {event_time:"2026-01-31 03:35",end_time:"2026-01-31 03:50",eqp_id:"EQP12",line_id:"LINE2",oper_id:"OPER4",lot_id:"LOT_20260131_02865",rcp_id:"RCP24",eqp_state:"DOWN"},
  {event_time:"2026-01-31 03:50",end_time:"2026-01-31 04:45",eqp_id:"EQP12",line_id:"LINE2",oper_id:"OPER4",lot_id:"LOT_20260131_02865",rcp_id:"RCP24",eqp_state:"RUN"},
  {event_time:"2026-01-31 05:45",end_time:"2026-01-31 06:00",eqp_id:"EQP12",line_id:"LINE2",oper_id:"OPER4",lot_id:"LOT_20260131_02866",rcp_id:"RCP23",eqp_state:"DOWN"},
  {event_time:"2026-01-31 07:55",end_time:"2026-01-31 08:10",eqp_id:"EQP12",line_id:"LINE2",oper_id:"OPER4",lot_id:"LOT_20260131_02867",rcp_id:"RCP24",eqp_state:"DOWN"},
];
const DB_LOT_STATE = [
  {event_time:"2026-01-31 00:10",lot_id:"LOT_20260131_02864",line_id:"LINE2",oper_id:"OPER4",eqp_id:"EQP12",rcp_id:"RCP23",lot_state:"WAIT",in_cnt:25,hold_cnt:0,scrap_cnt:0},
  {event_time:"2026-01-31 00:30",lot_id:"LOT_20260131_02864",line_id:"LINE2",oper_id:"OPER4",eqp_id:"EQP12",rcp_id:"RCP23",lot_state:"RUN",in_cnt:25,hold_cnt:0,scrap_cnt:0},
  {event_time:"2026-01-31 01:25",lot_id:"LOT_20260131_02864",line_id:"LINE2",oper_id:"OPER4",eqp_id:"EQP12",rcp_id:"RCP23",lot_state:"HOLD",in_cnt:25,hold_cnt:1,scrap_cnt:0},
  {event_time:"2026-01-31 01:40",lot_id:"LOT_20260131_02864",line_id:"LINE2",oper_id:"OPER4",eqp_id:"EQP12",rcp_id:"RCP23",lot_state:"RUN",in_cnt:25,hold_cnt:0,scrap_cnt:0},
  {event_time:"2026-01-31 02:35",lot_id:"LOT_20260131_02864",line_id:"LINE2",oper_id:"OPER4",eqp_id:"EQP12",rcp_id:"RCP23",lot_state:"END",in_cnt:25,hold_cnt:0,scrap_cnt:0},
  {event_time:"2026-01-31 02:40",lot_id:"LOT_20260131_02865",line_id:"LINE2",oper_id:"OPER4",eqp_id:"EQP12",rcp_id:"RCP24",lot_state:"RUN",in_cnt:25,hold_cnt:0,scrap_cnt:0},
  {event_time:"2026-01-31 03:35",lot_id:"LOT_20260131_02865",line_id:"LINE2",oper_id:"OPER4",eqp_id:"EQP12",rcp_id:"RCP24",lot_state:"HOLD",in_cnt:25,hold_cnt:1,scrap_cnt:0},
  {event_time:"2026-01-31 03:50",lot_id:"LOT_20260131_02865",line_id:"LINE2",oper_id:"OPER4",eqp_id:"EQP12",rcp_id:"RCP24",lot_state:"RUN",in_cnt:25,hold_cnt:0,scrap_cnt:0},
  {event_time:"2026-01-31 04:45",lot_id:"LOT_20260131_02865",line_id:"LINE2",oper_id:"OPER4",eqp_id:"EQP12",rcp_id:"RCP24",lot_state:"END",in_cnt:25,hold_cnt:0,scrap_cnt:0},
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

## 역할
- 생산 KPI 데이터를 분석하고 근본 원인을 추론하는 전문가
- 과거 알람 패턴을 기반으로 현재 문제를 진단
- 구체적인 수치와 함께 실용적인 조치 방안 제시
- 한국어로 명확하게 답변 (핵심 위주, 200자 이내 권장)

## 보유 데이터 (2026-01-20 ~ 2026-01-31)
총 12건 알람:
| 날짜 | 장비 | KPI | Target | Actual |
|------|------|-----|--------|--------|
| 2026-01-20 | EQP01 | OEE | 70% | 57.73% |
| 2026-01-21 | EQP02 | THP | 1000UPH | 729UPH |
| 2026-01-22 | EQP03 | TAT | 48h | 61.71h |
| 2026-01-23 | EQP04 | WIP_EXCEED | 500EA | 670EA |
| 2026-01-24 | EQP05 | WIP_SHORTAGE | 500EA | 218EA |
| 2026-01-25 | EQP06 | OEE | 70% | 56.48% |
| 2026-01-26 | EQP07 | THP | 1000UPH | 865UPH |
| 2026-01-27 | EQP08 | TAT | 48h | 62.26h |
| 2026-01-28 | EQP09 | WIP_EXCEED | 500EA | 730EA |
| 2026-01-29 | EQP10 | WIP_SHORTAGE | 500EA | 295EA |
| 2026-01-30 | EQP11 | OEE | 70% | 50.56% |
| 2026-01-31 | EQP12 | THP | 250 | 227 (신규) |

## 레시피 복잡도
EQP12: RCP23(8), RCP24(10) — 고복잡도
EQP11: RCP21(4), RCP22(10)
EQP01: RCP01(9), RCP02(4)

## EQP12 신규 알람 상세 (2026-01-31)
- DOWN 이벤트 4회: 01:25~01:40, 03:35~03:50, 05:45~06:00, 07:55~08:10
- 총 다운타임: 약 55분
- 영향 LOT: LOT_02864~02867 (RCP23/RCP24 교번 처리 중 발생)

## 주의사항
- 데이터에 없는 내용을 추측할 때는 명확히 "추정" 표시
- 수치 비교 시 _t(목표) vs _v(실적) 구분 명확히`;

// ────────────────────────── Anthropic API 호출 ──────────────────────────
// .env에 REACT_APP_ANTHROPIC_API_KEY=sk-ant-... 설정 필요
// CORS 이슈 시: 백엔드 FastAPI /api/chat 경유 (main.py 실행 후 사용)
async function callLLM(messages:{role:string;content:string}[]):Promise<{text:string;source:"llm"|"rag"|"error"}> {
  // 백엔드 FastAPI 서버 경유 (AWS Bedrock 사용)
  // 백엔드: backend/api/main.py 실행 필요
  try {
    const res = await fetch("http://localhost:8000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages,
        system: SYSTEM_PROMPT,
        mode: "question",
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
        {[40,55,70,85,100].map(v=><line key={v} x1={0} y1={yS(v,40,100)} x2={W} y2={yS(v,40,100)} stroke="#f3f4f6" strokeWidth={1}/>)}
        <path d={mk(p=>p.wip,150,350)} fill="none" stroke="#8b5cf6" strokeWidth={1.5} opacity={0.6}/>
        <path d={mk(p=>p.tat,0,6)} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.6}/>
        <path d={mk(p=>p.thp,150,300)} fill="none" stroke="#10b981" strokeWidth={2}/>
        <path d={mk(p=>p.oee,40,100)} fill="none" stroke="#2563eb" strokeWidth={2.5}/>
        <line x1={0} y1={yS(70,40,100)} x2={W} y2={yS(70,40,100)} stroke="#2563eb" strokeWidth={1} strokeDasharray="4 3" opacity={0.35}/>
        <text x={W+3} y={yS(70,40,100)+4} fontSize={9} fill="#2563eb" opacity={0.5}>70%</text>
        {xl.map(i=>data[i]&&<text key={i} x={xS(i)} y={H+18} textAnchor="middle" fontSize={10} fill="#9ca3af">{data[i].time.slice(0,8)}</text>)}
        {[40,55,70,85,100].map(v=><text key={v} x={-4} y={yS(v,40,100)+4} textAnchor="end" fontSize={10} fill="#9ca3af">{v}</text>)}
        {(()=>{const l=data[data.length-1];const lx=xS(data.length-1);return<><circle cx={lx} cy={yS(l.oee,40,100)} r={4} fill="#2563eb"/><circle cx={lx} cy={yS(l.thp,150,300)} r={3} fill="#10b981"/></>;})()}
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
function ReportPanel({report,onClose}:{report:Report;onClose:()=>void}) {
  const meta=KPI_META[report.alarm_kpi], bad=isBad(report), rate=getRate(report);
  const [raw,setRaw]=useState(false);
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
            {([
              {label:"## 기본 정보",text:report.pdf_raw.basic_info},
              {label:"## 문제 정의",text:report.pdf_raw.problem},
              {label:"## 근본 원인",text:report.pdf_raw.root_cause},
              {label:"## 해결 시나리오",text:report.pdf_raw.scenario},
              {label:"## 조치 결과",text:report.pdf_raw.result},
            ]).map((s,i)=>(
              <div key={i} style={{marginBottom:14}}>
                <div style={{color:"#60a5fa",fontWeight:600,marginBottom:5}}>{s.label}</div>
                <div style={{color:"#e2e8f0",lineHeight:1.7,whiteSpace:"pre-line"}}>{s.text}</div>
              </div>
            ))}
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
const API_BASE = "http://localhost:8000";

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
      const res = await fetch("http://localhost:8000/api/system/settings/targets", {
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
          {label:"관계형 DB",value:"Supabase PostgreSQL"},
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
// ────────────────────────── 메인 App ──────────────────────────
export default function App() {
  type Tab = "dashboard"|"alarms"|"chat"|"database"|"analytics"|"settings";
  type DbTable = "kpi_daily"|"scenario_map"|"rcp_state"|"eqp_state"|"lot_state";
  type AlarmSub = "latest"|"history";

  const [activeTab, setActiveTab]     = useState<Tab>("dashboard");
  const [alarmSub,  setAlarmSub]      = useState<AlarmSub>("latest");
  const [thresholds, setThresholds]   = useState<Thresholds>({oee_min:70,thp_min:250,tat_max:3.5,wip_min:200,wip_max:300});
  const [dbTable,   setDbTable]       = useState<DbTable>("kpi_daily");
  const [selReport, setSelReport]     = useState<Report|null>(null);
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
  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [dbFilterDate, setDbFilterDate] = useState<string>("all");
  const [dbFilterEqp,  setDbFilterEqp]  = useState<string>("all");
  const [dbPage,       setDbPage]       = useState<number>(1);
  const [dbEqpTotal,   setDbEqpTotal]   = useState<number>(0);
  const [dbLotTotal,   setDbLotTotal]   = useState<number>(0);
  const [dbEqpMeta,    setDbEqpMeta]    = useState<{dates:string[];eqps:string[]}>({dates:[],eqps:[]});
  const [dbLotMeta,    setDbLotMeta]    = useState<{dates:string[];eqps:string[]}>({dates:[],eqps:[]});

// PDF 목록 로드 (컴포넌트 마운트 시 + 저장/삭제 후)
useEffect(()=>{
  fetchReportList().then(setPdfFiles);
  const interval = setInterval(()=>{
    fetchReportList().then(setPdfFiles);
  }, 5000);  // 5초마다 폴더 스캔
  return () => clearInterval(interval);
}, []);
// Supabase 데이터 로드
useEffect(()=>{
  fetch("http://localhost:8000/api/dashboard-summary")
    .then(r=>r.json())
    .then(d=>{ if(d.success) setDashboardSummary(d.latest); })
    .catch(()=>{});

  fetch("http://localhost:8000/api/kpi-daily")
    .then(r=>r.json())
    .then(d=>{ if(d.success) setDbKpiData(d.data); })
    .catch(()=>{});

  fetch("http://localhost:8000/api/scenario-map")
    .then(r=>r.json())
    .then(d=>{ if(d.success) setDbScenarioData(d.data); })
    .catch(()=>{});

  fetch("http://localhost:8000/api/rcp-state")
    .then(r=>r.json())
    .then(d=>{ if(d.success) setDbRcpData(d.data); })
    .catch(()=>{});
}, []);

  // 챗봇
  const [msgs,      setMsgs]      = useState<ChatMessage[]>([{
    role:"assistant",
    content:"안녕하세요. KPI Monitoring Agent입니다.\n\n🤖 LLM: AWS Bedrock (Claude Haiku) 연동\n📚 RAG: ChromaDB (PDF 11건 인덱싱)\n📊 데이터: 2026-01-20 ~ 2026-01-31 알람 12건\n\n.env에 REACT_APP_ANTHROPIC_API_KEY 설정 또는\n백엔드 서버(main.py) 실행 시 실제 LLM 응답이 활성화됩니다.",
    timestamp:nowTime(), source:"llm",
  }]);
  const [input,     setInput]     = useState("");
  const [typing,    setTyping]    = useState(false);
  const [history,   setHistory]   = useState<{role:string;content:string}[]>([]);
  const chatEnd = useRef<HTMLDivElement>(null);

  // 실시간 KPI
  const [kpi, setKpi] = useState<LiveKPI>({oee:70,thp:229,tat:2.47,wip:256,oee_prev:70,thp_prev:231,tat_prev:2.45,wip_prev:255});
  const [rt,  setRt]  = useState<RealtimePoint[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(900);

  useEffect(()=>{
    setRt(Array.from({length:60},()=>({time:nowTime(),oee:jitter(74,8),thp:Math.round(jitter(235,20)),tat:jitter(2.5,0.5),wip:Math.round(jitter(250,20))})));
  },[]);

  useEffect(()=>{
    const iv=setInterval(()=>{
      setKpi(p=>{const o=jitter(74,8),t=Math.round(jitter(p.thp,4)),ta=jitter(p.tat,0.08),w=Math.round(jitter(p.wip,6));return{oee:o,thp:t,tat:ta,wip:w,oee_prev:p.oee,thp_prev:p.thp,tat_prev:p.tat,wip_prev:p.wip};});
      setRt(p=>[...p.slice(-59),{time:nowTime(),oee:jitter(74,8),thp:Math.round(jitter(235,20)),tat:jitter(2.5,0.5),wip:Math.round(jitter(250,20))}]);
    },500);
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

  useEffect(()=>{
  // 대시보드 요약
  fetch("http://localhost:8000/api/dashboard-summary")
    .then(r=>r.json())
    .then(d=>{ if(d.success) setDashboardSummary(d.latest); })
    .catch(()=>{});

  // KPI 전체 데이터
  fetch("http://localhost:8000/api/kpi-daily")
    .then(r=>r.json())
    .then(d=>{ if(d.success) setDbKpiData(d.data); })
    .catch(()=>{});

  // RCP 데이터
  fetch("http://localhost:8000/api/rcp-state")
    .then(r=>r.json())
    .then(d=>{ if(d.success) setDbRcpData(d.data); })
    .catch(()=>{});
}, []);

// EQP_STATE / LOT_STATE 페이징 fetch (탭·페이지·필터 변경 시 재조회)
useEffect(()=>{
  if (dbTable==="eqp_state") {
    const p = new URLSearchParams({page: String(dbPage), page_size:"1000"});
    if (dbFilterDate!=="all") p.append("date", dbFilterDate);
    if (dbFilterEqp!=="all")  p.append("eqp_id", dbFilterEqp);
    fetch(`http://localhost:8000/api/eqp-state?${p}`)
      .then(r=>r.json())
      .then(d=>{ if(d.success){ setDbEqpData(d.data); setDbEqpTotal(d.total_count||0); } })
      .catch(()=>{});
  } else if (dbTable==="lot_state") {
    const p = new URLSearchParams({page: String(dbPage), page_size:"1000"});
    if (dbFilterDate!=="all") p.append("date", dbFilterDate);
    if (dbFilterEqp!=="all")  p.append("eqp_id", dbFilterEqp);
    fetch(`http://localhost:8000/api/lot-state?${p}`)
      .then(r=>r.json())
      .then(d=>{ if(d.success){ setDbLotData(d.data); setDbLotTotal(d.total_count||0); } })
      .catch(()=>{});
  }
}, [dbTable, dbPage, dbFilterDate, dbFilterEqp]);

// EQP_STATE / LOT_STATE 메타데이터 fetch (탭 전환 시 1회)
useEffect(()=>{
  if (dbTable==="eqp_state" && dbEqpMeta.dates.length===0) {
    fetch("http://localhost:8000/api/eqp-state/meta")
      .then(r=>r.json())
      .then(d=>{ if(d.success) setDbEqpMeta({dates:d.dates, eqps:d.eqps}); })
      .catch(()=>{});
  } else if (dbTable==="lot_state" && dbLotMeta.dates.length===0) {
    fetch("http://localhost:8000/api/lot-state/meta")
      .then(r=>r.json())
      .then(d=>{ if(d.success) setDbLotMeta({dates:d.dates, eqps:d.eqps}); })
      .catch(()=>{});
  }
}, [dbTable]);

  // LLM 전송
  const handleSend = useCallback(async()=>{
    if(!input.trim()||typing) return;
    const q=input.trim();
    const t=nowTime();
    const newH=[...history,{role:"user",content:q}];
    setMsgs(p=>[...p,{role:"user",content:q,timestamp:t}]);
    setInput("");
    setTyping(true);
    setHistory(newH);
    try{
      const {text,source}=await callLLM(newH);
      setHistory(h=>[...h,{role:"assistant",content:text}]);
      setMsgs(p=>[...p,{role:"assistant",content:text,timestamp:nowTime(),source}]);
    }catch(e){
      setMsgs(p=>[...p,{role:"assistant",content:"오류가 발생했습니다. 잠시 후 다시 시도해주세요.",timestamp:nowTime(),source:"error"}]);
    }finally{ setTyping(false); }
  },[input,history,typing]);

  const delta=(cur:number,prev:number,inv=false)=>{
    const up=cur>prev; const good=inv?!up:up;
    return{arrow:up?"▲":"▼",color:good?"#16a34a":"#dc2626",val:Math.abs(cur-prev).toFixed(2)};
  };

  // ── DB 필터 헬퍼 ──────────────────────────────────────────────
  const activeDbData =
    dbTable==="kpi_daily"    ? (dbKpiData.length>0?dbKpiData:DB_KPI_DAILY) :
    dbTable==="scenario_map" ? (dbScenarioData.length>0?dbScenarioData:DB_SCENARIO_MAP) :
    dbTable==="rcp_state"    ? (dbRcpData.length>0?dbRcpData:DB_RCP_STATE) :
    dbTable==="eqp_state"    ? (dbEqpData.length>0?dbEqpData:DB_EQP_STATE) :
                               (dbLotData.length>0?dbLotData:DB_LOT_STATE);
  const dbGetDate=(row:any):string|null=>
    dbTable==="kpi_daily"||dbTable==="scenario_map" ? (row.date??null) :
    dbTable==="eqp_state"||dbTable==="lot_state"    ? (row.event_time?.slice(0,10)??null) : null;
  const dbGetEqp=(row:any):string|null=>
    dbTable==="scenario_map" ? (row.alarm_eqp_id??null) : (row.eqp_id??null);
  const isPaged = dbTable==="eqp_state"||dbTable==="lot_state";
  // paged 테이블은 백엔드에서 필터링 → 클라이언트 필터 스킵
  const filteredDbData = isPaged ? activeDbData : activeDbData.filter(row=>{
    const dOk=dbFilterDate==="all"||dbGetDate(row)===dbFilterDate;
    const eOk=dbFilterEqp==="all"||dbGetEqp(row)===dbFilterEqp;
    return dOk&&eOk;
  });
  // 드롭다운 옵션: paged 테이블은 meta 데이터 사용, 나머지는 현재 데이터에서 추출
  const dbUniqDates=Array.from(new Set(activeDbData.map(dbGetDate).filter(Boolean) as string[])).sort();
  const dbUniqEqps =Array.from(new Set(activeDbData.map(dbGetEqp).filter(Boolean) as string[])).sort();
  const filterDates = isPaged ? (dbTable==="eqp_state" ? dbEqpMeta.dates : dbLotMeta.dates) : dbUniqDates;
  const filterEqps  = isPaged ? (dbTable==="eqp_state" ? dbEqpMeta.eqps  : dbLotMeta.eqps)  : dbUniqEqps;
  const dbTotalCount = dbTable==="eqp_state" ? dbEqpTotal : dbTable==="lot_state" ? dbLotTotal : activeDbData.length;
  const dbTotalPages = Math.max(1, Math.ceil(dbTotalCount/1000));

  const NAV_ITEMS = [
  {id:"dashboard" as Tab, label:"Dashboard",    desc:"실시간 현황",    icon:"📊"},
  {id:"alarms"    as Tab, label:"Alarm Center", desc:"최신·과거 알람", icon:"🔔"},
  {id:"chat"      as Tab, label:"AI Assistant", desc:"LLM + RAG",     icon:"🤖"},
  {id:"analytics" as Tab, label:"Analytics",    desc:"KPI 트렌드 분석",icon:"📈"},
  {id:"database"  as Tab, label:"Database",     desc:"원본 데이터",    icon:"🗄️"},
  {id:"settings"  as Tab, label:"Settings",     desc:"알람 설정",      icon:"⚙️"},
];

  return(
    <div style={S.root}>
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
         activeTab==="settings"?"알람 임계값 · 알림 설정":"Supabase PostgreSQL · 5개 테이블"}
      </p>
    </div>
  </div>
  <div style={{display:"flex",alignItems:"center",gap:10}}>
    
    {[
  {label:"OEE", val:`${(dashboardSummary?.oee_v ?? kpi.oee).toFixed(1)}%`, bad:(dashboardSummary?.oee_v ?? kpi.oee)<thresholds.oee_min, color:"#2563eb"},
  {label:"THP", val:String(dashboardSummary?.thp_v ?? kpi.thp), bad:(dashboardSummary?.thp_v ?? kpi.thp)<thresholds.thp_min, color:"#059669"},
  {label:"TAT", val:`${(dashboardSummary?.tat_v ?? kpi.tat).toFixed(2)}h`, bad:(dashboardSummary?.tat_v ?? kpi.tat)>thresholds.tat_max, color:"#d97706"},
  {label:"WIP", val:String(dashboardSummary?.wip_v ?? kpi.wip), bad:(dashboardSummary?.wip_v ?? kpi.wip)<thresholds.wip_min||(dashboardSummary?.wip_v ?? kpi.wip)>thresholds.wip_max, color:"#7c3aed"},
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
    <div style={S.alarmChip}>🔴 신규 알람 1건</div>
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
                  <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{/*최근 60초 슬라이딩 윈도우 · 0.5초 업데이트*/}</div>
                </div>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  {[{c:"#2563eb",l:"OEE"},{c:"#10b981",l:"THP"},{c:"#f59e0b",l:"TAT"},{c:"#8b5cf6",l:"WIP"}].map(({c,l})=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:"50%",background:c}}/><span style={{fontSize:11,color:"#6b7280"}}>{l}</span></div>
                  ))}
                  <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:600,color:"#dc2626"}}><div style={{width:7,height:7,borderRadius:"50%",background:"#dc2626"}}/>LIVE</div>
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
            </div>

            {/* 최신 알람 상세 */}
            {alarmSub==="latest"&&(
              <div style={{...S.card,borderLeft:"4px solid #059669"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
                  <div>
                    <div style={{fontSize:20,fontWeight:700,color:"#0f172a"}}>EQP12 — Throughput 알람</div>
                    <div style={{fontSize:12,color:"#9ca3af",marginTop:4,fontFamily:"Pretendard, sans-serif"}}>2026-01-31 09:10 · LINE2 · OPER4 · RCP23 / RCP24</div>
                  </div>
                  <span style={{...S.badge,background:"#d1fae5",color:"#065f46",fontSize:13,padding:"5px 12px"}}>THP · 신규</span>
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
            )}
                    
                <div style={{borderTop:"1px solid #f3f4f6",paddingTop:16,marginTop:8,display:"flex",gap:12,alignItems:"center"}}>
                  <button
                    onClick={()=>setShowPdfModal(true)}
                    style={{padding:"7px 14px",borderRadius:6,border:"none",background:"#2563eb",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}
                  >
                    PDF 보고서 생성
                  </button>
                  {latestSaved&&<span style={{color:"#16a34a",fontWeight:600,fontSize:13}}>✅ RAG에 저장됨</span>}
                  <button
                    style={{padding:"6px 12px",borderRadius:6,border:"1px solid #d1d5db",background:"#fff",color:"#6b7280",fontWeight:600,fontSize:13,cursor:"pointer"}}
                    onClick={async ()=>{
                    if(window.confirm("초기화하면 추가된 보고서 파일도 삭제됩니다. 계속하시겠습니까?")){
                      // 추가된 파일만 삭제 (기존 11개 제외)
                      if(latestSaved){
                        await deleteReportFile("report_20260131_EQP12_THP.pdf");
                      }
                      setHistoryList(REPORTS);
                      setLatestSaved(false);
                      setLatestAlarmCount(1);
                      fetchReportList().then(setPdfFiles); // 목록 갱신
                    }
                  }}
                  >
                    초기화
                  </button>
                </div>

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
                      <div key={i} style={{...S.card,borderLeft:`4px solid ${meta.color}`,cursor:"pointer"}} onClick={()=>setSelReport(r)}>
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
                          <span style={{fontSize:10,color:"#7c3aed",background:"#ede9fe",padding:"2px 7px",borderRadius:4,fontWeight:600}}>PDF 원본 보기 →</span>
                          <span style={{fontSize:10,color:"#9ca3af",fontFamily:"Pretendard, sans-serif"}}>{r.filename.replace("report_","").replace(".pdf","")}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
              <div style={{flex:1,overflowY:"auto" as const,padding:"20px 28px",display:"flex",flexDirection:"column" as const,gap:14}}>
                {msgs.map((m,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"flex-end",gap:8,justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                    {m.role==="assistant"&&(
                      <div style={{width:30,height:30,borderRadius:8,background:"#0f172a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,fontFamily:"Pretendard, sans-serif"}}>AI</div>
                    )}
                    <div style={{maxWidth:"72%"}}>
                      <div style={m.role==="user"?S.userBubble:S.aiBubble}>
                        {m.content.split("\n").map((l,j,a)=><React.Fragment key={j}>{l}{j<a.length-1&&<br/>}</React.Fragment>)}
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
                    </div>
                  </div>
                ))}
                {typing&&(
                  <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
                    <div style={{width:30,height:30,borderRadius:8,background:"#0f172a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,fontFamily:"Pretendard, sans-serif"}}>AI</div>
                    <div style={S.aiBubble}><div style={{display:"flex",gap:4}}>{[0,0.2,0.4].map((d,i)=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#94a3b8",animation:`bounce ${d}s infinite`}}/>)}</div></div>
                  </div>
                )}
                <div ref={chatEnd}/>
              </div>
              
              {/* 빠른 질문 */}
              <div style={{padding:"0 28px 10px",display:"flex",gap:7,flexWrap:"wrap" as const}}>
                {["EQP12 최신 알람 원인은?","OEE 알람 패턴 분석해줘","어떤 장비가 가장 위험해?","WIP 알람 전체 현황은?","TAT 개선 방안 제시해줘"].map((s,i)=>(
                  <button key={i} style={S.chip} onClick={()=>setInput(s)}>{s}</button>
                ))}
              </div>
              <div style={{padding:"12px 28px 18px",display:"flex",gap:10,borderTop:"1px solid #e5e7eb",background:"#fff"}}>
                <input style={S.chatInput} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!typing&&handleSend()} placeholder="KPI 데이터 기반 분석 질문... (Enter)"/>
                <button style={{...S.sendBtn,opacity:typing?0.5:1}} onClick={handleSend} disabled={typing}>{typing?"분석 중...":"전송"}</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ DATABASE ═══ */}
        {activeTab==="database"&&(
          <div style={S.content}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,padding:"12px 16px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8}}>
              <span style={{fontSize:11,fontWeight:700,color:"#166534",letterSpacing:0.5}}>Supabase PostgreSQL</span>
              <span style={{fontSize:13,color:"#166534"}}>5개 테이블 원본 데이터 · 읽기 전용</span>
            </div>
            {/* 테이블 탭 */}
            <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap" as const}}>
              {([
                {id:"kpi_daily"    as DbTable,label:"KPI_DAILY",    rows:"144"},
                {id:"scenario_map" as DbTable,label:"SCENARIO_MAP", rows:"12"},
                {id:"rcp_state"    as DbTable,label:"RCP_STATE",    rows:"24"},
                {id:"eqp_state"    as DbTable,label:"EQP_STATE",    rows:"3,042"},
                {id:"lot_state"    as DbTable,label:"LOT_STATE",    rows:"5,771"},
              ]).map(t=>(
                <button key={t.id} style={{...S.filterBtn,...(dbTable===t.id?S.filterBtnOn:{})}} onClick={()=>{setDbTable(t.id);setDbFilterDate("all");setDbFilterEqp("all");setDbPage(1);}}>
                  {t.label}
                  <span style={{fontSize:10,padding:"1px 5px",borderRadius:8,background:dbTable===t.id?"rgba(255,255,255,0.2)":"#e5e7eb",color:dbTable===t.id?"#fff":"#6b7280",marginLeft:5}}>{t.rows}</span>
                </button>
              ))}
            </div>

            {/* 날짜 · EQP 필터 바 */}
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

            {/* KPI_DAILY */}
            {dbTable==="kpi_daily"&&(
              <div style={S.tableWrap}>
                <div style={S.tableHeader}>
                  <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>KPI_DAILY — 알람 발생 행만 표시 (alarm_flag=1)</span>
                  <span style={{fontSize:11,color:"#9ca3af"}}>총 144 rows · 12개 장비 × 12일</span>
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
                      {filteredDbData.map((row,i)=>(
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
                  <span style={{fontSize:11,color:"#9ca3af"}}>총 3,042 rows</span>
                </div>
                <div style={{overflowX:"auto" as const}}>
                  <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12,fontFamily:"Pretendard, sans-serif"}}>
                    <thead><tr style={{background:"#f3f4f6",borderBottom:"2px solid #e5e7eb"}}>
                      {["event_time","end_time","eqp_id","line","oper","lot_id","rcp_id","state"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left" as const,fontSize:10,fontWeight:700,color:"#6b7280",whiteSpace:"nowrap" as const}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {filteredDbData.map((row,i)=>(
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
                  <span style={{fontSize:11,color:"#9ca3af"}}>총 5,771 rows</span>
                </div>
                <div style={{overflowX:"auto" as const}}>
                  <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12,fontFamily:"Pretendard, sans-serif"}}>
                    <thead><tr style={{background:"#f3f4f6",borderBottom:"2px solid #e5e7eb"}}>
                      {["event_time","lot_id","line","oper","eqp_id","rcp_id","lot_state","in_cnt","hold","scrap"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left" as const,fontSize:10,fontWeight:700,color:"#6b7280",whiteSpace:"nowrap" as const}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {filteredDbData.map((row,i)=>(
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
        >{latestSaved?"이미 저장됨":"💾 RAG 저장"}</button>
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
        >✅ 저장</button>
      </div>
    </div>
  </div>
)}

{/* 저장 완료 토스트 */}
{showSavedToast&&(
  <div style={{position:"fixed",bottom:28,right:28,background:"#0f172a",color:"#fff",padding:"14px 20px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:999,display:"flex",gap:8,alignItems:"center",boxShadow:"0 8px 24px rgba(0,0,0,0.3)"}}>
    ✅ RAG 저장 완료! 과거이력에 추가되었습니다.
  </div>
)}
{activeTab==="analytics"&&<AnalyticsPage reports={historyList}/>}
        {activeTab==="settings"&&<SettingsPage thresholds={thresholds} setThresholds={setThresholds}/>}
      </main>

      {selReport&&<ReportPanel report={selReport} onClose={()=>setSelReport(null)}/>}

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
