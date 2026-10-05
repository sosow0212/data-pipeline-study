"""Exercise real local services without any OpenAI calls. Requires make up and Spark image."""

import json
import subprocess
import time
from pathlib import Path

import httpx
from neo4j import GraphDatabase
from trino.dbapi import connect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
results = {}


def command(name: str, args: list[str]):
    print(f"Running {name}", flush=True)
    with (ARTIFACTS / f"{name}.log").open("w") as output:
        result = subprocess.run(
            args, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT, check=False
        )
    if result.returncode:
        raise RuntimeError(f"{name} failed; see artifacts/{name}.log")


def spark(name: str, mode: str, path: str | None = None):
    args = [
        "docker",
        "compose",
        "run",
        "--rm",
        "--no-deps",
        "spark",
        "/workspace/data-pipeline/jobs/lakehouse.py",
        mode,
    ]
    if path:
        args.extend(["--path", path])
    command(name, args)


def query(sql: str):
    connection = connect(host="localhost", port=18091, user="smoke")
    try:
        cursor = connection.cursor()
        cursor.execute(sql)
        return cursor.fetchall()
    finally:
        connection.close()


with httpx.Client(base_url="http://localhost:18090", timeout=15) as client:
    client.get("/readyz").raise_for_status()
    command("replay", [str(ROOT / ".venv/bin/pipeline"), "replay"])
    command("replay-again", [str(ROOT / ".venv/bin/pipeline"), "replay"])
    replayed = json.loads((ARTIFACTS / "replay-again.log").read_text())
    assert replayed == {"accepted": 1000, "created": 0, "duplicates": 1000}, replayed
    event = json.loads((ROOT / "data/sample/events.jsonl").read_text().splitlines()[0])
    assert client.post("/v1/events", json={**event, "message": "changed"}).status_code == 409
    assert client.post("/v1/events", json={**event, "duration_ms": -1}).status_code == 400
    assert client.post("/v1/events", json={**event, "service_id": "unknown"}).status_code == 404
    results["core"] = {"replay_duplicates": 1000, "conflict": 409, "invalid": 400, "unknown": 404}

# Wait for the durable outbox to drain; this is not inferred from an HTTP 202.
deadline = time.monotonic() + 90
while True:
    output = subprocess.check_output(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "mongodb",
            "mongosh",
            "--quiet",
            "ops_lab",
            "--eval",
            "db.events.countDocuments({published_at:null})",
        ],
        cwd=ROOT,
        text=True,
    )
    if int(output.strip()) == 0:
        break
    if time.monotonic() >= deadline:
        raise RuntimeError("Core outbox did not drain within 90 seconds")
    time.sleep(1)

sample = (ROOT / "data/sample/events.jsonl").read_text()
dirty = ARTIFACTS / "dirty.jsonl"
dirty.write_text(sample + sample.splitlines()[0] + "\n" + '{"event_id":"invalid"}\n')
spark("batch", "batch", "/workspace/artifacts/dirty.jsonl")
assert query("SELECT count(*) FROM lake.silver.logs") == [[1000]]
spark("batch-again", "batch", "/workspace/artifacts/dirty.jsonl")
assert query("SELECT count(*) FROM lake.silver.logs") == [[1000]]
assert query("SELECT count(*) FROM lake.silver.quarantine") == [[1]]
spark("stream", "stream")
spark("stream-again", "stream")
assert query("SELECT count(*) FROM lake.silver.logs") == [[1000]]
assert query("SELECT count(*) FROM lake.gold.service_hourly") == [[120]]
assert query("SELECT sum(requests), sum(errors) FROM lake.gold.service_hourly") == [[1000, 34]]
results["lakehouse"] = {
    "silver_rows": 1000,
    "gold_rows": 120,
    "errors": 34,
    "quarantine_rows": 1,
    "bronze_sources": query(
        "SELECT source, count(*) FROM lake.bronze.logs GROUP BY source ORDER BY source"
    ),
    "snapshots": query('SELECT count(*) FROM lake.silver."logs$snapshots"')[0][0],
}
command("ontology", [str(ROOT / ".venv/bin/pipeline"), "ontology"])
command("ontology-again", [str(ROOT / ".venv/bin/pipeline"), "ontology"])
with GraphDatabase.driver("bolt://localhost:17687", auth=("neo4j", "ops-lab-password")) as driver:
    records, _, _ = driver.execute_query("MATCH (s:Service) RETURN count(s) AS count")
    assert records[0]["count"] == 5
    records, _, _ = driver.execute_query(
        "MATCH (s:Service)-[r:DEPENDS_ON]->() RETURN count(r) AS count"
    )
    assert records[0]["count"] == 4
    records, _, _ = driver.execute_query("MATCH (r:Runbook) RETURN count(r) AS count")
    assert records[0]["count"] == 5
results["ontology"] = {"services": 5, "dependencies": 4, "runbooks": 5}
with httpx.Client(base_url="http://localhost:18092", timeout=60) as client:
    response = client.post(
        "/v1/evidence", json=json.loads((ROOT / "examples/question.json").read_text())
    )
    response.raise_for_status()
    evidence = response.json()
    assert set(evidence["topology"]["dependencies"]) == {"payment", "inventory"}
    assert len(evidence["hourly_metrics"]) == 72
    assert evidence["embedding_tokens"] == 0
    assert evidence["runbooks"]
    (ARTIFACTS / "evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2))
    missing = client.post(
        "/v1/evidence", json={"service_id": "unknown", "day": "2026-10-01", "question": "timeout"}
    )
    assert missing.status_code == 404
results["agent"] = {"hourly_metrics": 72, "runbooks": len(evidence["runbooks"]), "openai_calls": 0}
results["verified_at_utc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
(ARTIFACTS / "verification.json").write_text(
    json.dumps(results, ensure_ascii=False, indent=2) + "\n"
)
print(json.dumps(results, ensure_ascii=False, indent=2))
