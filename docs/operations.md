# 실행과 문제 해결

## 공개 주소

| 기능 | 주소 |
|---|---|
| Core API | http://localhost:18090 |
| Agent Swagger | http://localhost:18092/docs |
| Trino UI | http://localhost:18091 |
| RustFS 콘솔 | http://localhost:19001 |
| S3 API | http://localhost:19000 |
| Polaris REST API | http://localhost:18191/api/catalog |
| Polaris health | http://localhost:18192/q/health |
| Neo4j Browser | http://localhost:17474 |
| Neo4j Bolt | bolt://localhost:17687 |
| Kafka 외부 listener | localhost:19092 |
| MongoDB | mongodb://localhost:27027 |
| Spark UI | http://localhost:14040, `make stream` 실행 중에만 열립니다. |

모두 이번 Compose 프로젝트 `ops-lab`의 주소입니다. RustFS는 `ops-lab / ops-lab-secret`, Neo4j는 `neo4j / ops-lab-password`를 사용합니다. 고정 계정은 로컬 학습 전용입니다. 외부 공개와 운영용 인증·TLS는 구현하지 않았습니다.

`make up`은 Core와 필요한 저장소, Trino, Neo4j, Agent를 실행합니다. 초기화 서비스는 Kafka 토픽, S3 버킷, Polaris realm과 카탈로그를 생성하고 종료합니다. 종료 코드 0인 초기화 컨테이너는 정상입니다. `docker compose ps -a`로 확인합니다.

`make down`은 볼륨을 유지합니다. `docker compose down -v`는 이번 프로젝트의 MongoDB·Kafka·객체 파일·카탈로그·Neo4j·checkpoint를 모두 삭제하므로 초기화하려는 경우에만 직접 실행합니다.

## 고정 버전

Spark 4.1.3 / Scala 2.13, Iceberg runtime·AWS bundle 1.11.0, Kafka 4.3.1, Trino 483, Polaris·admin-tool 1.8.0, Neo4j Community 5.26.12, MongoDB 8.0.16, PostgreSQL 17.5, RustFS 1.0.0-alpha.81을 사용합니다. RustFS는 Polaris 공식 예제의 학습용 구성을 참고한 alpha 버전입니다. 운영 저장소의 안정성을 검증한 선택은 아닙니다.

Python의 실제 버전은 `uv.lock`, Go 라이브러리 버전은 `go.mod`와 `go.sum`으로 고정합니다. Spark의 JAR는 이미지 빌드 단계에서 다운로드하므로 실행마다 외부 Maven 저장소가 필요하지 않습니다. 최초 빌드에는 인터넷이 필요합니다.

## 실패를 구분합니다

Core가 202를 반환했는데 Iceberg에 데이터가 없으면 MongoDB 저장, Kafka 발행, Spark 적재를 각각 확인합니다. `docker compose logs --tail=100 core`에서 outbox 재시도를 보고, `make ingest`로 새 Kafka 메시지를 처리합니다. 202는 전달 완료가 아니라 수집 완료입니다.

Polaris가 올라오지 않으면 `catalog-db`, `polaris-init`, `polaris` 로그를 순서대로 확인합니다. 데이터 파일이 객체 저장소에 남아 있어도 PostgreSQL 카탈로그가 없으면 자동으로 같은 테이블을 조회할 수 없습니다. 객체 저장소와 카탈로그 볼륨을 함께 유지합니다.

Agent가 404를 반환하면 Core에 서비스가 등록되어 있는지 확인하고 `make ontology`를 실행합니다. 503이면 Trino 테이블 생성과 Neo4j 연결을 확인합니다. chat에만 503이 나오고 evidence가 성공하면 OpenAI 키 설정을 확인합니다. 502는 OpenAI 인증·모델 접근·API 호출 문제일 수 있습니다.

새 로그를 넣었는데 Gold가 바뀌지 않으면 `make metrics`를 실행합니다. streaming의 연속 모드는 Silver 적재까지만 수행합니다. 날짜는 UTC를 사용하며 예제 질문의 day는 `2026-10-01`입니다. 한국 시간으로 변환하면 UTC 12시는 21시입니다.

## 처리 보장과 확장 제약

이 예제는 단일 Core dispatcher와 단일 Spark ingest 작업을 전제로 합니다. 동시에 여러 ingest를 실행하거나 같은 checkpoint를 공유하는 streaming 작업을 여러 개 실행하지 않습니다. Core outbox에는 lease, 별도 dead-letter 토픽, 자동 정리 정책을 넣지 않았습니다. Kafka는 3개 파티션과 1개 broker를 사용해 다중 partition을 배우지만 broker 고가용성은 제공하지 않습니다.

잘못된 로그는 quarantine에 들어갑니다. 동일 event_id에 서로 다른 유효 데이터가 직접 파일/Kafka로 들어오면 Silver는 최초 데이터를 유지하며 충돌 내용을 따로 비교하지 않습니다. API를 통한 동일 식별자 변경은 Core가 409로 거부합니다. 미등록 서비스의 파일 로그는 Core 등록 검증을 거치지 않으므로 온톨로지 조회 전에 카탈로그와 맞추어야 합니다.

전체 테이블 집계와 MongoDB 로그 영구 보관은 학습용 선택입니다. 생성기가 100만 행을 만들 수 있다는 사실은 100만 행의 운영 처리량·메모리·복구를 검증했다는 의미가 아닙니다. 실제 운영으로 확장할 때는 증분 집계, 보관 기간, outbox 병렬 처리, 인증과 지표를 설계합니다.

## 참고한 공식 자료

- [Polaris와 Trino 연결](https://polaris.apache.org/guides/trino/)
- [Polaris PostgreSQL metastore와 bootstrap](https://polaris.apache.org/in-dev/unreleased/metastores/relational-jdbc/)
- [Trino REST catalog 설정](https://trino.io/docs/current/object-storage/metastores.html)
- [Iceberg Structured Streaming](https://iceberg.apache.org/docs/latest/spark-structured-streaming/)
- [Neo4j full-text index](https://neo4j.com/docs/cypher-manual/current/indexes/semantic-indexes/full-text-indexes/)
- [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [OpenAI 텍스트 생성](https://developers.openai.com/api/docs/guides/text)
- [OpenAI 임베딩](https://developers.openai.com/api/docs/guides/embeddings)
