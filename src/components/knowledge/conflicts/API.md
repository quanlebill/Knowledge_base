# Conflicts — API Contract

---

## GET /api/knowledge/conflicts/batches

Called on mount. Returns the list of conflict batches grouped by ingestion run.

### Response

```json
[
  {
    "id": "BATCH-001",
    "name": "Ingestion Run — May 20",
    "date": "2026-05-20",
    "description": "Policy documents batch from compliance team"
  },
  {
    "id": "BATCH-002",
    "name": "Ingestion Run — May 21",
    "date": "2026-05-21",
    "description": "Legal documents from EU team"
  }
]
```

The UI shows these as a folder list under the "Pending" tab. Selecting a batch loads its conflicts.

---

## GET /api/knowledge/conflicts?status=pending&batch_id=BATCH-001

Loads individual conflicts, filtered by status and optionally by batch.

### Query params

| Param | Values | Required |
|---|---|---|
| `status` | `pending` \| `awaiting` \| `resolved` | Yes |
| `batch_id` | e.g. `BATCH-001` | Only for `pending` status |

### Response

```json
[
  {
    "conflict_id": "CFT-001",
    "tenant_id": "tenant-globalcorp",
    "conflict_type": "content_contradiction",
    "where_happens": "vector database",
    "severity": "high",
    "detected_at": "2026-05-20 14:32:00 UTC",
    "status": "pending",
    "detailed_explanation": "Two chunks assert contradictory facts about the same policy version.",
    "existing_snapshot": {
      "chunk_id": "CHUNK_01",
      "text": "Policy version 3.2 allows remote work..."
    },
    "incoming_snapshot": {
      "chunk_id": "CHUNK_07",
      "text": "Policy version 3.2 prohibits remote work..."
    },
    "affected_location": "qdrant::aeroflow_enterprise_v2::policy-nodes",
    "batch_id": "BATCH-001"
  }
]
```

### Conflict type reference

| `conflict_type` | Title | Allowed resolution methods |
|---|---|---|
| `schema` | Schema Exception | `keep_existing`, `keep_incoming` |
| `content_contradiction` | Content Contradiction | `keep_existing`, `keep_incoming` |
| `content_conflict` | Content Conflict | `keep_existing`, `keep_incoming`, `merge_custom`, `no_action` |
| `content_duplicate` | Content Duplication | `keep_existing`, `keep_incoming`, `merge_custom` |
| `content_update` | Content Update | `keep_existing`, `keep_incoming`, `no_action` |

> `merge_custom` and `no_action` are disabled for `schema` and `content_contradiction` types.

---

## PATCH /api/knowledge/conflicts/:conflictId

Resolves a conflict. Fired when the user selects a resolution method and clicks "Resolve".

### Request

```json
{
  "selected_resolution_method": "keep_incoming",
  "resolution_instruction": "The incoming version is from the latest compliance review dated 2026-05-20."
}
```

`resolution_instruction` is optional for `keep_existing` / `keep_incoming`. Required for `merge_custom`.

### Response

```json
{
  "conflict_id": "CFT-001",
  "status": "resolved",
  "resolved_at": "2026-05-25 10:00:00 UTC",
  "resolved_by": "platform-admin",
  "selected_resolution_method": "keep_incoming",
  "resolution_instruction": "..."
}
```

After success the conflict disappears from the pending list and appears under the "Resolved" tab.
