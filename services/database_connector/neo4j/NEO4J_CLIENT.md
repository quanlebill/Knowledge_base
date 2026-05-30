# Neo4j DB Client

All functions are `async` and return a `ResponseModel` — either `Success(data=...)` or `Error(code=..., error=...)`.

The client wraps `neo4j.AsyncGraphDatabase` and provides 3 functions:

| Function | Purpose |
|---|---|
| `add_node` | Create a labelled node with properties and optional embedding |
| `add_relationship` | Create a typed relationship between two existing nodes |
| `graph_expand` | BFS/DFS expansion from a start node with optional cosine re-ranking |

---

## Shared types

### `NodePayload`

Core metadata stored as properties on every node.

| Field | Type | Description |
|---|---|---|
| `block_id` | UUID | Source text block (`KBTextBlock.block_id`) |
| `tenant_id` | UUID | Owning tenant |
| `data_id` | UUID | Source document (`KBData.data_id`) |
| `description` | str | Human-readable description of the node concept |

### `RelationshipDirection`

| Value | Cypher pattern |
|---|---|
| `">"` | `(a)-[r]->(b)` outgoing from `from_node` |
| `"<"` | `(a)<-[r]-(b)` incoming to `from_node` |
| `""` | `(a)-[r]-(b)` undirected |

---

## `add_node(item)`

Creates a new labelled node in Neo4j. A UUID `id` is auto-generated server-side and stored as a node property.

**Node label** must be a valid identifier: letters, digits, and underscores only — no spaces or special characters.

**Returns:** `Success(data={"id": "<uuid>"})`.

### Fields

| Field | Type | Required |
|---|---|---|
| `node` | `NodeData` | Yes |

#### `NodeData`

| Field | Type | Required | Notes |
|---|---|---|---|
| `label` | str | Yes | Neo4j node label, e.g. `"Entity"`, `"Concept"` |
| `properties` | `NodePayload` | Yes | See above |
| `embedding` | `list[float]` | No | Vector stored on the node for similarity queries |

### Example — node without embedding

```python
await add_node({
    "node": {
        "label": "Entity",
        "properties": {
            "block_id":   "ccc00000-0000-0000-0000-000000000003",
            "tenant_id":  "550e8400-e29b-41d4-a716-446655440000",
            "data_id":    "ddd00000-0000-0000-0000-000000000004",
            "description": "Q3 FY2025 revenue figure"
        }
    }
})
# → Success(data={"id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"})
```

### Example — node with embedding vector

```python
await add_node({
    "node": {
        "label": "Concept",
        "properties": {
            "block_id":   "ccc00000-0000-0000-0000-000000000010",
            "tenant_id":  "550e8400-e29b-41d4-a716-446655440000",
            "data_id":    "ddd00000-0000-0000-0000-000000000004",
            "description": "EBITDA margin improvement"
        },
        "embedding": [0.12, 0.45, 0.33, ..., 0.88]   # must match model vector size
    }
})
```

---

## `add_relationship(item)`

Creates a `RELATED_TO` relationship between two existing nodes identified by their `id` property.

A `type` string is stored as a property on the relationship to distinguish relationship kinds (e.g. `"MENTIONS"`, `"CONTRADICTS"`, `"SUPPORTS"`).

**Returns:** `Success(data={"type": "<relationship_type>"})` or `Error(404)` if either node is not found.

### Fields

| Field | Type | Required |
|---|---|---|
| `from_node_id` | str (UUID) | Yes |
| `to_node_id` | str (UUID) | Yes |
| `relationship` | `RelationshipData` | Yes |

#### `RelationshipData`

| Field | Type | Required | Default |
|---|---|---|---|
| `type` | str | Yes | Semantic label, e.g. `"MENTIONS"` |
| `properties` | `dict[str, Any]` | No | Extra key-value properties on the edge |
| `direction` | `">"` \| `"<"` \| `""` | No | `">"` (outgoing) |

### Example — outgoing relationship

```python
await add_relationship({
    "from_node_id": "aaaaaaaa-0000-0000-0000-000000000001",
    "to_node_id":   "bbbbbbbb-0000-0000-0000-000000000002",
    "relationship": {
        "type":      "MENTIONS",
        "direction": ">",
        "properties": {
            "confidence": 0.92,
            "source":     "extraction_v2"
        }
    }
})
# → Success(data={"type": "MENTIONS"})
```

### Example — undirected relationship

```python
await add_relationship({
    "from_node_id": "aaaaaaaa-0000-0000-0000-000000000001",
    "to_node_id":   "cccccccc-0000-0000-0000-000000000003",
    "relationship": {
        "type":      "CO_OCCURS",
        "direction": ""
    }
})
```

---

## `graph_expand(item)`

Traverses the graph outward from a start node up to `max_hops` edges and returns the `max_neighbours` closest neighbours.

If `query_vector` is provided, neighbours that have an `embedding` property are re-ranked by cosine similarity to that vector. Neighbours without embeddings receive a similarity score of `0.0`.

**Returns:** `Success(data=[{"node": {...}, "similarity": float}, ...])` ordered by similarity descending.

### Fields

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `start_node_id` | str (UUID) | Yes | — | `id` property of the start node |
| `max_hops` | int | No | `1` | Maximum traversal depth (BFS radius) |
| `max_neighbours` | int | No | `10` | Maximum results returned |
| `query_vector` | `list[float]` | No | `null` | Embedding for cosine re-ranking |

### Example — 1-hop expansion, no re-ranking

```python
await graph_expand({
    "start_node_id":  "aaaaaaaa-0000-0000-0000-000000000001",
    "max_hops":       1,
    "max_neighbours": 5
})
# → Success(data=[
#     {"node": {"id": "bbb...", "description": "...", ...}, "similarity": 0.0},
#     ...
# ])
```

### Example — 2-hop expansion with semantic re-ranking

```python
await graph_expand({
    "start_node_id":  "aaaaaaaa-0000-0000-0000-000000000001",
    "max_hops":       2,
    "max_neighbours": 20,
    "query_vector":   [0.21, 0.53, ..., 0.14]   # query embedding from retrieval pipeline
})
# → Success(data=[
#     {"node": {"id": "ddd...", "description": "EBITDA...", ...}, "similarity": 0.94},
#     {"node": {"id": "eee...", "description": "Revenue...", ...}, "similarity": 0.87},
#     ...
# ])
```

---

## Node label rules

Labels are validated against the regex `^[A-Za-z_][A-Za-z0-9_]*$` before the Cypher query is executed. Invalid labels return `Error(code=400)` immediately.

| Valid | Invalid |
|---|---|
| `Entity` | `My Entity` (space) |
| `Concept_v2` | `123Node` (starts with digit) |
| `KnowledgeChunk` | `node-type` (hyphen) |

---

## Error responses

| Code | Meaning |
|---|---|
| `400` | Invalid node label (fails identifier regex) |
| `404` | One or both nodes not found during `add_relationship` |
| `422` | Pydantic validation failed — missing required field or wrong type |
