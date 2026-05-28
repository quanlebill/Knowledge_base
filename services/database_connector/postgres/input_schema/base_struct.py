from datetime import datetime as _dt
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Any, Literal, Annotated, Union
import uuid
from .enums import *


class Document(BaseModel):
    source_type: Literal[SourceType.DOCUMENT]
    doc_type: str
    author: str | None
    published_date: _dt | None
    file_size: int | None

class Image(BaseModel):
    source_type: Literal[SourceType.IMAGE]
    image_type: str
    height: int
    width: int
    color_space: str | None
    file_size: int | None

class Video(BaseModel):
    source_type: Literal[SourceType.VIDEO]
    video_type: str
    height: int
    width: int
    codec: str | None
    total_frame: int
    file_size: int | None

class Web(BaseModel):
    source_type: Literal[SourceType.WEB]
    url: str
    web_name: str

class Warehouse(BaseModel):
    source_type: Literal[SourceType.WAREHOUSE]
    warehouse_type: str | None

MetadataType = Annotated[
    Union[
        Document,
        Image,
        Video,
        Web,
        Warehouse,
    ],
    Field(discriminator = "source_type")
]


class PolicyConfig(BaseModel):
    rules: Optional[list[str]]
    threshold: Optional[float] = None
    extra: Optional[dict[str, Any]] = None


class WarehouseConfigPayload(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    selected_tables: Optional[list[str]] = None
    sync_schedule: Optional[str] = None
    schema_filter: Optional[list[str]] = None
    extra: Optional[dict[str, Any]] = None


class ModelConfig(BaseModel):
    vector_size: Optional[int] = None
    max_tokens: Optional[int] = None
    extra: Optional[dict[str, Any]] = None
