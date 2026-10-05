"""Read-only frontend API smoke check for the default 1,000-event fixture."""

import json
import urllib.error
import urllib.request
from pathlib import Path

ORIGIN = "http://localhost:13000"


def request(path, expected=200, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        ORIGIN + path, data=body, headers={"Content-Type": "application/json"}
    )
    try:
        response = urllib.request.urlopen(req, timeout=60)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        assert response.status == expected, (path, response.status)
        return json.load(response)


def main():
    services = request("/api/services")
    assert len(services) == 5
    metrics = request("/api/metrics?day=2026-10-01&environment=production")
    rows = metrics["hourly_metrics"]
    assert len(rows) == 120
    assert sum(row["requests"] for row in rows) == 1000
    assert sum(row["errors"] for row in rows) == 34
    assert metrics["aggregated_at"] and not metrics["truncated"]
    events = request("/api/events?day=2026-10-01&page=2&limit=25")
    assert events["total"] == 1000 and events["page"] == 2 and len(events["items"]) == 25
    assert request("/api/events?day=2026-10-01&level=ERROR")["total"] == 34
    assert request("/api/events?day=2026-10-01&service_id=payment&level=ERROR")["total"] == 13
    assert request("/api/events?day=2026-10-01&search=.%2A")["total"] == 0
    request("/api/events?day=2026-10-01&limit=101", expected=400)
    request("/api/metrics?day=invalid", expected=422)
    assert request("/api/metrics?day=2026-10-01&environment=staging")["hourly_metrics"] == []
    payload = {
        "service_id": "checkout",
        "day": "2026-10-01",
        "environment": "production",
        "question": "timeout latency",
    }
    evidence = request("/api/evidence", payload=payload)
    assert evidence["topology"]["dependencies"] == ["inventory", "payment"]
    assert len(evidence["hourly_metrics"]) == 72 and evidence["runbooks"]
    status = request("/api/status")
    assert status["core"] and status["agent"]
    if not status["model_configured"]:
        request("/api/chat", expected=503, payload=payload)
    # Never make a paid request, even when a key has been configured later.
    result = {
        "services": 5,
        "hourly_rows": 120,
        "requests": 1000,
        "errors": 34,
        "evidence_rows": 72,
        "paid_requests": 0,
        "model_configured": status["model_configured"],
        "passed": True,
    }
    Path("artifacts").mkdir(exist_ok=True)
    Path("artifacts/dashboard-api-verification.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result))


if __name__ == "__main__":
    main()
