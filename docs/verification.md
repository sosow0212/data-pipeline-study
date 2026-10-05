# 로컬 검증 기록

2026-10-02 13:21 KST에 이 작업 폴더의 Compose 프로젝트 `ops-lab`에서 통합 검증을 완료했습니다. 다른 작업 폴더의 Docker 프로젝트나 외부 운영 환경을 검증한 결과가 아닙니다.

## 실제 연결을 검증한 경로

```text
Core HTTP API → MongoDB embedded outbox → Kafka
  → Spark Structured Streaming → Iceberg / Polaris / RustFS
  → Trino → Agent evidence API

Core 서비스 카탈로그 → 온톨로지 동기화 → Neo4j → Agent evidence API
```

| 항목 | 관측 결과 |
|---|---|
| Core 최초 로그 수집 | 1,000건 생성 |
| 동일 로그 재전송 | 신규 생성 0건, 중복 1,000건 |
| 동일 event_id 내용 변경 | HTTP 409 |
| 잘못된 duration_ms | HTTP 400 |
| 미등록 service_id | HTTP 404 |
| outbox 전달 대기 | 0건으로 소진된 후 Spark 검증을 진행했습니다. |
| Bronze 파일 원문 | 1,001건: 정상 로그 1,000건과 잘못된 로그 1건 |
| Bronze Kafka 원문 | 1,000건 |
| Silver 유효 로그 | 배치 재실행, Kafka 적재, checkpoint 재사용 후에도 1,000건 |
| quarantine | 검증용 잘못된 로그 1건 |
| Gold 시간별 집계 | 120행, 요청 1,000건, HTTP 5xx 34건 |
| Iceberg snapshot | metadata 테이블에서 7개를 조회했습니다. 재실행 횟수에 따라 달라집니다. |
| Neo4j 동기화 두 번 | Service 5개, DEPENDS_ON 관계 4개, Runbook 5개 |
| Agent evidence API | HTTP 200, 시간별 근거 72행, 관련 문서 3개 |
| Agent 미등록 서비스 질의 | HTTP 404 |
| OpenAI 유료 호출 | 0회 |

배치와 스트리밍의 실제 실행에서 발견한 Spark session 문제와 Neo4j 검색 인자 충돌을 수정한 뒤 통합 경로를 재검증했습니다. 입력 DataFrame이 속한 SparkSession에서 임시 뷰와 MERGE를 실행합니다.

## 코드 검사

`make check`가 통과했습니다. Python 테스트 7개, Go의 수집 검증·outbox 재시도 테스트, Go vet, Go/Python 포맷, Ruff, Python import 계약 3개, Compose config 검사를 포함합니다. Go 내부 계층의 저장소·프레임워크 의존도 검사합니다.

실제 서비스 검증 스크립트는 `scripts/smoke.py`입니다. `make up` 이후 `make smoke`로 다시 실행할 수 있습니다. 기본 1,000건 샘플을 전제로 하므로 다른 데이터를 이미 추가한 환경에서는 전체 행 수 검증이 실패할 수 있습니다. 사용자 데이터를 자동 삭제하지 않습니다.

자세한 실행 출력은 `artifacts/*.log`, 근거 API 응답은 `artifacts/evidence.json`, 기계 판독용 검증 요약은 `artifacts/verification.json`에 남겼습니다. artifacts는 버전 관리에서 제외합니다.

## 검증 범위의 한계

모의 로그는 CSV와 JSONL로 1,000건 및 10,000건을 생성했습니다. 실제 적재와 조회는 1,000건으로 검증했습니다. 100만 행 처리량, 다중 Spark 워커, Kafka 고가용성, Core 다중 dispatcher는 검증하지 않았습니다.

