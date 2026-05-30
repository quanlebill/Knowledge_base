# Postgres DB Client

All functions are `async` and return a `ResponseModel` — either `Success(data=...)` or `Error(code=..., error=...)`.

The client exposes **5 functions**: `create`, `read`, `update`, `delete`, and `read_join`.  
The first four accept a `table_name` string as a discriminator. Valid table names are the keys of `TABLE_REGISTRY`.

---

## Valid Table Names

| Key | Primary Key | PK Strategy |
|---|---|---|
| `KBModel` | `model_id` (UUID) | uuid |
| `KBModelVersion` | `version_id` (SERIAL int) | serial |
| `KBData` | `data_id` (UUID) | uuid |
| `KBLifecycleHistory` | `history_id` (UUID) | uuid |
| `KBFilterPolicy` | `policy_id` (UUID) | uuid |
| `KBExtractionPolicy` | `policy_id` (UUID) | uuid |
| `KBConflict` | `conflict_id` (UUID) | uuid |
| `KBWarehouse` | `warehouse_id` (UUID) | uuid |
| `KBWarehouse_Config` | `config_id` (UUID) | uuid |
| `KBTable` | `table_id` (UUID) | uuid |
| `KBTextBlock` | `block_id` (UUID) | uuid |
| `KBTextBlockVersion` | `version_id` (UUID) | uuid |
| `KBTextTable` | `version_id` (UUID) | provided |
| `KBQdrantConnection` | `connection_id` (UUID) | uuid |
| `KBQdrantCollection` | `collection_id` (UUID) | uuid |
| `KBNeo4jConnection` | `connection_id` (UUID) | uuid |
| `KBNeo4jNode` | `node_id` (UUID) | uuid |
| `KBNeo4jRelationship` | `(from_node, to_node)` | provided |
| `KBEntityLookup` | `lookup_id` (UUID) | uuid |
| `KBPublishAPI` | `id` (UUID) | uuid |

---

## `create(table_name, data)`

Inserts a new row. The server auto-generates the primary key (UUID or SERIAL) and any timestamp columns.  
**Rules:** All fields without a default are required. No optional fields may be omitted unless they are genuinely nullable in the schema.

**Returns:** `Success(data={"<pk_col>": "<generated_id>"})` or `Error`.

### Format

```python
await create(table_name: str, data: dict)
```

### Examples

**KBData**
```python
await create("KBData", {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "role_id":   "660e8400-e29b-41d4-a716-446655440001",
    "name":      "Q3 Financial Report",
    "extension": "pdf",
    "language":  "english",
    "source_type": "doc",
    "added_by":  "770e8400-e29b-41d4-a716-446655440002",
    "abstract":  "Quarterly earnings summary for Q3 FY2025",
    "metadata": {
        "source_type":    "doc",
        "doc_type":       "PDF",
        "author":         "Finance Team",
        "published_date": "2025-10-01T00:00:00Z"
    },
    "current_tier": "bronze",   # optional, default "bronze"
    "path": "/uploads/q3.pdf"   # optional
})
# → Success(data={"data_id": "xxxxxxxx-..."})
```

**KBConflict**
```python
await create("KBConflict", {
    "conflict_type": "content_duplicate",
    "severity":      "high",
    "tenant_id":     "550e8400-e29b-41d4-a716-446655440000",  # optional
    "detailed_explanation": "Identical chunk detected across two documents",
    "existing_snapshot": {"chunk_id": "abc", "text": "..."},  # optional
    "incoming_snapshot": {"chunk_id": "def", "text": "..."},  # optional
})
# → Success(data={"conflict_id": "xxxxxxxx-..."})
```

**KBModelVersion** *(SERIAL pk — version_id returned from DB)*
```python
await create("KBModelVersion", {
    "model_id":       "880e8400-e29b-41d4-a716-446655440003",
    "version_number": 2,
    "config": {"vector_size": 1024, "max_tokens": 512},  # optional
    "is_active": False                                    # optional, default False
})
# → Success(data={"version_id": 7})   ← integer from SERIAL
```

