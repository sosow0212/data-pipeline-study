from pyspark.sql.types import IntegerType, LongType, StringType, StructField, StructType

EVENT_SCHEMA = StructType(
    [
        StructField("event_id", StringType()),
        StructField("schema_version", IntegerType()),
        StructField("occurred_at", StringType()),
        StructField("service_id", StringType()),
        StructField("environment", StringType()),
        StructField("level", StringType()),
        StructField("endpoint", StringType()),
        StructField("status_code", IntegerType()),
        StructField("duration_ms", LongType()),
        StructField("trace_id", StringType()),
        StructField("user_id", StringType()),
        StructField("message", StringType()),
    ]
)
