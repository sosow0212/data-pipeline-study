from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("dependency-warmup").getOrCreate()
spark.stop()
