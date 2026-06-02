# Postgres Connector Guide

`services/database_connector/postgres_connector.py`

---

## Overview

All operations are **methods on `PostgresClient`**. Internal query builders (`_prepare_*`, `_orm_to_dict`, etc.) are module-level private functions — they are implementation details and should not be imported directly.

Use the module-level singleton `client` for all application code:

```python
from services.database_connector.postgres_connector import client
```

The connector exposes **6 operations**. There is no `update` — immutable insert pattern only.

| Method | Input | Purpose |
|---|---|---|
| `client.insert` | Insert model | Insert a new row |
| `client.read` | `ReadJoinRequest` | SELECT — single table or flat joined chain |
| `client.read_deep` | `SelectInLoadRequest` | SELECT with nested related data via `selectinload` |
| `client.soft_delete` | Delete model | Set `is_deleted = True` |
| `client.delete` | Delete model | Hard DELETE by record identity |
| `client.flush` | `table_name: str` | Purge all `is_deleted = True` rows from a table |

All methods return `ResponseModel(code, data, error)`.

---

## Lifecycle

```python
from services.database_connector.postgres_connector import client

# app startup
client.set_url("postgresql+asyncpg://user:pass@host:5432/dbname")
await client.open()

# optional — run as a background task
asyncio.create_task(client.health_check_loop())

# app shutdown
await client.close()
```

---

## 1. `insert`

Use the corresponding `*Insert` model for the table. `inserted_at` is auto-set at instantiation — never pass it manually.

Tables **with** `tenant_id` extend `TenantInsertModel`:
```python
from basemodel.services_databaseconnector.postgres_model import KBDataInsert
from services.database_connector.postgres_connector import client

result = await client.insert(KBDataInsert(
    tenant_id="tenant-uuid",
    role_id="role-uuid",
    name="annual_report.pdf",
    extension="pdf",
    language="en",
    source_type="doc",
    added_by="john.doe",
    abstract="Annual financial report 2024",
    doc_metadata={"source_type": "doc", "doc_type": "PDF", "author": "Finance Dept"},
    current_tier="bronze",
))
```

Tables **without** `tenant_id` extend `InsertModel`:
```python
from basemodel.services_databaseconnector.postgres_model import KBTextBlockVersionInsert

result = await client.insert(KBTextBlockVersionInsert(
    block_id="block-uuid",
    version_number=1,
    content="Parsed text content of the chunk...",
    is_active=False,
))
```

### Output
```python
# success
result.code = 200
result.data = {"data_id": "generated-uuid"}        # KBData
result.data = {"version_id": "generated-uuid"}     # KBTextBlockVersion
result.data = {"block_id": "generated-uuid"}       # KBTextBlock
# — returns only the PK field(s) of the inserted row

# failure
result.code = 409   # record already exists (unique constraint)
result.code = 400   # unregistered model
result.data = None
result.error = "..."
```

---

## 2. `read`

Flat SELECT — returns rows as dicts. Use for single-table reads or shallow joins where you need specific columns.

```python
from basemodel.services_databaseconnector.postgres_model import (
    ReadJoinRequest, SelectedColumn, WhereFilter
)
from services.database_connector.postgres_connector import client
```

### Single table — first page
```python
result = await client.read(ReadJoinRequest(
    tenant_id="tenant-uuid",
    joins_table=["KBData"],
    selected_columns=[],
    filters=[
        WhereFilter(table_name="KBData", column_name="current_tier", value="bronze"),
    ],
    limit=20,
))
```

### Single table — next page (cursor pagination)
```python
result = await client.read(ReadJoinRequest(
    tenant_id="tenant-uuid",
    joins_table=["KBData"],
    filters=[
        WhereFilter(table_name="KBData", column_name="current_tier", value="bronze"),
    ],
    limit=20,
    cursor=result.data[-1]["inserted_at"],
))
```

### Multi-table join
```python
result = await client.read(ReadJoinRequest(
    tenant_id="tenant-uuid",
    joins_table=["KBData", "KBTextBlock", "KBTextBlockVersion"],
    selected_columns=[
        SelectedColumn(table_name="KBData",             column_name="data_id"),
        SelectedColumn(table_name="KBData",             column_name="name"),
        SelectedColumn(table_name="KBTextBlock",        column_name="block_id"),
        SelectedColumn(table_name="KBTextBlock",        column_name="block_index"),
        SelectedColumn(table_name="KBTextBlockVersion", column_name="version_id"),
        SelectedColumn(table_name="KBTextBlockVersion", column_name="content"),
        SelectedColumn(table_name="KBTextBlockVersion", column_name="is_active"),
    ],
    filters=[
        WhereFilter(table_name="KBTextBlockVersion", column_name="is_active", value=True),
    ],
    limit=50,
))
```

