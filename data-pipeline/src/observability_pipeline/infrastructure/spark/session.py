import os

from pyspark.sql import SparkSession


def create_session() -> SparkSession:
    settings = {
        "spark.sql.extensions": "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions",
        "spark.sql.catalog.lake": "org.apache.iceberg.spark.SparkCatalog",
        "spark.sql.catalog.lake.type": "rest",
        "spark.sql.catalog.lake.uri": os.getenv("POLARIS_URI", "http://polaris:8181/api/catalog"),
        "spark.sql.catalog.lake.warehouse": "ops",
        "spark.sql.catalog.lake.credential": "root:ops-lab-secret",
        "spark.sql.catalog.lake.oauth2-server-uri": (
            "http://polaris:8181/api/catalog/v1/oauth/tokens"
        ),
        "spark.sql.catalog.lake.rest.auth.type": "oauth2",
        "spark.sql.catalog.lake.scope": "PRINCIPAL_ROLE:ALL",
        "spark.sql.catalog.lake.io-impl": "org.apache.iceberg.aws.s3.S3FileIO",
        "spark.sql.catalog.lake.s3.endpoint": "http://objectstore:9000",
        "spark.sql.catalog.lake.s3.path-style-access": "true",
        "spark.sql.catalog.lake.s3.access-key-id": "ops-lab",
        "spark.sql.catalog.lake.s3.secret-access-key": "ops-lab-secret",
        "spark.sql.catalog.lake.client.region": "us-east-1",
        "spark.sql.session.timeZone": "UTC",
        "spark.sql.shuffle.partitions": "4",
    }
    builder = SparkSession.builder.appName("ops-lab-pipeline").master("local[2]")
    for key, value in settings.items():
        builder = builder.config(key, value)
    spark = builder.getOrCreate()
    spark.sparkContext.setLogLevel("WARN")
    return spark
