# 첫 수업: 로그 한 줄에서 분석 서비스까지

오늘은 먼저 로그 한 줄을 읽고, 이를 수집하는 Core 코드를 확인합니다. 작업 폴더는 `data-pipeline-study`입니다. 전체 서비스를 실행하기 전에 다음 세 파일을 순서대로 엽니다.

1. `data/sample/events.jsonl`: 첫 번째 줄에 실제 예제 로그가 있습니다.
2. `data-pipeline/src/observability_pipeline/application/generate.py`: 로그를 생성하는 규칙이 있습니다.
3. `core/internal/telemetry/application/ingest.go`: 로그를 검증하고 저장하는 흐름이 있습니다.

예제 서비스에는 gateway, checkout, payment, inventory, identity가 있습니다. 사용자가 주문하면 gateway → checkout → payment와 inventory 순서로 요청이 전달된다고 가정합니다. 오전에는 대부분 성공하지만 UTC 12~14시에 payment의 지연과 오류가 증가하고 checkout에도 지연이 나타나도록 데이터를 만들었습니다.

## 로그의 의미를 읽습니다

`event_id`는 로그 한 건의 식별자이고 `trace_id`는 여러 서비스에 걸친 요청을 연결하는 값입니다. 생성기에서는 다섯 서비스가 같은 trace_id를 공유하도록 만들었지만 실제 분산 추적 프로토콜을 구현한 것은 아닙니다. `occurred_at`은 발생 시각, `duration_ms`는 처리 시간, `status_code`는 HTTP 응답 상태입니다. `service_id`는 서비스 카탈로그에 등록된 식별자입니다.

CSV는 행과 열을 직접 살펴보기 좋고 JSONL은 줄마다 JSON 하나를 저장해 Kafka 메시지와 같은 구조를 표현하기 좋습니다. 같은 데이터가 두 파일에 들어 있습니다.

첫 번째 실행은 Docker 없이 진행합니다.

```sh
make setup
.venv/bin/pipeline generate --rows 10000 --day 2026-10-01 --output data/generated
```

이 명령은 `data/generated/events.jsonl`, `events.csv`, `manifest.json`을 만듭니다. 기본 seed 42에서는 10,000건 중 HTTP 5xx가 412건입니다. `make generate`도 같은 Python 명령을 실행하는 단축 명령입니다. 파일 전체를 메모리에 올리지 않고 한 줄씩 쓰므로 `--rows 1000000`으로 큰 파일을 만드는 실험도 가능합니다.

이제 `generate.py`의 `incident`와 `failure` 계산을 읽습니다. `0.60 if incident else 0.02`를 보면 장애 시간대에 오류 확률이 증가한다는 것을 알 수 있습니다. 여기서 `0.60`을 `0.20`으로 바꾸고 같은 명령을 실행하면 로그 수는 그대로이고 오류 수가 줄어듭니다. 변경한 파일을 이미 적재한 event_id로 다시 보내면 Core가 409를 반환할 수 있으므로, 적재 실습에서는 새로운 `--seed`를 사용합니다.

## Core 요청 한 건을 따라갑니다

다음 파일을 읽습니다.

```text
telemetry/presentation/http/handler.go
  → telemetry/application/ingest.go
    → telemetry/domain/event.go
    → telemetry/infrastructure/mongodb/repository.go
```

Handler는 HTTP JSON을 Event로 읽습니다. Ingest는 Event.Validate를 호출하고 서비스가 등록되어 있는지 확인합니다. MongoDB 구현체는 로그를 저장합니다. 저장 성공은 Kafka 전달 완료를 의미하지 않으며, 이때 API는 202를 반환합니다.

별도의 dispatcher는 아직 전달하지 않은 로그를 읽어 Kafka에 발행합니다. 발행이 실패하면 다음 실행에서 다시 시도합니다. 동일한 event_id와 동일한 내용으로 요청하면 새 로그가 생기지 않으며 200을 반환합니다. 같은 식별자의 내용을 바꾸면 409를 반환합니다.

## 이제 같은 로그를 실제로 이동시킵니다

```sh
make up
make replay
make ingest
make ontology
make evidence
```

`make replay`는 기본 예제 1,000건을 Core API에 보냅니다. `make ingest`는 Kafka에 쌓인 메시지를 Spark로 처리하고 종료합니다. 첫 실행에서 예상되는 Silver 로그는 1,000건, 서비스별 로그는 200건, Gold 시간별 집계는 120행입니다. 정상 샘플의 quarantine은 0건입니다. 전달이 아직 진행 중이면 `make ingest`를 다시 실행하면 됩니다.

`make smoke`를 실행한 환경에는 검증용 잘못된 로그 1건이 quarantine에 남습니다. 이것은 정상 샘플에서 발생한 오류가 아니라 데이터 품질 처리 검증을 위해 넣은 레코드입니다.

`make ontology`는 Core에 등록된 서비스를 Neo4j로 옮기고 운영 문서를 연결합니다. `make evidence`는 checkout과 의존 서비스의 시간별 수치 및 운영 문서를 반환합니다. 이 단계에는 OpenAI 비용이 들지 않습니다.

이후 `sql/analysis.sql`을 열고 `make query`를 실행합니다. 출력에서 payment와 checkout의 UTC 12~14시 오류율과 p95 지연을 다른 시간대와 비교합니다. 다음 수업은 `docs/labs.md`의 순서대로 진행합니다.

같은 결과를 대시보드에서 확인하려면 [http://localhost:13000](http://localhost:13000)을 엽니다. 날짜를 `2026-10-01`, 환경을 `Production`으로 선택합니다. 전체 현황에서 payment의 지연 그래프를 살펴보고, 로그 탐색에서 `ERROR`로 필터링한 다음 서비스 관계에서 payment를 선택합니다. 분석 도우미의 `근거 조회`를 실행하면 OpenAI 키 없이도 관계와 운영 문서를 확인할 수 있습니다.
