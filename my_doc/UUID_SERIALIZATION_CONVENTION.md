# UUID & Context Serialization Convention

## Overview

This document defines the strict convention for handling UUID serialization and context (tenant_id, user_id, role_id) across the Knowledge Base services.

---

## Core Principles

### 1. **Context IDs Never in Request Body**

| Field | Source | Transport | Serialization |
|-------|--------|-----------|---------------|
| `tenant_id` | Database UUID | Header: `X-Tenant-Id` | String in header only |
| `user_id` | String identifier | Header: `X-User-Id` | String in header only |
| `role_id` | Mapped from role | Header: `X-Role` | String in header only |

**Why?** Prevents client spoofing. Context must come from server-validated headers, never from user-submitted body.

### 2. **Other UUIDs CAN Be in Request Body**

| Field | Example | Transport | Serialization |
|-------|---------|-----------|---------------|
| Document ID | `data_id` | Body + Response | String (JSON serializable) |
| Chunk ID | `chunk_id` | Body | String (JSON serializable) |
| Table ID | `table_id` | Body | String (JSON serializable) |
| Version ID | `version_id` | Body | String (JSON serializable) |

**Why?** These are data identifiers, not security context. Clients need to reference them.

### 3. **UUID Conversion Only at Boundaries**

```
┌─────────────────────────────────────────┐
│          Internal Layer                  │
│  (Pipeline, ORM, Services)              │
│  Uses: native UUID objects              │
│  Never converts unless sending out      │
└─────────────────────────────────────────┘
          ↓ (Convert to string)
┌─────────────────────────────────────────┐
│      JSON/Serialization Layer           │
│  (API responses, database storage)      │
│  Uses: string representations           │
│  Only convert for transmission          │
└─────────────────────────────────────────┘
```

---

## Request Format (Frontend → Backend)

### ✅ Correct Pattern

```typescript
// Frontend: Send document data + metadata, NOT context
const formData = new FormData();
formData.append('file', file);
formData.append('abstract', name);        // ✅ Business data
formData.append('source_type', 'doc');    // ✅ Business data
formData.append('doc_metadata', JSON.stringify({  // ✅ Business metadata
  type: 'Doc/PDF',
  author: userName,
  published_date: '2026-06-08'
}));

// Headers auto-injected (NOT in body)
headers: {
  'X-Role': role,                         // ✅ From header only
  'X-Tenant-Id': tenantId,               // ✅ From header only
  'X-User-Id': userId,                   // ✅ From header only
}
```

### ❌ Incorrect Pattern (OLD)

```typescript
// WRONG: Sending context in body
formData.append('role_id', user.role);     // ❌ Should come from header
formData.append('tenant_id', tenantId);    // ❌ Should come from header
formData.append('user_id', userId);        // ❌ Should come from header
```

---

## Request Handling (Backend)

### ✅ Correct Pattern

```python
@router.post("/bronze")
async def ingest_bronze(
    request: Request,
    file: UploadFile = File(...),
    abstract: str = Form(...),              # ✅ From body
    source_type: str = Form(...),           # ✅ From body
    doc_metadata: str = Form("{}"),         # ✅ From body
    ctx: dict = Depends(get_ui_context),    # ✅ From headers
):
    """
    Context (tenant_id, user_id, role_id) comes from headers,
    NOT from request body. This prevents client spoofing.
    """
    # Use context from headers
    tenant_id = ctx["tenant_id"]       # ← From X-Tenant-Id header
    user_id = ctx["user_id"]           # ← From X-User-Id header
    role = ctx["role"]                 # ← From X-Role header
    
    # Map role to UUID
    resolved_role_id = resolve_role(role)  # Maps 'AI_ENGINEER' → UUID
    
    # Database insert with context from headers
    await postgres.insert(KBDataInsert(
        tenant_id=tenant_id,           # ← From headers, not body
        role_id=resolved_role_id,
        added_by=user_id,              # ← From headers, not body
        name=filename,
        source_type=source_type,       # ← From body
        abstract=abstract,             # ← From body
    ))
```

### ❌ Incorrect Pattern (OLD)

```python
# WRONG: Expecting context in form body
@router.post("/bronze")
async def ingest_bronze(
    role_id: str = Form(...),         # ❌ Should get from header
    user_id: str = Form(...),         # ❌ Should get from header
    tenant_id: str = Form(...),       # ❌ Should get from header
):
```

