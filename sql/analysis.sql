-- Silver: validated, immutable, deduplicated event facts.
SELECT service_id, count(*) AS requests,
       sum(CASE WHEN is_error THEN 1 ELSE 0 END) AS errors
FROM lake.silver.logs GROUP BY service_id ORDER BY service_id;

-- Gold: inspect the planted payment incident (UTC 12:00-14:00).
SELECT service_id, hour, requests, errors, round(error_rate * 100, 2) AS error_percent,
       round(avg_duration_ms, 1) AS avg_ms, p95_duration_ms
FROM lake.gold.service_hourly
WHERE service_id IN ('payment', 'checkout') AND environment = 'production'
ORDER BY hour, service_id;

-- Iceberg metadata: every successful write commits a snapshot.
SELECT committed_at, snapshot_id, operation FROM lake.silver."logs$snapshots" ORDER BY committed_at;

-- Raw source counts differ when identical events arrive via file and Kafka.
SELECT source, count(*) AS raw_records FROM lake.bronze.logs GROUP BY source;
SELECT count(*) AS invalid_records FROM lake.silver.quarantine;