**KBNeo4jRelationship** *(compound pk — both UUIDs must be provided)*
```python
await create("KBNeo4jRelationship", {
    "from_node":   "aaa00000-0000-0000-0000-000000000001",
    "to_node":     "bbb00000-0000-0000-0000-000000000002",
    "score":       0.87,         # optional
    "description": "co-occurs"   # optional
})
# → Success(data={"from_node": "aaa...", "to_node": "bbb..."})
```

---

## `read(table_name, filters)`

Fetches rows matching the given filters. All filter fields are optional unless they anchor an index (e.g. `tenant_id`).  
Supports `limit` (default `50`) and `offset` (default `0`) for pagination.

**Returns:** `Success(data=[{...}, {...}])`.

### Format

```python
await read(table_name: str, filters: dict)
```

### Examples

**KBData — filter by tenant + tier**
```python
await read("KBData", {
    "tenant_id":    "550e8400-e29b-41d4-a716-446655440000",
    "current_tier": "silver",   # optional
    "source_type":  "doc",      # optional
    "limit":  20,
    "offset":  0
})
```

**KBConflict — filter by status and severity**
```python
await read("KBConflict", {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "status":    "pending",
    "severity":  "high",
    "limit": 50
})
```

**KBTextBlockVersion — all versions for a block**
```python
await read("KBTextBlockVersion", {
    "block_id":  "ccc00000-0000-0000-0000-000000000003",
    "is_active": True   # optional — filter active version only
})
```

**KBWarehouse — list all (no required filter)**
```python
await read("KBWarehouse", {"limit": 100, "offset": 0})
```

---

## `update(table_name, data)`

Updates an existing row. The **primary key is always required** and not included in the SET clause. Only content fields need to be provided; omitted fields are unchanged.

**Returns:** `Success()` or `Error(code=404)` if the row does not exist.

### Format

```python
await update(table_name: str, data: dict)
```

### Examples

**KBData — update abstract and tier**
```python
await update("KBData", {
    "data_id":      "ddd00000-0000-0000-0000-000000000004",   # required
    "abstract":     "Updated summary after review",
    "current_tier": "silver"
})
```

**KBConflict — resolve a conflict**
```python
await update("KBConflict", {
    "conflict_id":           "eee00000-0000-0000-0000-000000000005",  # required
    "status":                "resolved",
    "resolved_by":           "770e8400-e29b-41d4-a716-446655440002",
    "resolution_instruction": "Kept incoming — newer source"
})
```

**KBFilterPolicy — toggle active**
```python
await update("KBFilterPolicy", {
    "policy_id": "fff00000-0000-0000-0000-000000000006",  # required
    "is_active": True
})
```

**KBNeo4jRelationship — both pk fields required**
```python
await update("KBNeo4jRelationship", {
    "from_node":   "aaa00000-0000-0000-0000-000000000001",  # required
    "to_node":     "bbb00000-0000-0000-0000-000000000002",  # required
    "score":       0.95,
    "description": "strongly co-occurs"
})
```

---

## `delete(table_name, data)`

Deletes the row identified by the primary key.

**Returns:** `Success()` or `Error(code=404)` if the row does not exist.

### Format

```python
await delete(table_name: str, data: dict)
```

### Examples

**Single UUID pk**
```python
await delete("KBData",       {"data_id":      "ddd00000-0000-0000-0000-000000000004"})
await delete("KBConflict",   {"conflict_id":  "eee00000-0000-0000-0000-000000000005"})
await delete("KBFilterPolicy",{"policy_id":   "fff00000-0000-0000-0000-000000000006"})
await delete("KBModelVersion",{"version_id":  7})   # integer for SERIAL pk
```

**Compound pk**
```python
await delete("KBNeo4jRelationship", {
    "from_node": "aaa00000-0000-0000-0000-000000000001",
    "to_node":   "bbb00000-0000-0000-0000-000000000002"
})
```

---

## `read_join(request)`

