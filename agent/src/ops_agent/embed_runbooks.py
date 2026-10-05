"""Explicit, paid embedding command. Not called during startup or normal evidence retrieval."""

import os

from neo4j import GraphDatabase

from ops_agent.infrastructure.openai import OpenAIEmbeddingModel


def main():
    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        raise SystemExit("Set OPENAI_API_KEY before running the embedding command")
    model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    embeddings = OpenAIEmbeddingModel(key, model)
    with GraphDatabase.driver(
        os.getenv("NEO4J_URI", "bolt://localhost:17687"),
        auth=("neo4j", os.getenv("NEO4J_PASSWORD", "ops-lab-password")),
    ) as driver:
        rows, _, _ = driver.execute_query(
            "MATCH (r:Runbook) WHERE r.embedding IS NULL OR r.embedding_model <> $model "
            "RETURN r.id AS id, r.title AS title, r.content AS content ORDER BY r.id LIMIT 100",
            model=model,
            database_="neo4j",
        )
        if not rows:
            print("No runbooks need embedding")
            return
        vectors, tokens = embeddings.embed([r["title"] + "\n" + r["content"] for r in rows])
        for row, vector in zip(rows, vectors, strict=True):
            driver.execute_query(
                "MATCH (r:Runbook {id:$id}) SET r.embedding=$embedding, r.embedding_model=$model",
                id=row["id"],
                embedding=vector,
                model=model,
                database_="neo4j",
            )
        print(f"Embedded {len(rows)} runbooks; model={model}; tokens={tokens}")


if __name__ == "__main__":
    main()
