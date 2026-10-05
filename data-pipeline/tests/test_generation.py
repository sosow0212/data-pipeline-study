import json
from datetime import date

import pytest
from observability_pipeline.application.generate import generate_events, write_dataset


def test_reproducible_events_and_planted_incident():
    rows = [e.to_dict() for e in generate_events(10000, date(2026, 10, 1))]
    assert rows == [e.to_dict() for e in generate_events(10000, date(2026, 10, 1))]
    assert len({e["event_id"] for e in rows}) == 10000
    incident = [e for e in rows if e["service_id"] == "payment" and "T12:" in e["occurred_at"]]
    normal = [e for e in rows if e["service_id"] == "payment" and "T10:" in e["occurred_at"]]
    assert sum(e["status_code"] >= 500 for e in incident) / len(incident) > 0.4
    assert sum(e["status_code"] >= 500 for e in normal) / len(normal) < 0.1
    assert min(e["duration_ms"] for e in incident) > max(e["duration_ms"] for e in normal)


def test_streaming_generator_writes_both_formats(tmp_path):
    summary = write_dataset(tmp_path, 100, date(2026, 10, 1), 42)
    assert summary["rows"] == 100
    assert len((tmp_path / "events.jsonl").read_text().splitlines()) == 100
    assert len((tmp_path / "events.csv").read_text().splitlines()) == 101
    assert json.loads((tmp_path / "manifest.json").read_text()) == summary


def test_invalid_count():
    with pytest.raises(ValueError):
        list(generate_events(0, date(2026, 10, 1)))
