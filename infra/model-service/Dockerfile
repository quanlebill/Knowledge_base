FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    fastapi \
    "uvicorn[standard]" \
    sentence-transformers \
    pydantic

# Pre-download models into the image so startup is instant
ARG EMBED_MODEL=BAAI/bge-large-en-v1.5
ARG RERANK_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
RUN python -c "from sentence_transformers import SentenceTransformer, CrossEncoder; \
    SentenceTransformer('${EMBED_MODEL}'); \
    CrossEncoder('${RERANK_MODEL}')"

COPY . .

EXPOSE 8001

CMD ["uvicorn", "app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8001"]
