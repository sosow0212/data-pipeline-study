from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class LogEvent:
    event_id: str
    schema_version: int
    occurred_at: str
    service_id: str
    environment: str
    level: str
    endpoint: str
    status_code: int
    duration_ms: int
    trace_id: str
    user_id: str
    message: str

    def to_dict(self) -> dict:
        return asdict(self)
