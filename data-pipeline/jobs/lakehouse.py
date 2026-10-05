import argparse

from observability_pipeline.application.ingestion import run_job
from observability_pipeline.infrastructure.spark.runner import SparkLakehouseRunner
from observability_pipeline.infrastructure.spark.session import create_session

parser = argparse.ArgumentParser()
parser.add_argument("mode", choices=["batch", "stream", "metrics", "inspect"])
parser.add_argument("--path", default="/workspace/data/sample/events.jsonl")
parser.add_argument("--continuous", action="store_true")
args = parser.parse_args()
spark = create_session()
try:
    run_job(SparkLakehouseRunner(spark), args.mode, args.path, args.continuous)
finally:
    spark.stop()
