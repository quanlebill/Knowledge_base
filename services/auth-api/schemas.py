from typing import Optional

from pydantic import BaseModel


class IPRuleIn(BaseModel):
    cidr: str
    label: str = ""
    is_active: bool = True


class APIKeyIn(BaseModel):
    name: str
    scope: str = "read_only"
    expires_at: Optional[str] = None


class SecretIn(BaseModel):
    key_name: str
    key_type: str
    algorithm: str = ""
    realm: str = ""
    value: str = ""
    rotation_days: int = 90


class SignIn(BaseModel):
    data: str


class VerifyIn(BaseModel):
    data: str
    signature: str