Executes a multi-table JOIN SELECT. The first entry in `joins_table` is the `FROM` table; every subsequent entry requires one `JoinOn` condition. Columns are returned aliased as `"TableName__column_name"` unless a custom `alias` is set.

**Returns:** `Success(data=[{...}, {...}])`.

### Format

```python
await read_join(request: dict)
```

### Request schema

| Field | Type | Required | Description |
|---|---|---|---|
| `joins_table` | `list[str]` | Yes | Ordered table names; first = FROM table. Min 2. |
| `join_on` | `list[JoinOn]` | Yes | One per join: `len == len(joins_table) - 1` |
| `selected_columns` | `list[SelectedColumn]` | Yes | Which columns to SELECT |
| `filters` | `list[WhereFilter]` | No | WHERE conditions (AND-combined) |
| `limit` | `int` | No | Default `50` |
| `offset` | `int` | No | Default `0` |
| `order_by` | `str` | No | Raw ORDER BY expression e.g. `"KBData.added_on DESC"` |

#### `JoinOn`
```
left_table    str   — table on the left side of ON
left_column   str   — column on the left side
right_table   str   — table on the right side of ON
right_column  str   — column on the right side
join_type     str   — "INNER" | "LEFT" | "RIGHT" | "FULL"   (default "INNER")
```

#### `SelectedColumn`
```
table_name    str           — must be in joins_table
column_name   str
alias         str | None    — output key name (default: "TableName__column_name")
```

#### `WhereFilter`
```
table_name    str   — must be in joins_table
column_name   str
value         Any
```

### Example — documents with their active chunk versions

```python
await read_join({
    "joins_table": ["KBData", "KBTextBlock", "KBTextBlockVersion"],
    "join_on": [
        {
            "left_table":  "KBData",
            "left_column": "data_id",
            "right_table": "KBTextBlock",
            "right_column":"owner_id",
            "join_type":   "INNER"
        },
        {
            "left_table":  "KBTextBlock",
            "left_column": "block_id",
            "right_table": "KBTextBlockVersion",
            "right_column":"block_id",
            "join_type":   "LEFT"
        }
    ],
    "selected_columns": [
        {"table_name": "KBData",             "column_name": "data_id", "alias": "doc_id"},
        {"table_name": "KBData",             "column_name": "name"},
        {"table_name": "KBTextBlock",        "column_name": "block_index"},
        {"table_name": "KBTextBlockVersion", "column_name": "content"},
        {"table_name": "KBTextBlockVersion", "column_name": "is_active"}
    ],
    "filters": [
        {"table_name": "KBData", "column_name": "tenant_id",    "value": "550e8400-e29b-41d4-a716-446655440000"},
        {"table_name": "KBData", "column_name": "current_tier", "value": "gold"},
        {"table_name": "KBTextBlockVersion", "column_name": "is_active", "value": True}
    ],
    "order_by": "KBTextBlock.block_index ASC",
    "limit":  50,
    "offset":  0
})
```

Generated SQL:
```sql
SELECT
    KBData.data_id                   AS "doc_id",
    KBData.name                      AS "KBData__name",
    KBTextBlock.block_index          AS "KBTextBlock__block_index",
    KBTextBlockVersion.content       AS "KBTextBlockVersion__content",
    KBTextBlockVersion.is_active     AS "KBTextBlockVersion__is_active"
FROM KBData
INNER JOIN KBTextBlock       ON KBData.data_id       = KBTextBlock.owner_id
LEFT  JOIN KBTextBlockVersion ON KBTextBlock.block_id = KBTextBlockVersion.block_id
WHERE KBData.tenant_id    = $1
  AND KBData.current_tier = $2
  AND KBTextBlockVersion.is_active = $3
ORDER BY KBTextBlock.block_index ASC
LIMIT $4 OFFSET $5
```

---

## Error responses

| Code | Meaning |
|---|---|
| `400` | Unknown table name |
| `400` | No fields to update |
| `404` | Row not found (update / delete) |
| `409` | Unique constraint violation (create) |
| `422` | Pydantic validation failed — missing required field or wrong type |