---

## Response Serialization (Backend → Frontend)

### ✅ Correct Pattern

```python
# ORM object (internal, native types)
doc: KBDataORM
  data_id: UUID          # Native UUID
  tenant_id: UUID        # Native UUID
  name: str
  layer: str ("bronze")

# Response serialization (convert at boundary)
response_data = {
    "data_id": str(doc.data_id),        # ✅ UUID → str (JSON)
    "tenant_id": str(doc.tenant_id),    # ✅ UUID → str (JSON) - but see caveat below
    "name": doc.name,                   # ✅ str stays str
    "layer": doc.layer,                 # ✅ str stays str (enum value)
}

# Return to frontend
return ResponseModel(code=200, data=response_data)
```

### Response Caveat: Don't Send Context IDs to Frontend Either

Actually, **reconsider including tenant_id in response**:

```python
# BETTER: Don't echo back context IDs
response_data = {
    "data_id": str(doc.data_id),        # ✅ User needs this for references
    "name": doc.name,
    "layer": doc.layer,
    "version": doc.version,
    # DON'T include tenant_id, user_id, role_id
    # Frontend already knows this from local state
}
```

**Why not echo context back?**
- Frontend already has context in AppState
- Reduces payload size
- Prevents accidental context leakage to logs/analytics
- Maintains security boundary

---

## Database Storage

### ✅ Correct Pattern

```python
# Internal ORM: native UUID types
class KBDataORM(Base):
    data_id: Mapped[uuid.UUID]      # ✅ Native UUID
    tenant_id: Mapped[uuid.UUID]    # ✅ Native UUID
    role_id: Mapped[uuid.UUID]      # ✅ Native UUID

# Database: UUID columns store UUIDs
CREATE TABLE KBData (
    data_id UUID PRIMARY KEY,       -- Native UUID type
    tenant_id UUID NOT NULL,        -- Native UUID type
    role_id UUID NOT NULL,          -- Native UUID type
    name VARCHAR(512),
    layer VARCHAR(16),
    ...
);

# String conversion ONLY during JSON serialization
# When ORM loads from DB → native UUID
# When saving to DB → native UUID (ORM handles serialization)
```

---

## Complete Example Flow

