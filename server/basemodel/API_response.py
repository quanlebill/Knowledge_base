import datetime
import pathlib
from operator import truediv
from typing import List, Dict, Set, Tuple, Literal, Annotated, Union
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict
import uuid
from .enum_type import *


class Error(BaseModel):
    message: str
    error_type: str

class ResponseModel(BaseModel):
    code: int = 200
    data: Any = None
    #data = A_specified_response_model

    error: Error | None = None
