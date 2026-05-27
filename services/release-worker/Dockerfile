FROM python:3.12-slim

WORKDIR /app

# Cài system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Cài Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY main.py .

EXPOSE 8100

# Chạy FastAPI + Kafka consumer
CMD ["python", "main.py"]