### Output
```python
# success — single table (selected_columns=[])
result.code = 200
result.data = [
    {
        "data_id": "uuid-1",
        "name": "annual_report.pdf",
        "current_tier": "bronze",
        "tenant_id": "tenant-uuid",
        "inserted_at": "2024-01-01T00:00:00+00:00",
        ...                             # all columns from the table
    },
    ...
]

# success — multi-table join (specific selected_columns)
result.code = 200
result.data = [
    {
        "data_id": "uuid-1",           # from KBData
        "name": "annual_report.pdf",   # from KBData
        "block_id": "uuid-2",          # from KBTextBlock
        "block_index": 0,              # from KBTextBlock
        "version_id": "uuid-3",        # from KBTextBlockVersion
        "content": "parsed text...",   # from KBTextBlockVersion
        "is_active": True,             # from KBTextBlockVersion
    },
    ...                                # flat — one row per join combination
]

# failure
result.code = 400   # unknown table
result.data = None
result.error = "..."
```

### Rules
- `joins_table` — at least 1 entry; tables in chain order starting from root
- `selected_columns` — empty → `SELECT *` from all tables
- `tenant_id` — optional; applied as filter only if the root table has the column
- `cursor` — `inserted_at` value of the last row from the previous page
- `order_by` — raw SQL string e.g. `"KBData.created_at DESC"`; defaults to `inserted_at ASC`

> **Avoid deep joins on large tables** — each added table multiplies the result rows. Use `read_deep` instead.

---

## 3. `read_deep`

Nested SELECT using `selectinload` — fires separate IN queries per relationship, no row multiplication. Returns fully nested dicts.

```python
from basemodel.services_databaseconnector.postgres_model import (
    SelectInLoadRequest, WhereFilter
)
from services.database_connector.postgres_connector import client
```

### Usage
```python
result = await client.read_deep(SelectInLoadRequest(
    tenant_id="tenant-uuid",
    table="KBData",
    load_paths=[
        "KBTextBlock.KBTextBlockVersion",
        "KBLifecycleHistory",
    ],
    filters=[
        WhereFilter(table_name="KBData", column_name="current_tier", value="bronze"),
    ],
    limit=20,
))
```

### Output
```python
# success
result.code = 200
result.data = [
    {
        # KBData columns
        "data_id": "uuid-1",
        "name": "annual_report.pdf",
        "current_tier": "bronze",
        "inserted_at": "2024-01-01T00:00:00+00:00",
        ...

        # key = table name from load_paths
        "KBTextBlock": [
            {
                "block_id": "uuid-2",
                "block_index": 0,
                ...

                # key = table name from load_paths (next segment)
                "KBTextBlockVersion": [
                    {"version_id": "uuid-3", "content": "...", "is_active": True, ...},
                    {"version_id": "uuid-4", "content": "...", "is_active": False, ...},
                ]
            },
            ...
        ],

        "KBLifecycleHistory": [
            {"history_id": "uuid-5", "to_tier": "silver", ...},
        ]
    },
    ...
]

# failure
result.code = 400   # unknown table or invalid load path
result.data = None
result.error = "..."
```

### SQL fired
```sql
SELECT * FROM KBData WHERE tenant_id = ? AND ... LIMIT 20
SELECT * FROM KBTextBlock WHERE owner_id IN (uuid-1, uuid-2, ...)
SELECT * FROM KBTextBlockVersion WHERE block_id IN (uuid-2, uuid-6, ...)
SELECT * FROM KBLifecycleHistory WHERE data_id IN (uuid-1, uuid-2, ...)
```

### Rules
- `table` — root table name
- `load_paths` — dot-separated table names from root; must follow defined ORM relationships
- `tenant_id` — optional; applied as filter only if the root table has the column
- `cursor` — `inserted_at` of the last root row from the previous page
- The nested key in the output matches exactly the table name used in `load_paths`
- Use instead of `read` whenever the chain is 2+ levels deep or tables are large

---

## 4. `soft_delete`

Sets `is_deleted = True`. Fails with `400` if the table has no `is_deleted` column.

```python
from basemodel.services_databaseconnector.postgres_model import KBDataDelete
from services.database_connector.postgres_connector import client

result = await client.soft_delete(KBDataDelete(
    tenant_id="tenant-uuid",
    data_id="data-uuid",
))
```

Tables without `tenant_id`:
```python
from basemodel.services_databaseconnector.postgres_model import KBTextBlockVersionDelete

result = await client.soft_delete(KBTextBlockVersionDelete(
    version_id="version-uuid",
))
```

### Output
```python
# success
result.code = 200
result.data = None

# failure
result.code = 400   # table has no is_deleted column
result.code = 404   # record not found or already deleted
result.data = None
result.error = "..."
```

