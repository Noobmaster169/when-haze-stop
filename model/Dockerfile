# The model service, as the `model` service of the compose stack. Built from this directory.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl libgomp1 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir .
# The installed package cannot see the source tree, so the committed parameters travel as a file.
COPY params.json ./params.json

RUN useradd --create-home --uid 10002 hazemodel && mkdir -p /app/artifacts /app/reports /app/data && chown hazemodel /app/artifacts /app/reports /app/data
USER hazemodel

ENV MODEL_ARTIFACTS=/app/artifacts \
    MODEL_PARAMS=/app/params.json \
    MODEL_REPORTS=/app/reports \
    MODEL_DATA=/app/data \
    PYTHONUNBUFFERED=1

EXPOSE 4002

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=6 \
    CMD curl -fsS --max-time 2 http://127.0.0.1:4002/health >/dev/null || exit 1

CMD ["hazemodel", "serve", "--host", "0.0.0.0", "--port", "4002"]
