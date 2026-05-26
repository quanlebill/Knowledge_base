from typing import List, Dict, Any, Optional, Literal, Annotated, Union
from pydantic import BaseModel, Field, ConfigDict
from enum_type import *


"""
Sub-models — internal data shapes (not sent directly as API responses)
"""
class LogEntry(BaseModel):
    time: str
    level: str
    message: str

class TimelineEvent(BaseModel):
    version: str
    date: str
    title: str
    actor: str


# Metadata variants
class MetadataDoc(BaseModel):
    source_type: Literal[SourceType.Document]
    language: Language
    author: Optional[str] = None
    published_date: Optional[str] = None

class MetadataWeb(BaseModel):
    source_type: Literal[SourceType.Web]
    url: str
    language: Language
    access_role: str

class MetadataImage(BaseModel):
    source_type: Literal[SourceType.Image]
    width: int
    height: int
    color_space: Optional[str] = None
    file_size: int
    access_role: str

class MetadataVideo(BaseModel):
    source_type: Literal[SourceType.Video]
    width: int
    height: int
    total_frame: int
    file_size: int
    access_role: str

class MetadataWarehouse(BaseModel):
    source_type: Literal[SourceType.Warehouse]
    warehouse_type: WarehouseType

DocumentMetadata = Annotated[
    Union[MetadataDoc, MetadataWeb, MetadataImage, MetadataVideo, MetadataWarehouse],
    Field(discriminator="source_type")
]


# Chunk variants
class ChunkVersion(BaseModel):
    version_number: str
    create_at: str
    status: Status
    embedding_models: str
    entities: List[str]
    intent: str
    text: str

class ChunkSilver(BaseModel):
    id: str
    title: str
    text: str

class ChunkGold(BaseModel):
    id: str
    title: str
    text: str
    versions: List[ChunkVersion]


# Table sub-models
class TableColumn(BaseModel):
    name: str
    type: str
    nullable: bool

class TableData(BaseModel):
    id: str
    name: str
    description: str
    columns: List[TableColumn]
    rows: List[Dict[str, Any]]


# Warehouse config sub-models
class WarehouseConnection(BaseModel):
    platform: WarehouseType
    host: str
    database: Optional[str] = None

class ConfigTable(BaseModel):
    name: str
    table_schema: str
    row_count: str
    description: str

class WarehouseConfigData(BaseModel):
    id: str
    version_number: str
    status: Status
    created_at: str
    connection: WarehouseConnection
    tables: List[ConfigTable]
    model_config = ConfigDict(
        from_attributes=True,
        use_enum_values=True,
    )



# Request Model
# GET /api/data/documents?layer=...
class RequestGetDocuments(BaseModel):
    layer: DataLayerTier

# PATCH /api/data/documents/:id
class RequestPromoteDocument(BaseModel):
    layer: Literal["SILVER", "GOLD"]
    status: Literal["EMBEDDING", "PUBLISHED"]

# PATCH /api/knowledge/documents/:data_id/tables/:tableId/rows/:rowIndex
class RequestEditTableCell(BaseModel):
    column: str
    value: str

# POST /api/knowledge/documents/:data_id/configs
class RequestCreateConfig(BaseModel):
    version_number: str
    connection: WarehouseConnection
    tables: List[ConfigTable]


# Response Model
# GET /api/data/documents?layer=
class InventoryItem(BaseModel):
    data_id: str
    name: str
    source_type: str
    added_date: str
    language: Optional[str] = None

# GET /api/knowledge/documents/:data_id (layer == BRONZE)
class BronzeConfigure(BaseModel):
    data_id: str
    name: str
    layer: Literal[DataLayerTier.bronze]
    status: str
    version: str
    author: str
    metadata: DocumentMetadata
    logs: List[LogEntry]
    timeline: List[TimelineEvent]


# GET /api/knowledge/documents/:data_id (layer == SILVER)
class SilverConfigure(BaseModel):
    data_id: str
    name: str
    layer: Literal[DataLayerTier.silver]
    status: str
    version: str
    author: str
    metadata: DocumentMetadata
    logs: List[LogEntry]
    timeline: List[TimelineEvent]
    chunks: List[ChunkSilver]
    tables: Optional[List[TableData]] = None

# GET /api/knowledge/documents/:data_id (layer == GOLD)
class GoldConfigure(BaseModel):
    data_id: str
    name: str
    layer: Literal[DataLayerTier.gold]
    status: str
    version: str
    author: str
    metadata: DocumentMetadata
    logs: List[LogEntry]
    timeline: List[TimelineEvent]
    chunks: Optional[List[ChunkGold]] = None
    tables: Optional[List[TableData]] = None
    configs: Optional[List[WarehouseConfigData]] = None
