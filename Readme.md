# 🤖 AI Agent KPI Monitor

생산 라인 KPI 모니터링 및 근본 원인 분석 AI Agent

## 📋 프로젝트 개요

이 프로젝트는 제조 생산 라인의 KPI(핵심성과지표)를 모니터링하고,
문제 발생 시 AI를 활용해 근본 원인을 분석하는 시스템입니다.

### 주요 기능
- 📊 실시간 알람 모니터링
- 🔍 AI 기반 근본 원인 분석
- 💬 과거 이력 검색 챗봇
- 📝 분석 리포트 자동 생성

## 🛠️ 기술 스택

### Backend
- Python 3.11
- LangGraph (AI Agent 워크플로우)
- AWS Bedrock (LLM)
- ChromaDB (Vector DB)
- Supabase (PostgreSQL)

### Frontend
- React 18
- TypeScript
- Node.js
- Tailwind CSS

### 배포
- AWS (EC2, S3, CloudFront)

## 📁 프로젝트 구조
```
ai-agent-kpi-monitor/
├── backend/          # Python AI Agent
│   ├── nodes/        # LangGraph 노드
│   ├── graph/        # 워크플로우 정의
│   ├── utils/        # 유틸리티
│   ├── config/       # 설정
│   └── tests/        # 테스트
├── frontend/         # React 앱
├── data/             # 데이터 파일
├── docs/             # 문서
└── .env              # 환경 변수
```

## 🚀 시작하기

### 1. 가상환경 활성화
```bash
.\venv\Scripts\Activate.ps1
```

### 2. 패키지 설치
```bash
pip install -r requirements.txt
```

### 3. 환경 변수 설정
`.env` 파일에 AWS, Supabase 키 입력

## 📝 개발 일지

- 2024-XX-XX: 프로젝트 초기화

## 👨‍💻 개발자

Your Name

## 📄 라이선스

MIT License
```

---

## 🔧 Step 7: VSCode 확장 프로그램 설치

VSCode에서 다음 확장 프로그램을 설치하세요:

1. **Python** (Microsoft) - 필수
   - Extensions 탭 (Ctrl+Shift+X) 열기
   - "Python" 검색 후 설치

2. **Pylance** (Microsoft) - 자동 완성
3. **Python Debugger** (Microsoft) - 디버깅
4. **GitLens** - Git 기능 강화
5. **ES7+ React/Redux/React-Native snippets** - React 개발용
6. **Prettier** - 코드 포맷터

---

## 📊 현재 폴더 구조 확인

VSCode Explorer에서 다음과 같은 구조가 보여야 합니다:
```
ai-agent-kpi-monitor/
├── backend/
│   ├── nodes/
│   ├── graph/
│   ├── utils/
│   ├── config/
│   └── tests/
├── frontend/
├── data/
├── docs/
├── venv/
├── .env
├── .gitignore
├── README.md
└── requirements.txt