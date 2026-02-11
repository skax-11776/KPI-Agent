# 대응 시나리오 스키마
{
  "scenario_id": int,
  "title": str,
  "priority_score": int,
  "proiority_level": str,
  
  "alarm_info": {
    "date": str,
    "eqp_id": str,
    "line_id": str,
    "oper_id": str,
    "kpi_drops": {
      "KPI 이름": {
        "current": float,
        "target": float,
        "gap": float
      }
    }
  },
  
  "root_cause": {
    "category": str,
    "summary": str,
    "key_findings": [str]
  },
  
  "actions": [
    {
      "step": int,
      "action": str
    }
  ],
  
  "expected_recovery": {
    "OEE": float (optional),
    "THP": int (optional),
    "TAT": float (optional),
    "WIP": int (optional),
    "recovery_hours": float
  },
  "risk_level": str
}


# 대응 시나리오 스키마 예시
{
  "scenario_id": 1,
  "title": "설비 긴급 점검",
  "priority_score": 85,
  "priority_level": "HIGH",
  
  "alarm_info": {
    "date": "2024-02-11",
    "eqp_id": "EQP-A01",
    "line_id": "LINE-A",
    "oper_id": "OP-02",
    "kpi_drops": {
      "OEE": {
        "current": 72.5,
        "target": 85.0,
        "gap": -12.5
      }
    }
  },
  
  "root_cause": {
    "category": "EQUIPMENT",
    "summary": "EQP-A01 처리 속도 저하",
    "key_findings": [
      "Cycle Time 20% 증가",
      "Down Time 90분"
    ]
  },
  
  "actions": [
    {
      "step": 1,
      "action": "가동 중단",
    },
    {
      "step": 2,
      "action": "설비 진단",
    }
  ],
  
  "expected_recovery": {
    "OEE": 10.0,
    "THP": null,
    "TAT": null,
    "WIP": null,
    "recovery_hours": 3.5
  },
  
  "cost_estimate": "중간",
  "risk_level": "LOW"
}

