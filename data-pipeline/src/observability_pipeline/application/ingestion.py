from typing import Protocol


class LakehouseRunner(Protocol):
    def initialise(self) -> None: ...
    def ingest_batch(self, path: str) -> None: ...
    def ingest_stream(self, continuous: bool) -> None: ...
    def refresh_metrics(self) -> None: ...
    def inspect(self) -> None: ...


def run_job(runner: LakehouseRunner, mode: str, path: str, continuous: bool):
    runner.initialise()
    if mode == "batch":
        runner.ingest_batch(path)
        runner.refresh_metrics()
    elif mode == "stream":
        runner.ingest_stream(continuous)
        if not continuous:
            runner.refresh_metrics()
    elif mode == "metrics":
        runner.refresh_metrics()
    else:
        runner.inspect()
