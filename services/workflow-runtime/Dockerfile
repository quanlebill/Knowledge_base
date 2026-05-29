FROM python:3.11.9-slim

# Pin by digest for production: python:3.11.9-slim@sha256:<digest>

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Non-root user
RUN addgroup --system app && adduser --system --ingroup app app

COPY --chown=app:app . .

USER app

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"

# Production: gunicorn -k uvicorn.workers.UvicornWorker -w 4 main:app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
