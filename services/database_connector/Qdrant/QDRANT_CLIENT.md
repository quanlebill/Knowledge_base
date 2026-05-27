# Qdrant DB Client

All functions are `async` and return a `ResponseModel` — either `Success(data=...)` or `Error(code=..., error=...)`.

The client wraps `qdrant_client.AsyncQdrantClient` and provides 6 functions:

| Function | Purpose |
|---|---|
| `create_collection` | Create a new vector collection |
| `add_points` | Upsert vectors with payload into a collection |
| `update_payload` | Overwrite payload fields on specific points |
| `query_by_payload` | Scroll/filter points by payload fields |
| `delete_points` | Remove points by ID list or payload filter |
| `vector_search` | Nearest-neighbour similarity search |

---

## Shared types

### `PointPayload`

Mandatory payload attached to every point.

| Field | Type | Description |
|---|---|---|
| `tenant_id` | UUID | Owning tenant |
| `block_id` | UUID | Source text block (`KBTextBlock.block_id`) |
| `data_id` | UUID | Source document (`KBData.data_id`) |
| `summary` | str | Human-readable chunk summary |
| `entities` | `list[str]` | Named entities extracted from the chunk |
| `intents` | `list[str]` | Intent labels for the chunk |

### `MatchingPayload`

Describes a single payload filter condition.

| Field | Type | Description |
|---|---|---|
| `field` | str | Payload field name to match on |
| `values` | `list[Any]` | List of accepted values (OR within the field) |

---

## `create_collection(item)`

Creates a new Qdrant collection with a fixed vector size and distance metric.

**Returns:** `Success()` or `Error(409)` if the collection already exists.

### Fields

| Field | Type | Required | Default |
|---|---|---|---|
| `name` | str | Yes | — |
| `vector_size` | int | No | `128` |
| `distance_metric` | `"Cosine"` \| `"Euclidean"` \| `"Dot"` | No | `"Cosine"` |

### Example

```python
await create_collection({
    "name":            "kb_chunks_v1",
    "vector_size":     1536,
    "distance_metric": "Cosine"
})
```

---

## `add_points(item)`

Upserts one or more vectors into an existing collection. If a point with the same `id` already exists it is overwritten.

**Returns:** `Success()` or `Error(404)` if the collection does not exist.

### Fields

| Field | Type | Required |
|---|---|---|
| `collection_name` | str | Yes |
| `points` | `list[PointData]` | Yes |

#### `PointData`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `int \| str` | Yes | Unique point identifier within the collection |
| `vector` | `list[float]` | Yes | Must match the collection's `vector_size` |
| `payload` | `PointPayload` | Yes | See shared types above |

### Example

```python
await add_points({
    "collection_name": "kb_chunks_v1",
    "points": [
        {
            "id": 1001,
            "vector": [0.12, 0.45, ..., 0.88],   # 1536 floats
            "payload": {
                "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
                "block_id":  "ccc00000-0000-0000-0000-000000000003",
                "data_id":   "ddd00000-0000-0000-0000-000000000004",
                "summary":   "Quarterly revenue grew 12% YoY",
                "entities":  ["Q3", "FY2025", "Revenue"],
                "intents":   ["financial_report", "earnings"]
            }
        },
        {
            "id": 1002,
            "vector": [0.33, 0.71, ..., 0.05],
            "payload": {
                "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
                "block_id":  "ccc00000-0000-0000-0000-000000000099",
                "data_id":   "ddd00000-0000-0000-0000-000000000004",
                "summary":   "EBITDA margin improved to 28%",
                "entities":  ["EBITDA", "margin"],
                "intents":   ["financial_report"]
            }
        }
    ]
})
```

---

## `update_payload(item)`

Overwrites specific payload key-value pairs on a list of points. Fields not mentioned in `payload` are left unchanged.

**Returns:** `Success()` or `Error(404)` if the collection does not exist.

### Fields

| Field | Type | Required |
|---|---|---|
| `collection_name` | str | Yes |
| `point_ids` | `list[int \| str]` | Yes |
| `payload` | `dict[str, Any]` | Yes |

