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
