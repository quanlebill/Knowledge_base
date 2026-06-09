# Postgres Connector Guide

`services/database_connector/postgres_connector.py`

---

## Overview

All operations are **methods on `PostgresClient`**. Internal query builders (`_prepare_*`, `_orm_to_dict`, etc.) are module-level private functions — implementation details, not for direct import.

Use the module-level singleton `client` for all application code:

```python
from services.database_connector.postgres_connector import client
```

The connector exposes **7 operations**. There is no `update` — immutable insert pattern only.

| Method | Input | Purpose |
|---|---|---|
| `client.insert` | Insert model | Insert a new row |
| `client.read` | `ReadJoinRequest` | SELECT — single table or flat joined chain |
| `client.read_deep` | `SelectInLoadRequest` | SELECT with nested related data via `selectinload` |
| `client.soft_delete` | Delete model | Set `is_deleted = True` |
| `client.delete` | Delete model | Hard DELETE by record identity |
| `client.flush` | `table_name: str` | Purge all `is_deleted = True` rows from a table |
| `client.create_transaction` | — | Return a `PostgresTransaction` job queue for atomic batch writes |

All methods return `ResponseModel(code, data, error)`. `create_transaction().commit()` also returns `ResponseModel`; see [7. `create_transaction`](#7-create_transaction).

---

## Lifecycle

```python
# app startup
client.set_url("postgresql+asyncpg://user:pass@host:5432/dbname")
await client.open()

# optional — run as a background task
asyncio.create_task(client.health_check_loop())

# app shutdown
await client.close()
```

---

## Shared Query Concepts

`read` and `read_deep` both accept `filters`, `order_by`, `cursor`, and `tenant_id`. These work identically in both methods.

### WhereFilter

Filters apply to the root table. `table_name` must be one of the tables in the query.

```python
from basemodel.services_databaseconnector.postgres_model import WhereFilter, FilterOperator

WhereFilter(table_name="KBData", column_name="current_tier", value="bronze")
WhereFilter(table_name="KBData", column_name="current_tier", value="gold", operator=FilterOperator.NE)
WhereFilter(table_name="KBData", column_name="abstract",     value=None,   operator=FilterOperator.NE)  # IS NOT NULL
```

| `FilterOperator` | SQL | `None` behaviour |
|---|---|---|
| `EQ` (default) | `=` | `IS NULL` |
| `NE` | `!=` | `IS NOT NULL` |
| `GT` | `>` | — |
| `LT` | `<` | — |
| `GTE` | `>=` | — |
| `LTE` | `<=` | — |

> `NE` with `value=None` generates `IS NOT NULL`. SQLAlchemy overloads `!=` on column expressions so it never emits the broken `!= NULL`.

### OrderBy

```python
from basemodel.services_databaseconnector.postgres_model import OrderBy, OrderDirection

OrderBy(table_name="KBData", column="inserted_at", order=OrderDirection.DESC)
```

- `table_name` must be one of the tables in the query; `column` must exist on that table. An invalid value returns `400` before the query runs.
- When omitted, defaults to `inserted_at ASC` on the root table.

### Cursor pagination

Pass `cursor=<inserted_at value>` from the last row of the previous page. Adds `WHERE inserted_at > cursor` on the root table.

```python
page2 = await client.read(ReadJoinRequest(
    ...,
    cursor=page1.data[-1]["inserted_at"],
))
```

### tenant_id

When provided, adds `WHERE tenant_id = <value>` on the root table. Omit for tables that have no `tenant_id` column.

---

## 1. `insert`

Use the `*Insert` model for the target table. `inserted_at` is auto-set — never pass it manually.

Tables **with** `tenant_id` extend `TenantInsertModel`:
```python
from basemodel.services_databaseconnector.postgres_model import KBDataInsert

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
# success — returns only the PK field(s) of the inserted row
result.code = 200
result.data = {"data_id": "generated-uuid"}     # KBData
result.data = {"version_id": "generated-uuid"}  # KBTextBlockVersion
result.data = {"block_id": "generated-uuid"}    # KBTextBlock

# failure
result.code = 409   # unique constraint violated
result.code = 400   # unregistered model
```

---

## 2. `read`

Flat SELECT — returns rows as plain dicts. Use for single-table reads or shallow joins where you need specific columns.

```python
from basemodel.services_databaseconnector.postgres_model import (
    ReadJoinRequest, SelectedColumn, WhereFilter, OrderBy, OrderDirection, FilterOperator
)
```

### Single table
```python
result = await client.read(ReadJoinRequest(
    tenant_id="tenant-uuid",
    joins_table=["KBData"],
    filters=[
        WhereFilter(table_name="KBData", column_name="current_tier", value="bronze"),
    ],
    limit=20,
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
    order_by=OrderBy(table_name="KBData", column="inserted_at", order=OrderDirection.DESC),
    limit=50,
))
```

### Output
```python
# success — selected_columns=[] → all columns across all tables
result.code = 200
result.data = [{"data_id": "uuid-1", "name": "...", "current_tier": "bronze", ...}, ...]

# success — specific selected_columns → flat row per join combination
result.data = [{"data_id": "uuid-1", "name": "...", "block_id": "uuid-2", "content": "...", ...}, ...]

# failure
result.code = 400   # unknown table or invalid order_by
```

### Fields
- `joins_table` — at least 1 entry; list tables in join order starting from the root
- `selected_columns` — omit for `SELECT *`; specify columns explicitly when join produces ambiguous names
- `cursor`, `order_by`, `tenant_id`, `filters` — see [Shared Query Concepts](#shared-query-concepts)

> Each added join table multiplies result rows. Prefer `read_deep` for chains 2+ levels deep or large tables.

---

## 3. `read_deep`

Nested SELECT via `selectinload` — fires a separate IN query per relationship rather than joining. Returns fully nested dicts with no row multiplication.

```python
from basemodel.services_databaseconnector.postgres_model import (
    SelectInLoadRequest, WhereFilter, OrderBy, OrderDirection, FilterOperator
)
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
        WhereFilter(table_name="KBData", column_name="abstract", value=None, operator=FilterOperator.NE),
    ],
    order_by=OrderBy(table_name="KBData", column="inserted_at", order=OrderDirection.DESC),
    limit=20,
))
```

### Output
```python
result.code = 200
result.data = [
    {
        "data_id": "uuid-1",
        "name": "annual_report.pdf",
        ...
        "KBTextBlock": [                    # key = table name from load_paths
            {
                "block_id": "uuid-2",
                ...
                "KBTextBlockVersion": [     # key = next segment in the dot-path
                    {"version_id": "uuid-3", "content": "...", "is_active": True, ...},
                ]
            }
        ],
        "KBLifecycleHistory": [
            {"history_id": "uuid-5", "to_tier": "silver", ...}
        ]
    },
    ...
]

# failure
result.code = 400   # unknown table, invalid load path, or invalid order_by
```

### SQL fired
```sql
SELECT * FROM "KBData" WHERE tenant_id = ? AND ... ORDER BY ... LIMIT 20
SELECT * FROM "KBTextBlock" WHERE owner_id IN (uuid-1, uuid-2, ...)
SELECT * FROM "KBTextBlockVersion" WHERE block_id IN (uuid-2, uuid-6, ...)
SELECT * FROM "KBLifecycleHistory" WHERE data_id IN (uuid-1, uuid-2, ...)
```

### Fields
- `table` — root table name
- `load_paths` — dot-separated table names following ORM relationships; the nested key in the output matches each segment exactly
- `cursor`, `order_by`, `tenant_id`, `filters` — see [Shared Query Concepts](#shared-query-concepts)

---

## 4. `soft_delete`

Sets `is_deleted = True`. Only works on tables that have an `is_deleted` column. `read` automatically excludes soft-deleted rows on the root table.

```python
from basemodel.services_databaseconnector.postgres_model import KBDataDelete, KBTextBlockVersionDelete

result = await client.soft_delete(KBDataDelete(tenant_id="tenant-uuid", data_id="data-uuid"))
result = await client.soft_delete(KBTextBlockVersionDelete(version_id="version-uuid"))
```

### Output
```python
result.code = 200   # success
result.code = 400   # table has no is_deleted column
result.code = 404   # record not found or already deleted
```

---

## 5. `delete`

Hard DELETE — permanent. All non-null fields on the model become WHERE conditions.

```python
from basemodel.services_databaseconnector.postgres_model import KBDataDelete

result = await client.delete(KBDataDelete(
    tenant_id="tenant-uuid",
    data_id="data-uuid",
))
```

### Output
```python
result.code = 200   # success
result.code = 400   # unregistered model or no fields provided to identify the record
```

---

## 6. `flush`

Permanently removes all `is_deleted = True` rows from a table. Only works on tables that have an `is_deleted` column.

```python
result = await client.flush("KBData")
```

### Output
```python
result.code = 200   # success
result.code = 400   # unknown table or no is_deleted column
```

> Run as a scheduled maintenance job — not on every delete.

---

## 7. `create_transaction`

Queue multiple insert / soft_delete / delete operations and commit them atomically. On any failure the entire batch is rolled back.

### Enum style
```python
from basemodel.services_databaseconnector.postgres_model import TransactionOp

result = await (
    client.create_transaction()
    .add(TransactionOp.INSERT,      KBDataInsert(...))
    .add(TransactionOp.SOFT_DELETE, KBFilterPolicyDelete(...))
    .add(TransactionOp.DELETE,      KBTextBlockDelete(...))
    .commit()
)
```

### Plain string style
`TransactionOp` is a `str` enum so plain strings work identically:

```python
result = await (
    client.create_transaction()
    .add("insert",      KBDataInsert(...))
    .add("soft_delete", KBFilterPolicyDelete(...))
    .add("delete",      KBTextBlockDelete(...))
    .commit()
)
```

### `add(op, data)` validation

`add()` raises `ValueError` immediately if `data` is not registered or is the wrong model type for `op`:

| `TransactionOp` | Plain string | Accepted model type |
|---|---|---|
| `INSERT` | `"insert"` | `*Insert` models |
| `SOFT_DELETE` | `"soft_delete"` | `*Delete` models — sets `is_deleted = True` |
| `DELETE` | `"delete"` | `*Delete` models — permanent hard delete |

### Output

```python
# success
result.code = 200
result.data = [
    TransactionJobResult(method="insert",      table="KBData",         success=True),
    TransactionJobResult(method="soft_delete", table="KBFilterPolicy", success=True),
    TransactionJobResult(method="delete",      table="KBTextBlock",    success=True),
]

# failure — nothing was written
result.code = 400
result.error = "Transaction rolled back: ..."  # or "Validation failed: ..."
result.data = None
```

`TransactionJobResult` fields: `method: TransactionOp`, `table: str`, `success: bool`.

---

## ResponseModel

```python
class ResponseModel(BaseModel):
    code: int          # 200 OK | 400 bad input | 404 not found | 409 conflict
    data: Any = None   # insert → {pk: value} | read → list[dict] | read_deep → list[nested dict]
                       # create_transaction → list[TransactionJobResult]
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
│     _apply_op()             — apply FilterOperator to a column expression
│     _validate_order_by()    — validate table + column against REGISTRY before query build
│     _prepare_insert()       — compile INSERT from an Insert model
│     _prepare_read()         — compile SELECT from ReadJoinRequest
│     _prepare_deep_search()  — compile SELECT + selectinload from SelectInLoadRequest
│     _prepare_soft_delete()  — compile UPDATE is_deleted=True from a Delete model
│     _prepare_delete()       — compile DELETE from a Delete model
│     _prepare_flush()        — compile DELETE WHERE is_deleted=True for a table
│
├── class PostgresTransaction — job-queue for atomic batch writes; obtain via create_transaction()
│     add()                  — queue a job; validates op/model type match at call time
│     commit()               — phase 1: compile all jobs; phase 2: execute → commit or rollback
│
├── class PostgresClient      — stateful: holds engine, session factory, health flag
│     set_url()               — configure async DSN before open()
│     open()                  — create engine, verify connection, retry on failure
│     close()                 — dispose engine gracefully
│     health_check_loop()     — background SELECT 1 loop; reconnects on failure
│     is_healthy()            — last health check result
│     is_connected()          — engine is up
│     get_client()            — returns a new AsyncSession (use as async context manager)
│     create_transaction()    — returns a new PostgresTransaction
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

Used in `joins_table`, `load_paths`, `table`, `flush`, `WhereFilter.table_name`, and `OrderBy.table_name`:

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
