import datetime
import pathlib
from operator import truediv
from typing import List, Dict, Set, Tuple, Literal, Annotated, Union
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict
import uuid
from enum_type import *

# Warehouse
class Warehouse(BaseModel):
    warehouse_name: str

class Snowflake(Warehouse):
    source_type: Literal[WarehouseType.snowflake]
    account_identifier: str
    password: str
    database: str
    schema: str
    warehouse: str
    role: str


class Databricks(Warehouse):
    source_type: Literal[WarehouseType.databricks]
    host: str
    http_path: str
    access_token: str
    catalog: str
    schema: str


# Table
class Table(BaseModel):
    table_name: str
    table_id: int
    table_description: str | None = None

# Metadata for each Warehouse
warehouseMetadata = Annotated[
    Union[
        Snowflake,
        Databricks,
    ],
    Field(discriminator="source_type")
]


# API Model
# - Request
# POST /api/knowledge/connect
class RequestConnectWarehouse(BaseModel):
    connection_name: str
    source_type: WarehouseType
    metadata: warehouseMetadata

    model_config = ConfigDict(
        from_attributes=True,
        use_enum_values=True,
    )

class ResponseReview(RequestConnectWarehouse):
    connection_id: uuid.UUID
    tables: List[Table]

# Model for Response.data
class ResponseWarehouseTable(BaseModel):
    connection_id: uuid.UUID
    tables: List[Table]

# POST /api/knowledge/select_table/:connectionId
class RequestSelectTable(BaseModel):
    connection_id: uuid.UUID
    table_ids: List[uuid.UUID]
