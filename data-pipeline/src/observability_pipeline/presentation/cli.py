import argparse
import json
import os
from datetime import date
from pathlib import Path

from observability_pipeline.application.generate import write_dataset
from observability_pipeline.application.ontology import sync_ontology
from observability_pipeline.application.replay import replay
from observability_pipeline.infrastructure.core import HTTPCoreGateway
from observability_pipeline.infrastructure.neo4j import Neo4jOntologyRepository


def main():
    parser = argparse.ArgumentParser(description="Operations log learning pipeline")
    commands = parser.add_subparsers(dest="command", required=True)
    generate = commands.add_parser("generate")
    generate.add_argument("--rows", type=int, default=10000)
    generate.add_argument("--day", type=date.fromisoformat, default=date(2026, 10, 1))
    generate.add_argument("--seed", type=int, default=42)
    generate.add_argument("--output", type=Path, default=Path("data/generated"))
    playback = commands.add_parser("replay")
    playback.add_argument("--events", type=Path, default=Path("data/sample/events.jsonl"))
    playback.add_argument("--services", type=Path, default=Path("data/reference/services.json"))
    playback.add_argument("--limit", type=int)
    commands.add_parser("ontology")
    args = parser.parse_args()
    if args.command == "generate":
        result = write_dataset(args.output, args.rows, args.day, args.seed)
    elif args.command == "replay":
        gateway = HTTPCoreGateway(os.getenv("CORE_URL", "http://localhost:18090"))
        try:
            result = replay(gateway, args.events, args.services, args.limit)
        finally:
            gateway.close()
    else:
        repository = Neo4jOntologyRepository(
            os.getenv("NEO4J_URI", "bolt://localhost:17687"),
            os.getenv("NEO4J_USER", "neo4j"),
            os.getenv("NEO4J_PASSWORD", "ops-lab-password"),
        )
        try:
            with HTTPCoreGateway(os.getenv("CORE_URL", "http://localhost:18090")).client as client:
                response = client.get("/v1/services")
                response.raise_for_status()
                services = response.json()
            runbooks = json.loads(Path("data/reference/runbooks.json").read_text())
            sync_ontology(repository, services, runbooks)
            result = {"services": len(services), "runbooks": len(runbooks)}
        finally:
            repository.close()
    print(json.dumps(result, ensure_ascii=False))
