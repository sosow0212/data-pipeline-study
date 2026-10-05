SHELL := /bin/sh
DC := docker compose
PY := .venv/bin
ROWS ?= 10000
DAY ?= 2026-10-01
EVENTS ?= data/sample/events.jsonl

.PHONY: setup up down status generate replay batch ingest stream metrics inspect query ontology evidence chat embed check test-core smoke frontend-setup frontend-dev frontend-check dashboard-smoke

setup:
	uv sync --frozen --python 3.12

up:
	$(DC) up -d --build --wait core trino neo4j agent frontend

frontend-setup:
	cd frontend && npm ci

frontend-dev:
	cd frontend && npm run dev

frontend-check:
	cd frontend && npm run check && npm run build

dashboard-smoke:
	$(PY)/python scripts/dashboard_smoke.py

down:
	$(DC) down

status:
	$(DC) ps

generate:
	$(PY)/pipeline generate --rows $(ROWS) --day $(DAY)

replay:
	$(PY)/pipeline replay --events $(EVENTS)

batch:
	$(DC) run --rm --build spark /workspace/data-pipeline/jobs/lakehouse.py batch --path /workspace/$(EVENTS)

ingest:
	$(DC) run --rm --build spark /workspace/data-pipeline/jobs/lakehouse.py stream

stream:
	$(DC) run --rm --build --service-ports spark /workspace/data-pipeline/jobs/lakehouse.py stream --continuous

metrics:
	$(DC) run --rm spark /workspace/data-pipeline/jobs/lakehouse.py metrics

inspect:
	$(DC) run --rm spark /workspace/data-pipeline/jobs/lakehouse.py inspect

query:
	$(DC) exec -T trino trino --file /dev/stdin < sql/analysis.sql

ontology:
	$(PY)/pipeline ontology

evidence:
	curl --fail-with-body -s http://localhost:18092/v1/evidence -H 'Content-Type: application/json' --data-binary @examples/question.json

chat:
	curl --fail-with-body -s http://localhost:18092/v1/chat -H 'Content-Type: application/json' --data-binary @examples/question.json

embed:
	$(DC) run --rm agent /app/.venv/bin/python -m ops_agent.embed_runbooks

test-core:
	docker run --rm -v "$(CURDIR)/core:/src" -v ops-lab-go-mod:/go/pkg/mod -v ops-lab-go-build:/root/.cache/go-build -w /src golang:1.24.7-alpine sh -c 'test -z "$$(gofmt -l .)" && go test ./... && go vet ./...'

check:
	$(PY)/ruff check .
	$(PY)/ruff format --check .
	$(PY)/pytest -q
	$(PY)/lint-imports
	$(DC) config --quiet
	$(MAKE) test-core

smoke:
	$(DC) build spark
	$(PY)/python scripts/smoke.py