---

## 5. `delete`

Hard DELETE — permanent. All non-null fields in the model become WHERE conditions.

```python
from basemodel.services_databaseconnector.postgres_model import KBNeo4jRelationshipDelete
from services.database_connector.postgres_connector import client

result = await client.delete(KBNeo4jRelationshipDelete(
    from_node="node-uuid-a",
    to_node="node-uuid-b",
))
```

### Output
```python
# success
result.code = 200
result.data = None

# failure
result.code = 400   # unregistered model or no conditions provided
result.data = None
result.error = "..."
```

---

## 6. `flush`

Purges all rows where `is_deleted = True` from a table. Fails with `400` if the table has no `is_deleted` column.

```python
from services.database_connector.postgres_connector import client

result = await client.flush("KBData")
result = await client.flush("KBTextBlockVersion")
```

### Output
```python
# success
result.code = 200
result.data = None

# failure
result.code = 400   # unknown table or no is_deleted column
result.data = None
result.error = "..."
```

> Run as a scheduled maintenance job — not on every delete.

---

## ResponseModel

```python
class ResponseModel(BaseModel):
    code: int          # 200 OK | 400 bad input | 404 not found | 409 conflict
    data: Any = None   # insert → {pk: value} | read → list[dict] | read_deep → list[nested dict]
    error: str = None  # set on failure
```

---

## Code layout

```
postgres_connector.py
│
├── Module-level helpers (private, not for import)
│     _orm_to_dict()          — ORM row → flat dict
│     _orm_to_dict_deep()     — ORM row → nested dict (follows loaded relationships)
│     _rel_key_to()           — resolve relationship attribute name between two ORM classes
│     _build_load_option()    — build selectinload chain from dot-path string
│     _resolve()              — look up table name + ORM class from a registered model
│     _prepare_insert()       — compile INSERT from an Insert model
│     _prepare_read()         — compile SELECT from ReadJoinRequest
│     _prepare_deep_search()  — compile SELECT + selectinload from SelectInLoadRequest
│     _prepare_soft_delete()  — compile UPDATE is_deleted=True from a Delete model
│     _prepare_delete()       — compile DELETE from a Delete model
│     _prepare_flush()        — compile DELETE WHERE is_deleted=True for a table
│
├── class PostgresClient      — stateful: holds engine, session factory, health flag
│     set_url()               — configure async DSN before open()
│     open()                  — create engine, verify connection, retry on failure
│     close()                 — dispose engine gracefully
│     health_check_loop()     — background SELECT 1 loop; reconnects on failure
│     is_healthy()            — last health check result
│     is_connected()          — engine is up
│     get_client()            — returns a new AsyncSession (use as async context manager)
│     insert()                — calls _prepare_insert → session.add → commit
│     read()                  — calls _prepare_read → session.execute → mappings
│     read_deep()             — calls _prepare_deep_search → scalars + selectinload
│     soft_delete()           — calls _prepare_soft_delete → session.execute → commit
│     delete()                — calls _prepare_delete → session.execute → commit
│     flush()                 — calls _prepare_flush → session.execute → commit
│
└── client = PostgresClient() — module-level singleton; import and use directly
```

---

## Table Name Reference

Used in `joins_table`, `load_paths`, `table`, and `flush`:

| ORM Class | Table name |
|---|---|
| `KBModelORM` | `KBModel` |
| `KBModelVersionORM` | `KBModelVersion` |
| `KBDataORM` | `KBData` |
| `KBLifecycleHistoryORM` | `KBLifecycleHistory` |
| `KBFilterPolicyORM` | `KBFilterPolicy` |
| `KBExtractionPolicyORM` | `KBExtractionPolicy` |
| `KBConflictBatchORM` | `KBConflictBatch` |
| `KBConflictORM` | `KBConflict` |
| `KBWarehouseORM` | `KBWarehouse` |
| `KBWarehouseConfigORM` | `KBWarehouseConfig` |
| `KBTableORM` | `KBTable` |
| `KBTextBlockORM` | `KBTextBlock` |
| `KBTextBlockVersionORM` | `KBTextBlockVersion` |
| `KBTextTableORM` | `KBTextTable` |
| `KBQdrantConnectionORM` | `KBQdrantConnection` |
| `KBQdrantCollectionORM` | `KBQdrantCollection` |
| `KBNeo4jConnectionORM` | `KBNeo4jConnection` |
| `KBNeo4jNodeORM` | `KBNeo4jNode` |
| `KBNeo4jRelationshipORM` | `KBNeo4jRelationship` |
| `KBEntityLookupORM` | `KBEntityLookup` |
| `KBPublishAPIORM` | `KBPublishAPI` |
