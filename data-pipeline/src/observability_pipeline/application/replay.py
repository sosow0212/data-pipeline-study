import json
from pathlib import Path
from typing import Protocol


class CoreGateway(Protocol):
    def register(self, service: dict) -> None: ...
    def ingest(self, event: dict) -> bool: ...


def replay(gateway: CoreGateway, events: Path, services: Path, limit: int | None) -> dict:
    for service in json.loads(services.read_text()):
        gateway.register(service)
    created = 0
    accepted = 0
    with events.open() as source:
        for line in source:
            if limit is not None and accepted >= limit:
                break
            created += gateway.ingest(json.loads(line))
            accepted += 1
    return {"accepted": accepted, "created": created, "duplicates": accepted - created}
