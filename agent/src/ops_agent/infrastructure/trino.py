from datetime import date

from trino.dbapi import connect


class TrinoMetricsRepository:
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port

    def hourly(self, service_ids: list[str], day: date, environment: str) -> list[dict]:
        connection = connect(
            host=self.host,
            port=self.port,
            user="ops-agent",
            catalog="lake",
            schema="gold",
            request_timeout=30,
            max_attempts=2,
            session_properties={"query_max_execution_time": "30s"},
        )
        try:
            cursor = connection.cursor()
            placeholders = ",".join("?" for _ in service_ids)
            cursor.execute(
                "SELECT service_id, environment, hour, requests, errors, error_rate, "
                "avg_duration_ms, p95_duration_ms FROM lake.gold.service_hourly "
                f"WHERE service_id IN ({placeholders}) AND event_date = CAST(? AS DATE) "
                "AND environment = ? ORDER BY hour, service_id LIMIT 240",
                [*service_ids, day.isoformat(), environment],
            )
            columns = [column[0] for column in cursor.description]
            rows = [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]
            for row in rows:
                row["hour"] = row["hour"].isoformat()
            return rows
        finally:
            connection.close()

    def overview(self, day: date, environment: str) -> dict:
        connection = connect(
            host=self.host,
            port=self.port,
            user="ops-dashboard",
            catalog="lake",
            schema="gold",
            request_timeout=30,
            max_attempts=2,
            session_properties={"query_max_execution_time": "30s"},
        )
        try:
            cursor = connection.cursor()
            cursor.execute(
                "SELECT service_id, environment, hour, requests, errors, error_rate, "
                "avg_duration_ms, p95_duration_ms FROM lake.gold.service_hourly "
                "WHERE event_date = CAST(? AS DATE) AND environment = ? "
                "ORDER BY hour, service_id LIMIT 2401",
                [day.isoformat(), environment],
            )
            columns = [column[0] for column in cursor.description]
            rows = [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]
            for row in rows:
                row["hour"] = row["hour"].isoformat()
            cursor.execute('SELECT max(committed_at) FROM lake.gold."service_hourly$snapshots"')
            committed_at = cursor.fetchone()[0]
            return {
                "day": day.isoformat(),
                "environment": environment,
                "hourly_metrics": rows[:2400],
                "truncated": len(rows) > 2400,
                "aggregated_at": committed_at.isoformat() if committed_at else None,
                "source": "Trino:lake.gold.service_hourly",
            }
        finally:
            connection.close()
