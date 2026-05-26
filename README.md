<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AeroFlow AI OS

A multi-tenant Enterprise AI Operating System for RAG orchestration, agentic workflows, and industry intelligence.

Built with **React 19 + TypeScript + Vite**, with a FastAPI mock server for local development.

## Running Locally
**Prerequisites:** Node.js 20+, Python 3.13+

### 1. Install dependencies

```bash
npm install
pip install -r server/requirements.txt
```

### 2. Start the mock API server

The FastAPI mock server loads all data from `testing/data/*.json` and serves it on port **8000**.

```bash
npm run mock:server
```

### 3. Start the frontend

In a separate terminal:

```bash
npm run dev
```
Open **http://localhost:3000** — the app starts in demo mode automatically (no login required).

## Running with Docker

The Docker image runs both the FastAPI mock server (port 8000) and the Vite frontend (port 3000) in a single container. No environment variables required — demo mode and API bypass are enabled by default.

### Build

```bash
docker build -t aeroflow .
```

### Run

```bash
docker run -p 3000:3000 -p 8000:8000 aeroflow
```

Open **http://localhost:3000**. The mock API is available at `http://localhost:8000/docs`.


---

## API Contracts

All mock endpoints are documented in [`docs/api-contracts.md`](docs/api-contracts.md). This serves as the contract between the frontend and the backend team.

---

## Changelog

### v0.1 — 2026-05-25

#### Added: Pydantic basemodel layer (`server/basemodel/`)

Introduced a structured Pydantic model layer that defines all request and response contracts between the API and the UI.

| File | Purpose |
| --- | --- |
| `server/basemodel/enum_type.py` | All categorical enums shared across the API |
| `server/basemodel/API_response.py` | Universal response envelope `{ code, data, error }` |
| `server/basemodel/fleet.py` | Fleet overview stats |
| `server/basemodel/conflict.py` | Conflict list, detail, and resolution contracts |
| `server/basemodel/policy.py` | Filtering and extraction policy contracts |
| `server/basemodel/knowledge.py` | Chunks, tables, warehouse configs, Qdrant, Neo4j |
| `server/basemodel/inventory.py` | Bronze / Silver / Gold document shapes and metadata variants |
| `server/basemodel/data.py` | Data upload and source type contracts |
| `server/basemodel/warehouse.py` | Warehouse connection and table selection contracts |

#### Added: FastAPI mock test server (`testing/server.py` + `server/router.py`)

Replaced the Express mock server (`testing/server.js`) with a Python-native FastAPI implementation. Assisted by Claude.

- **`server/router.py`** — defines all 48 routes and the `KBService` interface. Routes are grouped by domain (Fleet, Data, Knowledge, Qdrant, Neo4j, Conflicts, Policies). Role-based access control enforced via `X-Role` header using a `require_permission` dependency. All responses wrapped in `ResponseModel`.
- **`testing/server.py`** — `JsonKBService` implements every `KBService` method by reading `testing/data/*.json` on startup and persisting mutations back to disk. Serves as a drop-in backend for UI development and integration testing.
- **`Dockerfile`** — updated from `node:20-alpine` to `python:3.13-slim` + Node 20; runs `uvicorn` on port 8000 alongside Vite on port 3000.

Run the mock server locally:
```bash
pip install -r server/requirements.txt
npm run mock:server   # uvicorn testing.server:app --reload --port 8000
```

Or with Docker:
```bash
docker build -t aeroflow . && docker run -p 3000:3000 -p 8000:8000 aeroflow
```
