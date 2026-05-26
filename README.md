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
