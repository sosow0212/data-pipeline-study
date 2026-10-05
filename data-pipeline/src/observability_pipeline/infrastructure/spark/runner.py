import os

from pyspark.sql import DataFrame, SparkSession, Window
from pyspark.sql import functions as F

from observability_pipeline.infrastructure.spark.schema import EVENT_SCHEMA


class SparkLakehouseRunner:
    def __init__(self, spark: SparkSession):
        self.spark = spark

    def initialise(self):
        for namespace in ("bronze", "silver", "gold"):
            self.spark.sql(f"CREATE NAMESPACE IF NOT EXISTS lake.{namespace}")
        self.spark.sql("""
            CREATE TABLE IF NOT EXISTS lake.bronze.logs (
                source_key STRING, payload STRING, source STRING,
                kafka_partition INT, kafka_offset BIGINT, ingested_at TIMESTAMP
            ) USING iceberg TBLPROPERTIES ('format-version'='2')
        """)
        self.spark.sql("""
            CREATE TABLE IF NOT EXISTS lake.silver.logs (
                event_id STRING, schema_version INT, occurred_at TIMESTAMP,
                service_id STRING, environment STRING, level STRING, endpoint STRING,
                status_code INT, duration_ms BIGINT, trace_id STRING, user_id STRING,
                message STRING, event_date DATE, is_error BOOLEAN
            ) USING iceberg PARTITIONED BY (days(occurred_at))
            TBLPROPERTIES ('format-version'='2')
        """)
        self.spark.sql("""
            CREATE TABLE IF NOT EXISTS lake.silver.quarantine (
                source_key STRING, payload STRING, reason STRING, ingested_at TIMESTAMP
            ) USING iceberg TBLPROPERTIES ('format-version'='2')
        """)
        self.spark.sql("""
            CREATE TABLE IF NOT EXISTS lake.gold.service_hourly (
                service_id STRING, environment STRING, hour TIMESTAMP, event_date DATE,
                requests BIGINT, errors BIGINT, error_rate DOUBLE,
                avg_duration_ms DOUBLE, p95_duration_ms BIGINT
            ) USING iceberg PARTITIONED BY (event_date)
            TBLPROPERTIES ('format-version'='2')
        """)

    def _process(self, raw: DataFrame):
        # foreachBatch uses its own session; its temp views are visible in that session.
        spark = raw.sparkSession
        raw = raw.cache()
        try:
            raw.dropDuplicates(["source_key"]).createOrReplaceTempView("incoming_bronze")
            spark.sql("""
                MERGE INTO lake.bronze.logs t USING incoming_bronze s
                ON t.source_key = s.source_key WHEN NOT MATCHED THEN INSERT *
            """)
            parsed = (
                raw.withColumn("event", F.from_json("payload", EVENT_SCHEMA))
                .select("source_key", "payload", "ingested_at", "event.*")
                .withColumn("occurred_at", F.expr("try_cast(occurred_at AS TIMESTAMP)"))
            )
            valid = (
                F.col("event_id").rlike(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$")
                & (F.col("schema_version") == 1)
                & F.col("service_id").rlike(r"^[a-z][a-z0-9-]{1,63}$")
                & F.year("occurred_at").between(2000, 2100)
                & F.col("environment").isin("production", "staging")
                & F.col("level").isin("INFO", "WARN", "ERROR")
                & F.col("status_code").between(100, 599)
                & F.col("duration_ms").between(0, 3600000)
                & F.col("endpoint").startswith("/")
                & (F.length("endpoint") <= 256)
                & (F.length(F.trim("message")) > 0)
                & (F.length("message") <= 4096)
                & (F.length(F.coalesce("trace_id", F.lit(""))) <= 128)
                & (F.length(F.coalesce("user_id", F.lit(""))) <= 128)
            )
            invalid = (
                parsed.filter(~F.coalesce(valid, F.lit(False)))
                .select(
                    "source_key",
                    "payload",
                    F.lit("invalid_event_v1").alias("reason"),
                    "ingested_at",
                )
                .dropDuplicates(["source_key"])
            )
            invalid.createOrReplaceTempView("incoming_quarantine")
            spark.sql("""
                MERGE INTO lake.silver.quarantine t USING incoming_quarantine s
                ON t.source_key = s.source_key WHEN NOT MATCHED THEN INSERT *
            """)
            # Source offsets determine which duplicate wins inside a microbatch.
            window = Window.partitionBy("event_id").orderBy("source_key")
            clean = parsed.filter(valid).withColumn("row_number", F.row_number().over(window))
            clean = clean.filter("row_number = 1").select(*[f.name for f in EVENT_SCHEMA])
            clean = clean.withColumn("event_date", F.to_date("occurred_at")).withColumn(
                "is_error", F.col("status_code") >= 500
            )
            clean.createOrReplaceTempView("incoming_silver")
            # Events are immutable: the first accepted payload wins across retries/sources.
            spark.sql("""
                MERGE INTO lake.silver.logs t USING incoming_silver s
                ON t.event_id = s.event_id WHEN NOT MATCHED THEN INSERT *
            """)
        finally:
            raw.unpersist()

    def ingest_batch(self, path: str):
        raw = self.spark.read.text(path).select(F.col("value").alias("payload"))
        raw = raw.withColumn("source_key", F.concat(F.lit("file:"), F.sha2("payload", 256)))
        raw = (
            raw.withColumn("source", F.lit("file"))
            .withColumn("kafka_partition", F.lit(None).cast("int"))
            .withColumn("kafka_offset", F.lit(None).cast("long"))
            .withColumn("ingested_at", F.current_timestamp())
        )
        self._process(raw)

    def ingest_stream(self, continuous: bool):
        topic = "app.logs.v1"
        stream = (
            self.spark.readStream.format("kafka")
            .option("kafka.bootstrap.servers", os.getenv("KAFKA_ADDRESS", "kafka:9092"))
            .option("subscribe", topic)
            .option("startingOffsets", "earliest")
            .option("failOnDataLoss", "true")
            .option("maxOffsetsPerTrigger", "50000")
            .load()
        )
        raw = stream.select(
            F.concat_ws(":", F.col("topic"), F.col("partition"), F.col("offset")).alias(
                "source_key"
            ),
            F.col("value").cast("string").alias("payload"),
            F.lit("kafka").alias("source"),
            F.col("partition").alias("kafka_partition"),
            F.col("offset").alias("kafka_offset"),
            F.current_timestamp().alias("ingested_at"),
        )

        def consume(batch: DataFrame, _batch_id: int):
            if not batch.isEmpty():
                self._process(batch)

        writer = raw.writeStream.foreachBatch(consume).option(
            "checkpointLocation", "/checkpoints/logs-v1"
        )
        query = (
            writer.trigger(processingTime="30 seconds").start()
            if continuous
            else (writer.trigger(availableNow=True).start())
        )
        query.awaitTermination()

    def refresh_metrics(self):
        # Full recomputation keeps this small lab easy to inspect and correct for late arrivals.
        self.spark.sql("""
            INSERT OVERWRITE lake.gold.service_hourly
            SELECT service_id, environment, date_trunc('hour', occurred_at) AS hour,
                event_date, count(*) AS requests,
                sum(CASE WHEN is_error THEN 1 ELSE 0 END) AS errors,
                avg(CASE WHEN is_error THEN 1.0 ELSE 0.0 END) AS error_rate,
                avg(duration_ms) AS avg_duration_ms,
                percentile_approx(duration_ms, 0.95) AS p95_duration_ms
            FROM lake.silver.logs
            GROUP BY service_id, environment, date_trunc('hour', occurred_at), event_date
        """)

    def inspect(self):
        for table in ("bronze.logs", "silver.logs", "silver.quarantine", "gold.service_hourly"):
            self.spark.sql(
                f"SELECT '{table}' AS table_name, count(*) AS rows FROM lake.{table}"
            ).show()
        self.spark.sql(
            "SELECT committed_at, snapshot_id, operation FROM lake.silver.logs.snapshots"
        ).show()
