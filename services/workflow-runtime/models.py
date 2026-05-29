import uuid
from sqlalchemy import Column, String, Boolean, SmallInteger, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Member(Base):
    __tablename__ = "members"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id     = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    user_id       = Column(String, nullable=False)
    tenant_role   = Column(String, nullable=False, default="viewer")
    is_active     = Column(Boolean, default=True)


class Conversation(Base):
    __tablename__    = "conversations"
    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id        = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    agent_version_id = Column(UUID(as_uuid=True), nullable=False)
    user_ref         = Column(String)
    channel          = Column(String, nullable=False, default="web")
    status           = Column(String, default="active")


class Message(Base):
    # messages is a partitioned table — no explicit PK in DB.
    # SQLAlchemy needs a logical PK; id is generated in Python so no RETURNING needed.
    __tablename__   = "messages"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    role            = Column(String, nullable=False)
    content         = Column(JSONB, nullable=False)
    metadata_       = Column("metadata", JSONB, default=dict)
    tokens_used     = Column(Integer)
    latency_ms      = Column(Integer)


class AgentTrace(Base):
    __tablename__ = "agent_traces"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id    = Column(UUID(as_uuid=True), nullable=False)
    trace_index   = Column(SmallInteger, nullable=False)
    tool_name     = Column(String, nullable=False)
    input         = Column(JSONB, default=dict)
    output        = Column(JSONB, default=dict)
    status        = Column(String, default="success")
    latency_ms    = Column(Integer)
