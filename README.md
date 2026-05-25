<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AeroFlow AI OS

A multi-tenant Enterprise AI Operating System for RAG orchestration, agentic workflows, and industry intelligence.

Built with **React 19 + TypeScript + Vite**, with a unified Express mock API server for local development.

---

## Features

- **Knowledge Operations** — Bronze → Silver → Gold data pipeline, document ingestion, semantic chunking, table extraction, warehouse connections (Snowflake, Databricks)
- **AI Runtime** — Agent registry, orchestration, and execution tracing
- **Graph & Knowledge** — GraphRAG visualization, Gold-layer knowledge management with version control
- **Release Management** — Deployment pipelines, environment drift detection, rollback
- **Governance** — Compliance auditing, policy enforcement, PII access logs
- **Settings** — Auth (Keycloak / Kong), API keys, secrets vault, IP allowlist, billing

---

## Running Locally

**Prerequisites:** Node.js 20+

### 1. Install dependencies

```bash
npm install
```

### 2. Start the mock API server

The mock server serves all backend data (documents, agents, deployments, knowledge graph, etc.) on port **4000**.

```bash
npm run mock:server
```

### 3. Start the frontend

In a separate terminal:

```bash
npm run dev
```

Open **http://localhost:3000** — the app starts in demo mode automatically (no login required).

> `GEMINI_API_KEY` is optional. The app runs fully in mock mode without it. If you want Gemini AI features, add your key to `.env.local`:
> ```
> GEMINI_API_KEY=your_key_here
> ```

---

## Running with Docker

The Docker image runs both the frontend and the mock API server in a single container. No environment variables required — demo mode and API bypass are enabled by default.

### Build

```bash
docker build -t aeroflow .
```

### Run

```bash
docker run -p 3000:3000 -p 4000:4000 aeroflow
```

Open **http://localhost:3000**.

### With a real Gemini API key (optional)

```bash
docker run -p 3000:3000 -p 4000:4000 -e GEMINI_API_KEY=your_key aeroflow
```

---

## Project Structure

```
├── src/
│   ├── main.tsx                    # Entry point — AuthProvider wraps App
│   ├── App.tsx                     # Module router
│   ├── AppStateContext.tsx          # Global state (role, tenant, navigation)
│   ├── lib/
│   │   ├── AuthProvider.tsx        # Auth context — demo bypass enabled by default
│   │   ├── mockApi.ts              # HTTP client pointing to mock server (port 4000)
│   │   └── keycloak.ts             # Keycloak singleton (preserved for production)
│   ├── components/
│   │   ├── knowledge/              # Knowledge ops (ingestion, inventory, graph, warehouse)
│   │   ├── Settings/               # Auth, API keys, secrets, billing
│   │   ├── AgentRegistry/          # Agent CRUD and provisioning
│   │   ├── DeploymentCenter/       # Environment management, drift detection
│   │   ├── WorkflowEngine/         # Workflow builder and execution
│   │   └── shared/                 # Reusable UI components
│   ├── constants/                  # Static mock data for development
│   └── types/                      # TypeScript interfaces
├── testing/
│   ├── server.js                   # Unified Express mock server (port 4000)
│   └── data/                       # JSON data files loaded by mock server
├── infra/
│   ├── keycloak/                   # Realm config export
│   ├── kong/                       # Kong gateway setup scripts
│   └── sql/                        # PostgreSQL schema (auth, audit, compliance)
├── docs/                           # Architecture and API contract documentation
├── Dockerfile                      # Runs frontend + mock server in one container
└── .env.example                    # Environment variable reference
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run mock:server` | Start Express mock API server on port 4000 |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | TypeScript type check |
| `npm run preview` | Preview production build locally |

---

## Authentication

The app ships with **demo mode enabled by default** — no Keycloak or SSO setup needed for local development.

For production deployment with real authentication, the stack supports:
- **Keycloak 24** (OIDC/SAML identity provider)
- **Kong 3.6** (JWT verification, rate limiting, IP restriction)
- **PostgreSQL 16** (multi-tenant schema, audit logs)

See [`docs/auth-setup-guide.md`](docs/auth-setup-guide.md) for the full setup guide.

---

## API Contracts

All mock endpoints are documented in [`docs/api-contracts.md`](docs/api-contracts.md). This serves as the contract between the frontend and the backend team.
