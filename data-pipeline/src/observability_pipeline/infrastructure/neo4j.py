from neo4j import GraphDatabase


class Neo4jOntologyRepository:
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def _run(self, query: str, **parameters):
        self.driver.execute_query(query, parameters_=parameters, database_="neo4j")

    def initialise(self):
        self._run(
            "CREATE CONSTRAINT service_id IF NOT EXISTS FOR (s:Service) REQUIRE s.id IS UNIQUE"
        )
        self._run("CREATE CONSTRAINT team_name IF NOT EXISTS FOR (t:Team) REQUIRE t.name IS UNIQUE")
        self._run(
            "CREATE CONSTRAINT runbook_id IF NOT EXISTS FOR (r:Runbook) REQUIRE r.id IS UNIQUE"
        )
        self._run(
            "CREATE FULLTEXT INDEX runbook_text IF NOT EXISTS "
            "FOR (r:Runbook) ON EACH [r.title, r.content]"
        )
        self._run(
            "CREATE VECTOR INDEX runbook_embedding IF NOT EXISTS FOR (r:Runbook) ON r.embedding "
            "OPTIONS {indexConfig: {`vector.dimensions`: 1536, "
            "`vector.similarity_function`: 'cosine'}}"
        )

    def upsert_service(self, service: dict):
        self._run(
            "MERGE (s:Service {id:$id}) SET s.name=$name "
            "WITH s OPTIONAL MATCH (s)-[old:OWNED_BY]->(:Team) DELETE old "
            "WITH DISTINCT s MERGE (t:Team {name:$team}) MERGE (s)-[:OWNED_BY]->(t)",
            id=service["id"],
            name=service["name"],
            team=service["team"],
        )

    def replace_dependencies(self, service: dict):
        self._run(
            "MATCH (s:Service {id:$id}) OPTIONAL MATCH (s)-[r:DEPENDS_ON]->() DELETE r "
            "WITH DISTINCT s UNWIND $dependencies AS dependency "
            "MATCH (d:Service {id:dependency}) MERGE (s)-[:DEPENDS_ON]->(d)",
            id=service["id"],
            dependencies=service["dependencies"],
        )

    def upsert_runbook(self, runbook: dict):
        self._run(
            "MERGE (r:Runbook {id:$id}) "
            "WITH r, (r.content IS NULL OR r.content <> $content OR r.title <> $title) AS changed "
            "SET r.title=$title, r.content=$content "
            "FOREACH (_ IN CASE WHEN changed THEN [1] ELSE [] END | "
            "REMOVE r.embedding, r.embedding_model) "
            "WITH r OPTIONAL MATCH (r)-[old:DESCRIBES]->(:Service) DELETE old "
            "WITH DISTINCT r MATCH (s:Service {id:$service_id}) MERGE (r)-[:DESCRIBES]->(s)",
            **runbook,
        )
