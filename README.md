<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AeroFlow AI OS — Knowledge Base UI

Enterprise Knowledge Operations Center for RAG orchestration. Manages document ingestion, chunking, embedding, conflict resolution, policy management, and graph-based retrieval across Bronze / Silver / Gold data layers.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite (port 3000) |
| Backend | FastAPI + Python 3.13 (port 8000) |
| Database | PostgreSQL 16 (internal only) |
| Vector DB | Qdrant (internal only) |
| Graph DB | Neo4j (internal only) |

---

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

---

## Service URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

> PostgreSQL, Qdrant, and Neo4j are internal to the Docker network and not accessible from the host.

---

## Rebuild after code changes

```bash
# Rebuild and restart backend only
docker compose build backend && docker compose up -d backend

# Rebuild and restart frontend only
docker compose build frontend && docker compose up -d frontend

# Rebuild everything
docker compose build && docker compose up -d
```

---

## Reset the database

```bash
# Stop containers and remove volumes (wipes all data)
docker compose down -v

# Start fresh and re-seed
docker compose up -d
docker exec aeroflow-backend bash -c "cd /app && python testing/mockdata/seed.py"
```

---

## Run Locally (without Docker)

**Prerequisites:** Node.js, Python 3.13, running PostgreSQL / Qdrant / Neo4j instances

### Frontend

```bash
npm install
npm run dev          # Vite dev server on port 3000
npm run lint         # TypeScript type check
npm run build        # Production build
```

### Backend

```bash
pip install -e .
cd server
uvicorn main:app --reload --port 8000
```

Set environment variables before starting the backend:

```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=aeroflow
POSTGRES_PASSWORD=password
POSTGRES_DB=aeroflow_kb
QDRANT_HOST=localhost
QDRANT_PORT=6333
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
```

---

## Project Structure

```
├── src/                        # React frontend
│   ├── components/knowledge/   # Knowledge Operations Center UI
│   │   ├── KnowledgeOpsCenter.tsx
│   │   ├── fleet/              # Pipeline health dashboard
│   │   ├── inventory/          # Asset browser (Bronze/Silver/Gold)
│   │   ├── knowledge-hub/      # GraphRAG view (DB / Qdrant / Neo4j)
│   │   ├── conflicts/          # Conflict resolution queue
│   │   ├── policy/             # Filter & extraction policies
│   │   ├── ingest/             # Ingestion wizard
│   │   └── warehouse/          # Warehouse connection wizard
│   └── lib/
│       └── mockApi.ts          # API client (talks to backend on port 8000)
│
├── server/                     # FastAPI backend
│   ├── main.py                 # App entry point
│   ├── router.py               # All API routes
│   └── basemodel/              # Pydantic request/response models
│
├── services/
│   ├── database_connector/     # PostgreSQL / Qdrant / Neo4j clients
│   └── parse_for_ui/           # DB → UI data transformation layer
│
├── database/
│   └── Postgres/init.sql       # Schema definition
│
├── testing/
│   └── mockdata/seed.py        # Database seeder
│
├── docker-compose.yml          # Full stack orchestration
├── Dockerfile                  # Backend image
└── Dockerfile.frontend         # Frontend image (nginx)
```
