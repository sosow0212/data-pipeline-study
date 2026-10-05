import re

from neo4j import GraphDatabase

from ops_agent.domain.inquiry import UnknownServiceError


class Neo4jKnowledgeRepository:
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def _query(self, statement: str, **parameters):
        records, _, _ = self.driver.execute_query(
            statement,
            parameters_=parameters,
            database_="neo4j",
            routing_="r",
        )
        return [record.data() for record in records]

    def topology(self, service_id: str) -> dict:
        rows = self._query(
            "MATCH (s:Service {id:$id}) OPTIONAL MATCH (s)-[:OWNED_BY]->(t:Team) "
            "RETURN s.name AS name, t.name AS team",
            id=service_id,
        )
        if not rows:
            raise UnknownServiceError(service_id)
        dependencies = self._query(
            "MATCH (:Service {id:$id})-[:DEPENDS_ON*1..3]->(d:Service) "
            "RETURN DISTINCT d.id AS id ORDER BY id LIMIT 20",
            id=service_id,
        )
        dependents = self._query(
            "MATCH (s:Service)-[:DEPENDS_ON*1..3]->(:Service {id:$id}) "
            "RETURN DISTINCT s.id AS id ORDER BY id LIMIT 20",
            id=service_id,
        )
        return {
            **rows[0],
            "dependencies": [r["id"] for r in dependencies],
            "potentially_affected": [r["id"] for r in dependents],
        }

    def runbooks(self, service_ids, question, embedding=None) -> list[dict]:
        if embedding is not None:
            rows = self._query(
                "CALL db.index.vector.queryNodes('runbook_embedding', 30, $embedding) "
                "YIELD node, score MATCH (node)-[:DESCRIBES]->(s:Service) "
                "WHERE s.id IN $ids AND node.embedding_model = $model "
                "RETURN node.id AS id, node.title AS title, node.content AS content, "
                "score, 'vector' AS retrieval ORDER BY score DESC LIMIT 5",
                embedding=embedding,
                ids=service_ids,
                model="text-embedding-3-small",
            )
            if rows:
                return rows
        # Tokenisation removes Lucene query operators supplied in a question.
        terms = re.findall(r"[\w]+", question, re.UNICODE)[:20]
        query = " OR ".join('"' + term + '"' for term in terms)
        if query:
            rows = self._query(
                "CALL db.index.fulltext.queryNodes('runbook_text', $query, {limit:30}) "
                "YIELD node, score MATCH (node)-[:DESCRIBES]->(s:Service) "
                "WHERE s.id IN $ids RETURN node.id AS id, node.title AS title, "
                "node.content AS content, score, 'fulltext' AS retrieval "
                "ORDER BY score DESC LIMIT 5",
                query=query,
                ids=service_ids,
            )
            if rows:
                return rows
        return self._query(
            "MATCH (r:Runbook)-[:DESCRIBES]->(s:Service) WHERE s.id IN $ids "
            "RETURN r.id AS id, r.title AS title, r.content AS content, "
            "'service_scope' AS retrieval ORDER BY r.id LIMIT 5",
            ids=service_ids,
        )
