# GTEL Data Agent

Multi-tenant AI agent platform — LangGraph + LightRAG + LiteLLM.

## Yêu cầu

- Docker + Docker Compose v2
- API keys: `GEMINI_API_KEY`, `OPENAI_API_KEY` (embedding)

## Cài đặt lần đầu

```bash
cp .env.example .env
# Điền GEMINI_API_KEY và OPENAI_API_KEY vào .env
```

## Chạy

**Local** — máy cá nhân:

```bash
docker-compose -f docker-compose.yml -f docker-compose.local.yml down
docker-compose -f docker-compose.yml -f docker-compose.local.yml up -d
```

**Dev server** — server dev chung của team:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

> `down` trước `up` để tránh lỗi network orphan khi Docker Desktop restart. Migrate + seed chạy tự động mỗi lần. Seed dùng `ON CONFLICT DO NOTHING` — không bị duplicate.

## Services

| Service | URL | Mô tả |
|---|---|---|
| workflow-runtime | http://localhost:8001 | FastAPI — LangGraph pipeline |
| LiteLLM | http://localhost:4000 | LLM gateway |
| Langfuse | http://localhost:3001 | Observability UI |
| PostgreSQL | localhost:5432 | `dataagent` / `langfuse` / `litellm` |
| MongoDB | localhost:27017 | Flow nodes/edges |
| Redis | localhost:6379 | Cache + pub/sub |

## Migration

Migrations chạy tự động khi `docker-compose up`. Để chạy tay:

```bash
cd services/workflow-runtime
alembic upgrade head        # apply tất cả migrations
alembic downgrade -1        # rollback 1 bước
alembic revision -m "tên"  # tạo migration mới
```

## Test API

```bash
# Health check
curl http://localhost:8001/health

# Chat
curl -X POST http://localhost:8001/api/conversations/run \
  -H "Content-Type: application/json" \
  -d '{"query": "xin chào", "agent_id": "00000000-0000-0000-0000-000000000030"}'

# Test LiteLLM
curl http://localhost:4000/v1/models \
  -H "Authorization: Bearer sk-dev"
```

## Dừng

```bash
docker-compose down          # giữ data
docker-compose down -v       # xóa luôn volume (reset DB)
```

---

# AeroFlow AI OS — Knowledge Base UI

Enterprise Knowledge Operations Center for RAG orchestration. Manages document ingestion, chunking, embedding, conflict resolution, policy management, and graph-based retrieval across Bronze / Silver / Gold data layers.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite (port 3000) |
| Backend | FastAPI + Python 3.13 (port 8000) |
| Database | PostgreSQL 16 (internal only) |
| Vector DB | Qdrant (internal only) |
| Graph DB | Neo4j (internal only) |

## Run with Docker (Recommended)

**Prerequisites:** Docker Desktop

### 1. Start all services

```bash
docker compose up -d
```

This starts 5 containers: `frontend`, `backend`, `postgres`, `qdrant`, `neo4j`.

### 2. Seed the database

On first run the database is empty. Seed it with sample data:

```bash
docker exec aeroflow-backend bash -c "cd /app && python testing/mockdata/seed.py"
```

> Run this once. Re-running will duplicate data — reset the volume first if needed (see below).

### 3. Open the app

```
http://localhost:3000
```

## Service URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

> PostgreSQL, Qdrant, and Neo4j are internal to the Docker network and not accessible from the host.

## Rebuild after code changes

```bash
docker compose build backend && docker compose up -d backend
docker compose build frontend && docker compose up -d frontend
docker compose build && docker compose up -d
```

## Reset the database

```bash
docker compose down -v
docker compose up -d
docker exec aeroflow-backend bash -c "cd /app && python testing/mockdata/seed.py"
```

## Run Locally (without Docker)

**Prerequisites:** Node.js, Python 3.13, running PostgreSQL / Qdrant / Neo4j instances

### Frontend

```bash
npm install
npm run dev
npm run build
```

### Backend

```bash
pip install -e .
cd server
uvicorn main:app --reload --port 8000
```

## Project Structure

```
├── src/                        # React frontend
│   ├── components/knowledge/   # Knowledge Operations Center UI
│   └── lib/
│       └── mockApi.ts
│
├── server/                     # FastAPI backend
│   ├── main.py
│   ├── router.py
│   └── basemodel/
│
├── services/
│   ├── database_connector/
│   └── parse_for_ui/
│
├── database/
│   └── Postgres/init.sql
│
├── testing/
│   └── mockdata/seed.py
│
├── docker-compose.yml
├── Dockerfile
└── Dockerfile.frontend
```
