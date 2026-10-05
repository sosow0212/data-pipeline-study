# 실습 순서

## 1. CSV와 JSONL을 비교합니다

`application/generate.py`와 `data/sample/events.csv`를 엽니다. CSV 헤더를 LogEvent 필드와 비교합니다. 1,000건 샘플은 34건의 HTTP 5xx를 포함합니다. 같은 인자로 데이터를 재생성하면 같은 event_id와 내용이 나옵니다.

`make generate ROWS=1000000 DAY=2026-10-02`로 큰 파일을 만들 수 있습니다. JSONL과 CSV를 모두 생성하므로 디스크 사용량이 증가합니다. 생성기는 행을 하나씩 생성해 메모리 사용량이 행 수에 비례해 증가하지 않습니다.

## 2. Core에서 Clean Architecture를 확인합니다

`telemetry/domain/event.go`를 열고 duration_ms와 status_code 검증을 읽습니다. `make up` 후 `make replay`를 실행합니다. 같은 명령을 다시 실행하면 `created=0`, `duplicates=1000`이 예상됩니다. 이벤트 내용만 바꾸고 같은 event_id로 전송하면 409가 예상됩니다.

`catalog/application/service.go`의 Repository를 MongoDB 구현체가 어떻게 충족하는지 찾아봅니다. Handler가 MongoDB를 직접 호출하지 않는 이유를 설명해 봅니다. domain만으로 입력 범위를 검증할 수 있는지 테스트에서 확인합니다.

## 3. Spark 배치 처리를 확인합니다

`infrastructure/spark/runner.py`의 `ingest_batch`와 `_process`를 읽습니다.

```sh
make batch
make inspect
```

`spark.read.text`는 JSONL 각 줄을 원문으로 읽습니다. `from_json`은 스키마를 적용하고, 검증식은 잘못된 값을 구분합니다. `MERGE`는 기존 식별자를 다시 넣지 않습니다. 같은 배치를 두 번 실행해도 Silver는 1,000건을 유지합니다.

Spark는 로컬 머신에서 `local[2]`로 실행하지만 DataFrame·shuffle·Structured Streaming 코드는 Spark API를 사용합니다. 여러 워커가 있는 분산 클러스터나 대규모 처리량을 검증한 것은 아닙니다.

## 4. Kafka를 통한 스트리밍을 확인합니다

`telemetry/application/dispatch.go`와 `ingest_stream`을 읽습니다.

```sh
make replay
make ingest
make query
```

`availableNow`는 시작할 때 확보한 Kafka 데이터를 처리한 후 작업을 종료합니다. 이후 들어온 메시지는 다음 실행에서 읽습니다. `make stream`은 30초 간격으로 계속 읽으며, Ctrl+C로 종료합니다. 계속 실행하는 모드에서는 Gold를 자동으로 갱신하지 않으므로 별도로 `make metrics`를 실행합니다.

파일과 Kafka 양쪽으로 같은 샘플을 적재하면 Bronze에는 출처별로 각각 1,000건이 있을 수 있고 Silver는 1,000건을 유지합니다. checkpoint는 Docker 볼륨에 저장하며 임의로 삭제하지 않습니다. 삭제하면 Kafka 원문을 다시 읽지만 Silver MERGE가 중복을 막습니다.

## 5. Iceberg를 확인합니다

`sql/analysis.sql`의 snapshot 조회를 실행합니다. Iceberg는 Parquet 파일과 metadata를 관리하고 쓰기 작업을 snapshot으로 기록합니다. Polaris는 테이블 이름과 현재 metadata 위치 등을 관리하는 카탈로그입니다.

Trino에서 조회한 snapshot_id로 다음 SQL을 실행해 과거 데이터를 확인합니다.

```sql
SELECT count(*) FROM lake.silver.logs FOR VERSION AS OF <snapshot_id>;
```

`<snapshot_id>`를 실제 BIGINT 값으로 바꿉니다. snapshot 삭제와 orphan file 정리는 이 실습에서 자동 실행하지 않습니다.

## 6. Trino 분석을 확인합니다

`sql/analysis.sql`을 읽고 `make query`를 실행합니다. payment의 UTC 12~14시 오류율과 p95 지연을 다른 시간대와 비교합니다. 이후 checkout의 같은 시간대를 비교합니다. 이는 생성기에 넣은 상황이며 실제 원인을 발견한 결과가 아닙니다.

Trino는 이 실습에서 SQL 조회를 담당하고 Spark는 적재·변환·집계를 담당합니다. Trino도 쓰기 작업을 할 수 있지만 이 예제에서 두 엔진의 책임을 분리해 학습합니다.

## 7. 온톨로지와 검색을 확인합니다

```sh
make ontology
```

Neo4j Browser `http://localhost:17474`에 접속합니다. 사용자 `neo4j`, 비밀번호 `ops-lab-password`, Bolt 주소 `bolt://localhost:17687`을 사용합니다.

```cypher
MATCH (s:Service)-[r]->(n) RETURN s, r, n;
MATCH (r:Runbook)-[:DESCRIBES]->(s:Service) RETURN r, s;
MATCH (upstream:Service)-[:DEPENDS_ON*1..3]->(:Service {id:'payment'})
RETURN upstream.id;
```

payment에 의존하는 checkout과 gateway를 확인합니다. 이것은 장애 영향 가능성을 조사하는 관계이며 오류가 실제 전파되었다는 증거는 아닙니다.

## 8. LangGraph와 챗봇 API를 확인합니다

`agent/src/ops_agent/application/graph.py`를 엽니다. `collect_evidence`가 어떻게 SQL 결과와 Neo4j 결과를 모아 `answer`에 전달하는지 읽습니다. FastAPI Swagger는 `http://localhost:18092/docs`입니다.

먼저 `make evidence`를 실행하고 hourly_metrics와 topology를 확인합니다. 본인의 OpenAI API 키를 `.env`에 넣고 Agent를 재생성한 다음 `make chat`을 실행합니다. 응답에는 answer, evidence, usage가 포함됩니다. 키가 없는 상태의 chat은 503을 반환합니다.

벡터 실습에서는 `make embed`로 5개 운영 문서를 실제 임베딩합니다. `.env`에 `SEMANTIC_SEARCH=true`를 설정하고 Agent를 재생성하면 챗봇 요청에서 질문 임베딩과 vector index를 사용합니다. 이때 요청별 embedding_tokens도 확인합니다. evidence API는 이 설정과 관계없이 유료 임베딩을 호출하지 않습니다.
