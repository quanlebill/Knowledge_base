# Backend ↔ UI Integration Guide

## Overview

This guide explains how the frontend UI connects to the real FastAPI backend, which manages data in actual databases (PostgreSQL, MinIO, Qdrant, Neo4j, MongoDB).

**Key Principle:** All API calls must pass `tenant_id`, `role_id`, and `user_id` via headers so the backend can:
- Validate permissions
- Scope database queries to the tenant
- Track who performed operations

---

## Architecture

```
UI (React)
  ↓ (X-Role, X-Tenant-Id, X-User-Id headers)
FastAPI Backend (/api/*)
  ↓
Connectors (PostgreSQL, MinIO, Kafka, Qdrant, Neo4j, MongoDB)
  ↓
Real Databases
```

---

## Step 1: Initialize API Context in App

**File:** `src/App.tsx`

```typescript
import { setApiContext } from './lib/mockApi';

function AppContent() {
  const { user } = useAppState();

  useEffect(() => {
    setApiContext(
      user.role,           // 'PLATFORM_ADMIN' | 'AI_ENGINEER' | ...
      user.id,             // User identifier
      '00000000-0000-0000-0000-000000000001'  // Dev tenant ID
    );
  }, [user.role, user.id]);
}
```

This sets headers for ALL subsequent API calls:
- `X-Role: PLATFORM_ADMIN`
- `X-User-Id: user-123`
- `X-Tenant-Id: 00000000-0000-0000-0000-000000000001`

---

## Step 2: Backend Receives Context

**File:** `app/dependencies/ui_context.py`

```python
def get_ui_context(
    x_role:      str = Header(...),
    x_tenant_id: str = Header(...),
    x_user_id:   str = Header(...),
) -> dict:
    return {
        "role": x_role,
        "tenant_id": x_tenant_id,
        "user_id": x_user_id,
    }
```

---

## Step 3: Endpoints Use Context for Scoping

**File:** `app/router/knowledge/data.py`

```python
@router.get("/documents", response_model=ResponseModel)
async def list_documents_route(
    request: Request,
    ctx: dict = Depends(get_ui_context),  # ← Gets headers
):
    result = await list_documents(
        postgres=svc(request, "postgres"),
        tenant_id=ctx["tenant_id"],  # ← Scopes query to tenant
    )
    return ResponseModel(code=200, data=result)
```

---

## Step 4: Database Operations Are Tenant-Scoped

**File:** `app/pipeline/kb_ui_operation/document_ops.py`

```python
async def list_documents(postgres, tenant_id: str):
    """Returns only documents for this tenant."""
    res = await postgres.read(
        ReadJoinRequest(
            tenant_id=tenant_id,  # ← Filter by tenant
            joins_table=["KBData"],
            ...
        )
    )
    return res.data  # Only this tenant's documents
```

---

## Complete Data Flow Example: Document Upload

### 1. UI Calls Backend

**File:** `src/components/knowledge/ingest/IngestionWizard.tsx`

```typescript
const executeAddData = async () => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('role_id', user.role);
  formData.append('abstract', assetName);
  formData.append('language', 'english');
  formData.append('source_type', selectedSource);

  const res = await fetch('/api/pipeline/ingestion/bronze', {
    method: 'POST',
    headers: {
      'X-Role': user.role,                    // ← Set by setApiContext
      'X-Tenant-Id': '00000000-0000-0000-0000-000000000001',
      'X-User-Id': user.id,
    },
    body: formData,
  });
};
```

### 2. Backend Receives Upload

**File:** `app/router/knowledge/ingestion.py`

```python
@router.post("/bronze")
async def ingest_bronze(
    request: Request,
    file: UploadFile = File(...),
    role_id: str = Form(...),
    abstract: str = Form(...),
    ctx: dict = Depends(get_ui_context),  # ← Gets headers
):
    log.info("POST /bronze tenant=%s user=%s", ctx["tenant_id"], ctx["user_id"])
    
    return await svc(request, "ingestion").bronze(
        BronzeUploadRequest(
            tenant_id=ctx["tenant_id"],    # ← From header
            role_id=resolved_role_id,      # ← From form
            added_by=ctx["user_id"],       # ← From header
            file_bytes=await file.read(),
            ...
        ),
        svc(request, "minio").get_client(),
        svc(request, "postgres"),
    )
```

### 3. Pipeline Uploads to MinIO

**File:** `app/pipeline/ingestion/bronze.py`

```python
async def upload_to_bronze(
    minio: MinIOClient,
    postgres: PostgresClient,
    tenant_id: str,
    role_id: str,
    added_by: str,
    file_data: bytes,
    ...
):
    # Upload to MinIO with tenant scoping
    object_key = f"{tenant_id}/bronze/{data_id}/{filename}"
    await minio.ensure_bucket("kb-data")
    await minio.upload("kb-data", object_key, file_data)

    # Register in PostgreSQL
    kb_insert = KBDataInsert(
        tenant_id=tenant_id,      # ← Scoped to tenant
        role_id=role_id,
        added_by=added_by,        # ← Track who uploaded
        ...
    )
    data_res = await postgres.insert(kb_insert)
    
    return {
        "data_id": str(data_res.data["data_id"]),
        "name": filename,
        "path": object_key,
        "layer": "bronze",
    }
```

### 4. UI Receives Response & Updates State

```typescript
const result = await res.json();

addDocument({
  id: result.data_id,
  name: result.name,
  layer: 'BRONZE',
  ...
});
```

---

## Key Files & Services

