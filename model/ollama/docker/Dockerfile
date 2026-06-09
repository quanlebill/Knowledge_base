# Multi-stage build — toolchain stays in the builder, runtime image is slim.
#
# CPU (default):
#   docker build -t kb-llama-cpu .
#
# GPU (NVIDIA CUDA 12.2):
#   docker build \
#     --build-arg GPU=1 \
#     --build-arg BUILDER_BASE=nvidia/cuda:12.2.2-devel-ubuntu22.04 \
#     --build-arg RUNTIME_BASE=nvidia/cuda:12.2.2-runtime-ubuntu22.04 \
#     -t kb-llama-gpu .

ARG GPU=0
ARG BUILDER_BASE=python:3.11-slim
ARG RUNTIME_BASE=python:3.11-slim

# ─── Stage 1: builder ────────────────────────────────────────────────────────
# Compiles llama-cpp-python + collects every wheel into /wheels.
# Nothing from this stage ships in the final image except /wheels.

FROM ${BUILDER_BASE} AS builder
ARG GPU
WORKDIR /build

# CUDA bases lack Python; python:3.11-slim already has it.
# OpenBLAS dev headers are only needed for the CPU build path.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        ca-certificates && \
    if ! command -v python3 >/dev/null 2>&1; then \
        apt-get install -y --no-install-recommends \
            python3.11 python3-pip python3.11-dev && \
        update-alternatives --install /usr/bin/python  python  /usr/bin/python3.11 1 && \
        update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1; \
    fi && \
    if [ "$GPU" = "0" ]; then \
        apt-get install -y --no-install-recommends libopenblas-dev; \
    fi && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Produce wheels for llama-cpp-python (CPU: compile from source with OpenBLAS,
# GPU: pull the prebuilt CUDA wheel) plus everything in requirements.txt.
RUN if [ "$GPU" = "1" ]; then \
        pip wheel --no-cache-dir --no-deps --wheel-dir /wheels \
            "https://github.com/abetlen/llama-cpp-python/releases/download/v0.3.28-cu122/llama_cpp_python-0.3.28-py3-none-linux_x86_64.whl" && \
        pip wheel --no-cache-dir --wheel-dir /wheels \
            diskcache jinja2 numpy typing_extensions; \
    else \
        CMAKE_ARGS="-DGGML_BLAS=ON -DGGML_BLAS_VENDOR=OpenBLAS" \
        pip wheel --no-cache-dir --wheel-dir /wheels llama-cpp-python; \
    fi && \
    pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# ─── Stage 2: runtime ────────────────────────────────────────────────────────
# Only ship Python + the runtime shared libs + the prebuilt wheels.
# No compilers, no header packages, no pip cache, no apt lists.

FROM ${RUNTIME_BASE} AS runtime
ARG GPU
WORKDIR /app

RUN apt-get update && \
    if ! command -v python3 >/dev/null 2>&1; then \
        apt-get install -y --no-install-recommends \
            python3.11 python3-pip && \
        update-alternatives --install /usr/bin/python  python  /usr/bin/python3.11 1 && \
        update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1; \
    fi && \
    if [ "$GPU" = "0" ]; then \
        apt-get install -y --no-install-recommends libopenblas0 libgomp1; \
    fi && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/*.whl && rm -rf /wheels /root/.cache

COPY . .

VOLUME ["/models"]

ENV MODEL_PATH=/models/model.gguf \
    N_CTX=4096 \
    N_GPU_LAYERS=0 \
    N_THREADS=8 \
    KV_CACHE_TYPE=f16 \
    USE_MMAP=true \
    USE_MLOCK=false \
    VERBOSE=false \
    POOL_SIZE=1 \
    OMP_NUM_THREADS=8 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 11434

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:11434/health')"

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "11434"]
