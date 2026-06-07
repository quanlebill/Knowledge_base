FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

ARG GPU=0
RUN if [ "$GPU" = "1" ]; then \
        apt-get update && apt-get install -y python3.11 python3-pip && \
        ln -s /usr/bin/python3.11 /usr/bin/python; \
    fi

COPY requirements.txt .

RUN if [ "$GPU" = "1" ]; then \
        CMAKE_ARGS="-DLLAMA_CUDA=on" pip install llama-cpp-python --no-cache-dir; \
    else \
        pip install llama-cpp-python --no-cache-dir; \
    fi

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

VOLUME ["/models"]

# Environment defaults — override with -e at runtime
ENV MODEL_PATH=/models/model.gguf \
    N_CTX=4096 \
    N_GPU_LAYERS=-1 \
    N_THREADS=8 \
    KV_CACHE_TYPE=f16 \
    VERBOSE=false

EXPOSE 11434

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:11434/health')"

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "11434"]