```
┌─ FRONTEND ─────────────────────────────────────────────┐
│                                                         │
│ const formData = new FormData();                       │
│ formData.append('file', file);                         │
│ formData.append('abstract', 'My Doc');                │
│ formData.append('source_type', 'doc');                │
│                                                         │
│ Headers (auto-injected by mockUpload):               │
│   X-Role: 'PLATFORM_ADMIN'                            │
│   X-Tenant-Id: '00000000-0000-0000-0000-000000000001'│
│   X-User-Id: 'user-123'                               │
└──────────────────────── ↓ ──────────────────────────────┘

┌─ TRANSPORT (HTTP POST) ─────────────────────────────────┐
│ POST /api/pipeline/ingestion/bronze                    │
│ Body: file (binary) + form fields                      │
│ Headers: X-Role, X-Tenant-Id, X-User-Id              │
└──────────────────────── ↓ ──────────────────────────────┘

┌─ BACKEND ──────────────────────────────────────────────┐
│                                                         │
│ @router.post("/bronze")                               │
│ async def ingest_bronze(                              │
│   file: UploadFile,                                   │
│   abstract: str,                                      │
│   source_type: str,                                   │
│   ctx: dict = Depends(get_ui_context)  # ← from headers│
│ ):                                                     │
│                                                         │
│ # Extract context from headers                        │
│ tenant_id = ctx["tenant_id"]  # str: '00000000-...'  │
│ user_id = ctx["user_id"]      # str: 'user-123'      │
│ role = ctx["role"]            # str: 'PLATFORM_ADMIN'│
│                                                         │
│ # Resolve role to UUID                                │
│ resolved_role_id = UUID(DEV_ROLE_PERMISSION_IDS[role])│
│                                                         │
│ # Create ORM object (native types)                    │
│ KBDataInsert(                                         │
│   data_id=UUID(...),          # native UUID           │
│   tenant_id=UUID(tenant_id),  # str → UUID (boundary) │
│   role_id=resolved_role_id,   # UUID                  │
│   added_by=user_id,           # str stays str         │
│   name=filename,              # str                   │
│   source_type=source_type,    # str                   │
│   abstract=abstract,          # str                   │
│ )                                                      │
│                                                         │
│ # Store in database (ORM serializes UUIDs)            │
│ await postgres.insert(kb_insert)                      │
│                                                         │
│ # Return response (convert UUIDs to str for JSON)     │
│ return {                                              │
│   "data_id": str(doc.data_id),    # UUID → str       │
│   "name": doc.name,               # str → str        │
│   "layer": "BRONZE",              # str → str        │
│ }                                                      │
└──────────────────────── ↓ ──────────────────────────────┘

┌─ FRONTEND ─────────────────────────────────────────────┐
│                                                         │
│ const result = await mockUpload(...);                 │
│ // result.data_id: "uuid-string"                      │
│ // result.name: "document.pdf"                        │
│ // result.layer: "BRONZE"                             │
│                                                         │
│ // No context IDs in response needed                  │
│ // Frontend already has this from AppState            │
│                                                         │
│ addDocument({                                          │
│   id: result.data_id,           # str: UUID           │
│   name: result.name,            # str                 │
│   layer: result.layer,          # str: "BRONZE"       │
│ });                                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Convention Checklist

### Frontend Components ✅

- [ ] Do NOT send `tenant_id`, `user_id`, `role_id` in request body
- [ ] Context comes from headers only (auto-injected by `mockUpload/mockGet/mockMutate`)
- [ ] Other UUIDs (document IDs, chunk IDs, table IDs) CAN be sent in body as strings
- [ ] Responses from API are strings (JSON) - use directly without conversion
- [ ] Component displays fields directly without type constructors

### Backend Endpoints ✅

- [ ] Do NOT accept `tenant_id`, `user_id`, `role_id` as Form/Query parameters
- [ ] Extract context via `ctx: dict = Depends(get_ui_context)` from headers
- [ ] Resolve role string to UUID at boundary (str → UUID conversion)
- [ ] Use context from headers for database insert
- [ ] Other UUIDs (request body) are strings - convert to native UUID at ORM insert
- [ ] Response: convert ORM UUIDs to strings only for JSON serialization

### Backend Services ✅

- [ ] Internal ORM uses native UUID types
- [ ] Pipeline operations use native UUID types internally
- [ ] Database storage is UUID type
- [ ] Conversion: string ↔ UUID only at boundaries (API ↔ ORM)

### Database Layer ✅

- [ ] ORM columns: `Mapped[uuid.UUID]` for all UUID fields
- [ ] Database schema: `UUID` column type
- [ ] No string UUIDs in database

---

## Security Implications

This convention ensures:
1. **Context cannot be spoofed** - tenant_id/user_id/role_id only from trusted headers
2. **Clear boundary** - context in headers, data in body
3. **Audit trail** - server-side header validation leaves no room for client manipulation
4. **Consistent behavior** - all endpoints follow same pattern

---

## Migration Checklist

- [x] Frontend: Remove context IDs from request bodies
  - [x] IngestionWizard.tsx - removed role_id from FormData
- [x] Backend: Remove context ID form parameters
  - [x] ingestion.py - removed role_id Form parameter, use ctx["role"] from header
- [ ] Audit all other endpoints (POST/PATCH/DELETE)
  - [ ] Verify no other endpoints accept context IDs in body
  - [ ] Update any that do
- [ ] Documentation
  - [x] Created this convention document
- [ ] Response bodies
  - [ ] Review if tenant_id should be included in responses
  - [ ] Minimize sensitive context in API responses

---

## Summary

**Context IDs (tenant_id, user_id, role_id):**
- ✅ Headers only (X-Tenant-Id, X-User-Id, X-Role)
- ❌ Never in request body
- ❌ Minimize in responses

**Other UUIDs (document_id, chunk_id, table_id, etc.):**
- ✅ Can be in request body (as strings)
- ✅ Can be in responses (as strings)
- ✅ Convert only at boundaries (string ↔ native UUID)

**Internal layers:**
- ✅ Use native UUID types
- ✅ Never convert unless transmitting

This ensures security, consistency, and clarity across all Knowledge Base services.
