FROM spark:4.1.3-scala2.13-java17-python3-ubuntu
USER root
RUN mkdir -p /checkpoints /opt/spark/work-dir && chmod 777 /checkpoints /opt/spark/work-dir
COPY infra/spark/warmup.py /tmp/warmup.py
RUN /opt/spark/bin/spark-submit --master 'local[1]' \
    --conf spark.jars.ivy=/opt/spark/ivy \
    --repositories https://repo.maven.apache.org/maven2 \
    --packages org.apache.iceberg:iceberg-spark-runtime-4.1_2.13:1.11.0,org.apache.iceberg:iceberg-aws-bundle:1.11.0,org.apache.spark:spark-sql-kafka-0-10_2.13:4.1.3 \
    /tmp/warmup.py && cp /opt/spark/ivy/jars/*.jar /opt/spark/jars/ && rm -rf /opt/spark/ivy
USER spark
ENV PYTHONPATH=/workspace/data-pipeline/src
ENV AWS_REGION=us-east-1
WORKDIR /workspace
ENTRYPOINT ["/opt/spark/bin/spark-submit", "--master", "local[2]", "--driver-memory", "1g"]
CMD ["/workspace/data-pipeline/jobs/lakehouse.py", "inspect"]
