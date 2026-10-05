FROM ghcr.io/astral-sh/uv:0.8.22 AS uv
FROM python:3.12-slim
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY agent/pyproject.toml agent/pyproject.toml
COPY agent/src agent/src
COPY data-pipeline/pyproject.toml data-pipeline/pyproject.toml
COPY data-pipeline/src data-pipeline/src
RUN uv sync --frozen --no-dev
RUN useradd --uid 10001 --create-home app
USER app
EXPOSE 8000
CMD ["/app/.venv/bin/uvicorn", "ops_agent.bootstrap:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
