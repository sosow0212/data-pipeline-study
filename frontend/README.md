# Lakehouse 대시보드

Next.js App Router, React, TypeScript로 구현한 학습용 대시보드입니다. 기본 주소는 [http://localhost:13000](http://localhost:13000)이며, 기본 조회 날짜는 예제 데이터가 있는 `2026-10-01`입니다. 모든 시간과 날짜는 UTC 기준입니다.

## 실행합니다

프로젝트 루트에서 `make up`을 실행하면 Frontend와 Core, Agent를 포함한 상시 서비스가 시작됩니다. 이미 적재한 데이터를 보존합니다. 처음 시작한 환경에서는 `make replay`, `make ingest`, `make ontology`를 순서대로 실행합니다.

Frontend만 수정할 때는 Node.js 24 환경에서 다음 명령을 실행합니다. Docker Frontend와 개발 서버는 같은 포트를 사용하므로 하나만 실행합니다.

```sh
docker compose stop frontend
make frontend-setup
make frontend-dev
```

개발 서버는 기본적으로 Core `localhost:18090`, Agent `localhost:18092`에 연결합니다. 주소를 변경하려면 `frontend/.env.example`을 `frontend/.env.local`로 복사해 수정합니다. `OPENAI_API_KEY`는 루트 `.env`와 Agent에만 설정하며 브라우저에는 전달하지 않습니다.

## 네 화면에서 데이터를 탐색합니다

| 화면 | 기능 | 데이터 출처 |
|---|---|---|
| 전체 현황 | 요청 수, HTTP 5xx 오류율, 요청 수에 따른 가중 평균 지연, 시간별 그래프, 서비스별 비교 | Agent → Trino → Iceberg Gold |
| 로그 탐색 | 서비스·수준·날짜·환경 필터, 메시지·경로·식별자 검색, 페이지 이동, 상세 JSON | Core → MongoDB |
| 서비스 관계 | 서비스 카탈로그 그래프, 노드 선택, 의존 서비스와 영향 가능 서비스, 운영 문서 | Core 카탈로그 + Agent → Neo4j |
| 분석 도우미 | 질문 예시, 무료 근거 조회, 선택적 OpenAI 답변, 근거와 출처 표시 | Agent → LangGraph / Trino / Neo4j / OpenAI |

Gold의 p95 값은 시간별 서비스 집계입니다. 이를 평균 내서 일별 p95로 표현하지 않습니다. 표에는 시간별 p95의 최댓값을, 지연 그래프에는 선택한 서비스의 시간별 p95를 표시합니다. 서비스 상태의 `확인 필요` 기준은 일별 오류율 5% 이상이며, 실제 가용성 검사 결과가 아닙니다.

화면의 새로고침은 저장된 데이터를 다시 조회합니다. Spark 집계를 실행하는 기능은 아닙니다. 로그는 MongoDB에 수집된 상태를, 지표는 마지막 Gold 집계 시점까지의 데이터를 보여주므로 두 화면의 행 수가 다를 수 있습니다. 마지막 집계 시점은 Iceberg snapshot의 `committed_at`에서 가져옵니다.

OpenAI 키가 없으면 `근거 조회`를 사용할 수 있습니다. `AI 답변`을 선택하고 질문을 보내면 실제 API 비용이 발생합니다. 각 질문은 독립적인 요청이며, 화면에 남은 이전 대화는 모델에 전달되지 않습니다. 대화는 브라우저 메모리에만 보관합니다.

## 패키지 구조를 유지합니다

```text
src/
├── app/                         페이지와 고정된 BFF API 경로
│   └── api/                     Core / Agent의 허용된 경로만 호출
├── features/
│   ├── observability/domain/    집계 타입과 순수 계산 함수
│   ├── observability/components/
│   ├── logs/domain/            로그 조회 계약
│   ├── logs/components/
│   ├── topology/components/
│   ├── assistant/domain/       분석 근거와 답변 계약
│   └── assistant/components/
├── shared/application/         브라우저 HTTP 요청 처리
├── shared/infrastructure/      서버 전용 Core / Agent 어댑터
├── shared/components/          레이아웃, 공통 상태, UI
└── styles/                     공통 시각 규칙과 반응형 화면
```

UI는 `/api/*`만 호출합니다. 외부 서비스 주소는 `server-only` 모듈에서 읽으며 `NEXT_PUBLIC_*` 환경 변수로 공개하지 않습니다. 서버에서 임의 URL을 전달받는 프록시는 제공하지 않습니다. 새 서비스 기능은 해당 도메인의 `features`에 넣고, 단순 화면 상태까지 불필요하게 계층을 추가하지 않습니다.

추가한 백엔드 API는 `GET /v1/events`와 `GET /v1/metrics`입니다. Core의 로그 조회는 `presentation → application.ReadEvents → EventReader → infrastructure.MongoDB` 경로를 따릅니다. 기존 수집·outbox 포트와 조회 포트를 분리했습니다. 로그 검색어는 MongoDB 정규식에 넣기 전에 이스케이프하고, 페이지 크기는 최대 100건, offset은 최대 10,000건으로 제한합니다. 집계 API는 최대 2,400행을 반환하고 초과하면 `truncated`를 표시합니다.

## 검증합니다

```sh
make frontend-check
make dashboard-smoke
cd frontend
npm run format:check
npm run test:e2e
```

`frontend-check`는 타입 검사, 가중 평균·시간별 p95·UTC 시간 구간 테스트, 프로덕션 빌드를 실행합니다. 브라우저 자동화 테스트는 Chrome이 설치된 호스트와 실행 중인 전체 서비스, 기본 샘플 1,000건 및 Gold 집계를 전제로 합니다. 테스트는 무료 근거 조회만 실행하며 실제 OpenAI를 호출하지 않습니다. backend 오류 표시 검사는 실패 응답을 주입하고, 나머지 조회는 실제 Core와 Agent를 사용합니다.

`dashboard-smoke`는 실제 Next.js API를 통해 집계 수치, MongoDB 페이지 이동과 필터, 정규식 문자의 리터럴 검색, 입력 오류, Neo4j 근거, OpenAI 미설정 응답을 확인합니다. 모델 키가 연결되어 있어도 유료 호출은 수행하지 않습니다. 기본 샘플을 전제로 하므로 다른 데이터를 추가한 뒤에는 예상 행 수를 조정해야 합니다.

자동화 테스트의 데스크톱·모바일 스크린샷은 루트 `artifacts/`에 저장합니다. 테스트 실패 시 trace는 `frontend/test-results/`에 저장합니다. Chrome이 없는 환경에서는 `playwright.config.ts`의 `channel: "chrome"`을 제거하고 `npx playwright install chromium`을 실행할 수 있습니다. 실제 수행한 검증 범위는 `docs/verification.md`를 확인합니다.

이 앱은 `127.0.0.1`로 제한한 로컬 학습 환경입니다. 인증과 사용자별 권한은 구현하지 않았습니다. 외부 공개 배포에는 인증, 권한, API 사용량 제한을 추가해야 합니다.