### Example

```python
await update_payload({
    "collection_name": "kb_chunks_v1",
    "point_ids": [1001, 1002],
    "payload": {
        "summary": "Updated: Q3 revenue +12% YoY (restated)",
        "entities": ["Q3", "FY2025", "Revenue", "Restatement"]
    }
})
```

---

## `query_by_payload(item)`

Scrolls through a collection and returns points whose payload matches one or more field conditions.

- `match_type = "must"` — **all** conditions must match (AND logic)
- `match_type = "any"` — **at least one** condition must match (OR logic)

**Returns:** `Success(data=[ScoredPoint, ...])`.

### Fields

| Field | Type | Required | Default |
|---|---|---|---|
| `collection_name` | str | Yes | — |
| `matching_payload` | `list[MatchingPayload]` | No | `null` (no filter) |
| `limit` | int | No | `10` |
| `match_type` | `"must"` \| `"any"` | No | `"must"` |

### Example — fetch all chunks for a specific tenant and data document

```python
await query_by_payload({
    "collection_name": "kb_chunks_v1",
    "matching_payload": [
        {
            "field":  "tenant_id",
            "values": ["550e8400-e29b-41d4-a716-446655440000"]
        },
        {
            "field":  "data_id",
            "values": ["ddd00000-0000-0000-0000-000000000004"]
        }
    ],
    "match_type": "must",
    "limit": 50
})
```

### Example — fetch points tagged with either of two intents

```python
await query_by_payload({
    "collection_name": "kb_chunks_v1",
    "matching_payload": [
        {
            "field":  "intents",
            "values": ["financial_report", "earnings"]
        }
    ],
    "match_type": "any",
    "limit": 20
})
```

---

## `delete_points(item)`

Deletes points from a collection. Exactly one of `point_ids` or `matching_payload` must be provided.

**Returns:** `Success()` or `Error(400)` if neither selector is given.

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `collection_name` | str | Yes | — |
| `point_ids` | `list[int \| str]` | No | Delete by explicit IDs |
| `matching_payload` | `list[MatchingPayload]` | No | Delete all points matching ALL conditions |

### Example — delete by IDs

```python
await delete_points({
    "collection_name": "kb_chunks_v1",
    "point_ids": [1001, 1002, 1003]
})
```

### Example — delete all points for a data document

```python
await delete_points({
    "collection_name": "kb_chunks_v1",
    "matching_payload": [
        {
            "field":  "data_id",
            "values": ["ddd00000-0000-0000-0000-000000000004"]
        }
    ]
})
```

---

## `vector_search(item)`

Performs an approximate nearest-neighbour search and returns scored results ranked by similarity.  
Optionally pre-filters candidates by payload before ranking.

**Returns:** `Success(data=[{"id": ..., "score": ..., "payload": {...}}, ...])`.

### Fields

| Field | Type | Required | Default |
|---|---|---|---|
| `collection_name` | str | Yes | — |
| `query_vector` | `list[float]` | Yes | Must match collection vector size |
| `limit` | int | No | `10` |
| `matching_payload` | `list[MatchingPayload]` | No | `null` (search all points) |

### Example — plain semantic search

```python
await vector_search({
    "collection_name": "kb_chunks_v1",
    "query_vector": [0.21, 0.53, ..., 0.14],   # 1536 floats from embedding model
    "limit": 5
})
```

### Example — search scoped to a tenant

```python
await vector_search({
    "collection_name": "kb_chunks_v1",
    "query_vector": [0.21, 0.53, ..., 0.14],
    "limit": 10,
    "matching_payload": [
        {
            "field":  "tenant_id",
            "values": ["550e8400-e29b-41d4-a716-446655440000"]
        }
    ]
})
```

---

## Error responses

| Code | Meaning |
|---|---|
| `400` | Neither `point_ids` nor `matching_payload` provided for delete |
| `404` | Collection does not exist |
| `404` | Unknown distance metric |
| `409` | Collection already exists |
| `422` | Pydantic validation failed — missing required field or wrong type |
