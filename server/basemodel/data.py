import datetime
import pathlib
from operator import truediv
from typing import List, Dict, Set, Tuple, Literal, Annotated, Union
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict
import uuid
from enum_type import *


"""
Model for SQL data
"""
# Data - Documents
class Document(BaseModel):
    source_type: Literal[SourceType.Document]
    doc_type: str
    author: str | None
    published_date: datetime.datetime | None

# Data - Image
class Image(BaseModel):
    source_type: Literal[SourceType.Image]
    video_type: str
    height: int
    width: int
    color_space: str | None

class Video(BaseModel):
    source_type: Literal[SourceType.Video]
    video_type: str
    height: int
    width: int
    codec: str | None
    total_frame: int

# Data - Web
class Web(BaseModel):
    source_type: Literal[SourceType.Web]
    url: str
    web_name:str

MetadataType = Annotated[
    Union[
        Document,
        Image,
        Video,
        Web,
    ],
    Field(discriminator = "source_type")
]

# Data API Model
# - Request
class RequestDataUpload(BaseModel):
    file_name: str
    source_type: SourceType

class RequestConfirmDataUpload(BaseModel):
    upload_id: uuid.UUID
    upload_status: bool

# - Response
class ResponseDataConfigure(BaseModel):
    file_name: str
    upload_id: uuid.UUID
    source_type: SourceType
    metadata: MetadataType
    model_config = ConfigDict(
        from_attributes=True,
        use_enum_values=True,
    )









