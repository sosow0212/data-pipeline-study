import csv
import json
import random
import uuid
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from observability_pipeline.domain.event import LogEvent

SERVICES = ("gateway", "checkout", "payment", "inventory", "identity")
ENDPOINTS = {
    "gateway": "/api/orders",
    "checkout": "/orders",
    "payment": "/payments/authorize",
    "inventory": "/stock/reserve",
    "identity": "/sessions/verify",
}


def generate_events(count: int, day: date, seed: int = 42) -> Iterator[LogEvent]:
    """Yield bounded-memory, reproducible data with a planted payment incident."""
    if count < 1:
        raise ValueError("count must be positive")
    rng = random.Random(seed)
    start = datetime.combine(day, datetime.min.time(), tzinfo=UTC)
    for index in range(count):
        occurred = start + timedelta(seconds=index * 86400 // count)
        service = SERVICES[index % len(SERVICES)]
        incident = 12 <= occurred.hour < 14 and service in {"payment", "checkout"}
        failure = rng.random() < (0.60 if incident else 0.02)
        duration = rng.randint(1200, 4500) if incident else rng.randint(10, 180)
        status = (504 if service == "checkout" else 503) if failure else 200
        message = (
            "payment dependency timeout"
            if failure and incident
            else ("upstream unavailable" if failure else "request completed")
        )
        identity = f"{day.isoformat()}:{seed}:{count}:{index}"
        yield LogEvent(
            event_id=str(uuid.uuid5(uuid.NAMESPACE_URL, identity)),
            schema_version=1,
            occurred_at=occurred.isoformat().replace("+00:00", "Z"),
            service_id=service,
            environment="production",
            level="ERROR" if failure else "INFO",
            endpoint=ENDPOINTS[service],
            status_code=status,
            duration_ms=duration,
            trace_id=f"trace-{index // len(SERVICES):012d}",
            user_id=f"user-{rng.randint(1, 5000):05d}",
            message=message,
        )


def write_dataset(output: Path, count: int, day: date, seed: int) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    with (
        (output / "events.jsonl").open("w") as json_file,
        (output / "events.csv").open("w", newline="") as csv_file,
    ):
        writer = None
        errors = 0
        for event in generate_events(count, day, seed):
            row = event.to_dict()
            json_file.write(json.dumps(row, ensure_ascii=False) + "\n")
            if writer is None:
                writer = csv.DictWriter(csv_file, fieldnames=list(row))
                writer.writeheader()
            writer.writerow(row)
            errors += event.status_code >= 500
    summary = {"rows": count, "errors": errors, "day": day.isoformat(), "seed": seed}
    (output / "manifest.json").write_text(json.dumps(summary, indent=2) + "\n")
    return summary