LangGraph의 근거 전달과 답변 단계는 테스트용 AnswerModel로 검증했습니다. 실제 OpenAI Responses API와 임베딩 어댑터는 구현했지만, API 키와 계정별 모델 접근 권한을 사용한 호출은 수행하지 않았습니다. 따라서 실제 LLM 답변과 유료 semantic search의 실행 성공을 주장하지 않습니다. Neo4j full-text/vector index 생성과 실제 keyword/scoped 문서 조회는 확인했습니다.

## Next.js 대시보드 추가 검증

2026-10-02 14:03 KST에 같은 `ops-lab` 프로젝트에서 Next.js 프로덕션 이미지를 빌드하고 [http://localhost:13000](http://localhost:13000)에서 실제 API와 브라우저 동작을 확인했습니다. 이 단계에서는 Spark 적재를 다시 실행하지 않고 앞서 검증한 데이터를 조회했습니다.

| 항목 | 확인한 결과 |
|---|---|
| 프로덕션 빌드 | Next.js 16.3.8 standalone 이미지 빌드 및 Frontend healthcheck 통과 |
| 타입·계산 검사 | TypeScript 검사, 가중 평균·p95 최댓값·UTC 시간 구간 테스트 2개 통과 |
| 포맷 | Prettier 검사 통과 |
| 백엔드 검사 | Python 테스트 8개, Ruff, import 계약 3개, Go 테스트와 vet, Compose config 통과 |
| 실제 Next.js API | 서비스 5개, Gold 120행, 요청 1,000건, 오류 34건, checkout 분석 근거 72행 |
| 로그 탐색 | 전체 1,000건, ERROR 34건, payment ERROR 13건, 두 번째 페이지 26~50건, 상세 JSON |
| 문자열 검색 | `.*`를 정규식으로 실행하지 않고 문자 그대로 검색해 0건 반환 |
| 범위·입력 오류 | 로그 limit 101은 400, 잘못된 집계 날짜는 422 |
| 환경·날짜 필터 | Staging 및 2026-09-30은 빈 상태, Production / 2026-10-01로 복귀하면 원래 수치 표시 |
| 서비스 관계 | payment 선택, 영향 가능 서비스 checkout/gateway 표시, 실제 Neo4j 운영 문서 펼치기 |
| 분석 도우미 | 질문 예시 선택, 무료 근거 요청, 의존 서비스 inventory/payment 표시, 대화 초기화 |
| 모바일 | 390×844 viewport에서 네 화면의 document scrollWidth가 390px임을 확인 |
| 연결 오류 | Agent 중지 시 오류와 재시도 버튼 표시, 재시작 후 자동 재조회로 정상 수치 복구 |
| OpenAI | 키 미설정 상태에서 AI 답변 비활성화, chat API 503, 유료 호출 0회 |

날짜 입력창을 브라우저에서 직접 확인하면서 분할된 날짜 입력의 확정 시점을 보완했습니다. 유효한 날짜는 blur 시에도 반영하고, 범위를 벗어나거나 비어 있는 입력은 기존 날짜로 복구합니다.

브라우저 검증은 Codex In-app Browser로 직접 수행했습니다. Playwright 자동화 시나리오 5개도 제공하며 테스트 목록 로딩까지 확인했습니다. 이번 기록에는 Playwright 자동 실행 결과를 포함하지 않습니다. 실제 API 검증은 `make dashboard-smoke`로 다시 수행할 수 있고 기본 1,000건 샘플을 전제로 합니다.

API 검증 요약은 `artifacts/dashboard-api-verification.json`입니다. 화면 증거는 `artifacts/dashboard-desktop.jpg`, `dashboard-mobile.jpg`, `logs-mobile.jpg`, `log-detail.jpg`, `topology-desktop.jpg`, `topology-mobile.jpg`, `assistant-desktop.jpg`, `assistant-mobile.jpg`, `backend-error.jpg`에 저장했습니다. Docker 빌드 출력은 이번 실행의 `/private/tmp/ops-dashboard-*.log`에 있습니다. artifacts와 임시 로그는 버전 관리에서 제외합니다.
