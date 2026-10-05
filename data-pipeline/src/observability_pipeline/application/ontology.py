from typing import Protocol


class OntologyRepository(Protocol):
    def initialise(self) -> None: ...
    def upsert_service(self, service: dict) -> None: ...
    def replace_dependencies(self, service: dict) -> None: ...
    def upsert_runbook(self, runbook: dict) -> None: ...


def sync_ontology(repository: OntologyRepository, services: list[dict], runbooks: list[dict]):
    identifiers = {s["id"] for s in services}
    for service in services:
        if not set(service["dependencies"]) <= identifiers:
            raise ValueError("unknown dependency in service catalog")
    for runbook in runbooks:
        if runbook["service_id"] not in identifiers:
            raise ValueError("unknown runbook service")
    repository.initialise()
    for service in services:
        repository.upsert_service(service)
    for service in services:
        repository.replace_dependencies(service)
    for runbook in runbooks:
        repository.upsert_runbook(runbook)