| Layer | File | Purpose |
|-------|------|---------|
| **UI** | `src/App.tsx` | Initialize API context |
| **UI** | `src/lib/mockApi.ts` | Inject headers into all requests |
| **UI** | `src/components/*/` | Make API calls |
| **Backend** | `app/dependencies/ui_context.py` | Extract headers → context dict |
| **Backend** | `app/router/knowledge/*.py` | API endpoints (use context) |
| **Backend** | `app/pipeline/ingestion/*.py` | Business logic (scoped to tenant) |
| **Connector** | `services/database_connector/postgres_connector.py` | PostgreSQL connection |
| **Connector** | `services/database_connector/minio_connector.py` | MinIO (file storage) |
| **Connector** | `services/database_connector/kafka_connector.py` | Kafka (async jobs) |
| **Connector** | `services/database_connector/qdrant_connector.py` | Qdrant (vector DB) |
| **Connector** | `services/database_connector/neo4j_connector.py` | Neo4j (knowledge graph) |

---

## Setting Up Test Data

### Option 1: Use Dev Seed Data

**File:** `app/dev_seed.py`

Automatically runs on app startup and creates sample documents.

### Option 2: Upload via UI

1. Start the backend: `uvicorn main:app --reload`
2. Start the React dev server: `npm run dev`
3. Use the Ingestion Wizard to upload real documents
4. Data is automatically stored in PostgreSQL + MinIO

### Option 3: Database Insert (Manual)

```python
# Python script to insert test data
from sqlalchemy.ext.asyncio import create_async_engine
from app.dependencies.db_context import Base

async def seed():
    engine = create_async_engine("postgresql+asyncpg://user:pass@localhost/aeroflow_kb")
    async with engine.begin() as conn:
        # Insert documents via ORM
        doc = KBDataORM(
            data_id=uuid.uuid4(),
            tenant_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            role_id=...,
            name="Test Document",
            ...
        )
        session.add(doc)
        await session.commit()
```

---

## API Endpoints Reference

### Documents

```
GET    /api/data/documents              # List all docs for tenant
PATCH  /api/data/documents/{id}         # Promote doc (BRONZE→SILVER→GOLD)
DELETE /api/data/documents/{id}         # Delete doc
```

### Ingestion

```
POST   /api/pipeline/ingestion/bronze           # Upload file to BRONZE
POST   /api/pipeline/ingestion/promote/{id}/silver  # Queue SILVER processing
POST   /api/pipeline/ingestion/promote/{id}/gold    # Queue GOLD processing
GET    /api/pipeline/ingestion/documents/{id}/progress  # Stream progress (SSE)
```

### Knowledge Hub

```
GET    /api/knowledge/documents            # Gold-tier docs
GET    /api/knowledge/documents/{id}/chunks   # Document chunks
GET    /api/knowledge/qdrant/collections      # Vector collections
GET    /api/knowledge/neo4j/nodes             # Graph nodes
```

---

## Progress Monitoring

The backend streams progress via Server-Sent Events (SSE):

```typescript
const eventSource = new EventSource(
  '/api/pipeline/ingestion/documents/{dataId}/progress'
);

eventSource.onmessage = (event) => {
  const { status, stage, message } = JSON.parse(event.data);
  // Update UI with progress
  setProgress(stage, message);
  
  if (status === 'PUBLISHED' || status === 'FAILED') {
    eventSource.close();
  }
};
```

Backend emits events from MongoDB logs:

```python
# app/router/knowledge/ingestion.py
async def stream_progress(data_id: str, request: Request):
    mongo = svc(request, "mongo")
    
    async def generate():
        while True:
            doc = await mongo.db["kb_ingestion_logs"].find_one(
                {"data_id": data_id}
            )
            if doc:
                # Emit each log entry
                for log in doc.get("logs", []):
                    yield f"data: {json.dumps(log)}\n\n"
                
                if doc.get("status") in ["PUBLISHED", "FAILED"]:
                    return
            
            await asyncio.sleep(1)
    
    return StreamingResponse(generate(), media_type="text/event-stream")
```

---

## Troubleshooting

### "Document not found"
- Check: Tenant ID matches in database
- Check: User has permission for that role
- Solution: Use dev seed data or upload via UI

### "Missing X-Tenant-Id header"
- Check: `setApiContext()` called in `App.tsx`
- Check: User context is loaded before making API calls

### "403 Forbidden"
- Check: Role has permission for the operation
- Check: Document belongs to the tenant
- See: `src/lib/permissions.ts` for permission matrix

### Data not persisting
- Check: PostgreSQL is running
- Check: MinIO is running (for file uploads)
- Check: Database migrations ran (`alembic upgrade head`)

---

## Next Steps

1. **Verify Backend is Running**
   ```bash
   curl http://localhost:8000/api/data/documents \
     -H "X-Role: PLATFORM_ADMIN" \
     -H "X-Tenant-Id: 00000000-0000-0000-0000-000000000001" \
     -H "X-User-Id: dev-user"
   ```

2. **Load Dev Seed Data**
   - Backend loads sample data on startup
   - Check PostgreSQL: `SELECT * FROM "KBData" LIMIT 1;`

3. **Wire UI to Backend APIs**
   - Update components to call real endpoints (not mock)
   - Use `mockGet()` / `mockMutate()` from `src/lib/mockApi.ts`
   - These inject headers automatically

4. **Test Full Flow**
   - Upload document via UI
   - Monitor progress via SSE
   - Verify data in databases (PostgreSQL, MinIO)
   - Promote to SILVER (queues Kafka job)
   - Check worker processes updates
