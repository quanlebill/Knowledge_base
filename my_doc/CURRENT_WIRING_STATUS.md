# Current Backend ↔ UI Wiring Status

## ✅ Completed

### Backend Structure
- ✅ FastAPI server with all connectors (PostgreSQL, MinIO, Kafka, Qdrant, Neo4j, MongoDB)
- ✅ `get_ui_context()` dependency extracts `X-Role`, `X-Tenant-Id`, `X-User-Id` headers
- ✅ All API routes receive `ctx: dict = Depends(get_ui_context)`
- ✅ Database operations scoped to `tenant_id`
- ✅ Service connectors fully initialized in app.py

### Ingestion Pipeline
- ✅ `POST /api/pipeline/ingestion/bronze` - Upload to MinIO + register in PostgreSQL
- ✅ `POST /api/pipeline/ingestion/promote/{id}/silver` - Queue SILVER via Kafka
- ✅ `POST /api/pipeline/ingestion/promote/{id}/gold` - Queue GOLD via Kafka
- ✅ `GET /api/pipeline/ingestion/documents/{id}/progress` - SSE stream for progress
- ✅ MongoDB ingestion logs store all processing events

### Frontend Setup
- ✅ `src/lib/mockApi.ts` - Enhanced to inject all context headers
- ✅ `setApiContext(role, userId, tenantId)` - Initialize headers on app load
- ✅ `src/App.tsx` - Calls `setApiContext()` with user context
- ✅ All `mockGet()` and `mockMutate()` calls include headers automatically

### UI Components Updated
- ✅ `src/components/knowledge/ingest/IngestionWizard.tsx` - Calls real `/api/pipeline/ingestion/bronze`
- ✅ FormData includes all required fields: file, role_id, abstract, language, source_type, doc_metadata

---

## 🔄 In Progress

### Document Workflow
- 🔄 Verify full upload flow works end-to-end
- 🔄 Test SILVER promotion (Kafka worker processes)
- 🔄 Test GOLD promotion (Kafka worker processes)
- 🔄 Monitor progress via SSE stream

### Data Consistency
- 🔄 Ensure `tenant_id` propagates through all layers
- 🔄 Verify role-based permissions work correctly
- 🔄 Check `added_by` (user_id) is recorded for all documents

---

## ⚠️ Still Needed

### Progress Monitoring UI
- ⚠️ Create a progress overlay component (bottom-right corner, appears on hover)
- ⚠️ Connect to SSE stream: `/api/pipeline/ingestion/documents/{id}/progress`
- ⚠️ Display real-time logs and progress percentage
- ⚠️ Show active ingestion items

### Asset Inventory Integration
- ⚠️ Wire `AssetInventory` to call real `/api/data/documents` endpoint
- ⚠️ Wire batch promotion to call `/api/pipeline/ingestion/promote/{id}/silver`
- ⚠️ Add progress monitoring to batch operations

### Asset Detail Workspace
- ⚠️ Wire chunk viewing to real endpoints
- ⚠️ Wire table viewing/editing to real endpoints
- ⚠️ Wire config management to real endpoints

### Conflict Workspace
- ⚠️ Verify conflict resolution APIs are wired correctly

### Knowledge Hub
- ⚠️ Wire DATABASE tab to real gold-layer documents
- ⚠️ Wire QDRANT tab to real vector collections
- ⚠️ Wire NEO4J tab to real knowledge graph

---

## Test Data

### Dev Seed Data
The backend automatically creates sample documents via `app/dev_seed.py`:
- Run on app startup
- Creates diverse document types (PDF, WEB, IMAGE, VIDEO)
- Uses dev tenant ID

### Real Upload Path
1. Use Ingestion Wizard to upload actual files
2. Documents are stored in:
   - **PostgreSQL**: `KBData` table with all metadata
   - **MinIO**: `/tenant-id/bronze/doc-id/filename`
   - **MongoDB**: `kb_ingestion_logs` collection with processing logs

---

## How to Test

### 1. Start Backend
```bash
cd /d/Personals/Data-Agent-UI-KB
export POSTGRES_URL="postgresql+asyncpg://aeroflow:aeroflow_secret@localhost/aeroflow_kb"
export MINIO_URL="http://minioadmin:minioadmin@localhost:9000"
# ... other env vars
python -m uvicorn app.main:app --reload
```

### 2. Start Frontend
```bash
npm run dev
```

### 3. Upload Document
1. Go to Knowledge Ops → Sidebar "Add Document"
2. Select source type (PDF, Image, Video, Web)
3. Upload file
4. Click "Add Data File"
5. Monitor progress in logs

### 4. Check Database
```sql
-- PostgreSQL
SELECT id, name, current_tier, added_by FROM "KBData" ORDER BY inserted_at DESC;

-- MongoDB
db.kb_ingestion_logs.findOne({}, {sort: {updated_at: -1}});
```

### 5. Check MinIO
```bash
mc ls minio/kb-data/00000000-0000-0000-0000-000000000001/bronze/
```

---

## Files Modified

```
src/
  lib/mockApi.ts              ← Added setApiContext(), contextHeaders()
  App.tsx                     ← Initialize API context on load
  components/
    knowledge/
      ingest/
        IngestionWizard.tsx   ← Call real /api/pipeline/ingestion/bronze

docs/
  BACKEND_UI_INTEGRATION.md   ← Complete integration guide
  CURRENT_WIRING_STATUS.md    ← This file
```

---

## Next Immediate Steps

1. **Test the ingestion flow end-to-end**
   - Upload a document
   - Verify it appears in `/api/data/documents` response
   - Check PostgreSQL and MinIO have the data

2. **Create progress monitor overlay**
   - Component in `src/components/shared/IngestionProgressOverlay.tsx`
   - Subscribes to SSE stream
   - Shows real-time progress

3. **Wire AssetInventory to real APIs**
   - Replace mock data with real API calls
   - Use `mockGet('/api/data/documents')`
   - Show real documents from database

4. **Test full promotion workflow**
   - Upload → BRONZE (done)
   - Promote → SILVER (test Kafka worker)
   - Promote → GOLD (test Kafka worker)
   - Verify status changes in UI

---

## Key URLs

| Purpose | URL |
|---------|-----|
| API Base | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Upload | POST /api/pipeline/ingestion/bronze |
| List Documents | GET /api/data/documents |
| Progress Stream | GET /api/pipeline/ingestion/documents/{id}/progress |
| PostgreSQL | localhost:5432 (aeroflow_kb) |
| MinIO | localhost:9000 (admin/password) |
| MongoDB | localhost:27017 (dataagent) |
| Kafka | localhost:9092 |
| Qdrant | localhost:6333 |
| Neo4j | localhost:7687 |

---

## Debug Headers to Use

```bash
curl http://localhost:8000/api/data/documents \
  -H "X-Role: PLATFORM_ADMIN" \
  -H "X-Tenant-Id: 00000000-0000-0000-0000-000000000001" \
  -H "X-User-Id: dev-user"
```

All responses should be wrapped in:
```json
{
  "code": 200,
  "data": { ... },
  "error": null
}
```
