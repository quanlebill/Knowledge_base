import datetime
import uuid
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from basemodel.services_databaseconnector.postgres_model import (
    register, ConflictStatus, SimilarityMetric, Tier,
)


class Base(DeclarativeBase):
    pass


@register("KBModel", "orm")
class KBModelORM(Base):
    __tablename__ = "KBModel"

    model_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    task_type: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    versions: Mapped[list["KBModelVersionORM"]] = relationship(back_populates="model", cascade="all, delete-orphan")
    text_block_versions: Mapped[list["KBTextBlockVersionORM"]] = relationship(back_populates="embedding_model")
    qdrant_collections: Mapped[list["KBQdrantCollectionORM"]] = relationship(back_populates="embedding_model")
    neo4j_connections: Mapped[list["KBNeo4jConnectionORM"]] = relationship(back_populates="embedding_model")


@register("KBModelVersion", "orm")
class KBModelVersionORM(Base):
    __tablename__ = "KBModelVersion"

    version_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    model_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBModel.model_id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    added_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    added_on: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    model: Mapped["KBModelORM"] = relationship(back_populates="versions")


@register("KBData", "orm")
class KBDataORM(Base):
    __tablename__ = "KBData"

    data_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    role_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    extension: Mapped[str] = mapped_column(String(32), nullable=False)
    language: Mapped[str] = mapped_column(String(32), nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    added_by: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    abstract: Mapped[str] = mapped_column(Text, nullable=False)
    doc_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False)
    current_tier: Mapped[str] = mapped_column(String(16), default=Tier.BRONZE.value, nullable=False)
    path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    added_on: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    lifecycle_histories: Mapped[list["KBLifecycleHistoryORM"]] = relationship(back_populates="data", cascade="all, delete-orphan")
    text_blocks: Mapped[list["KBTextBlockORM"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    tables: Mapped[list["KBTableORM"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


@register("KBLifecycleHistory", "orm")
class KBLifecycleHistoryORM(Base):
    __tablename__ = "KBLifecycleHistory"

    history_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    data_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBData.data_id"), nullable=False, index=True)
    to_tier: Mapped[str] = mapped_column(String(16), nullable=False)
    from_tier: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transitioned_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    data: Mapped["KBDataORM"] = relationship(back_populates="lifecycle_histories")


@register("KBFilterPolicy", "orm")
class KBFilterPolicyORM(Base):
    __tablename__ = "KBFilterPolicy"

    policy_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    policy_name: Mapped[str] = mapped_column(String(255), nullable=False)
    configformat: Mapped[str] = mapped_column(String(64), nullable=False)
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)


@register("KBExtractionPolicy", "orm")
class KBExtractionPolicyORM(Base):
    __tablename__ = "KBExtractionPolicy"

    policy_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    policy_name: Mapped[str] = mapped_column(String(255), nullable=False)
    policy_type: Mapped[str] = mapped_column(String(64), nullable=False)
    custom_override: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)


@register("KBConflictBatch", "orm")
class KBConflictBatchORM(Base):
    __tablename__ = "KBConflictBatch"

    batch_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True, index=True)
    batch_title: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default=ConflictStatus.PENDING.value, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    conflicts: Mapped[list["KBConflictORM"]] = relationship(back_populates="batch", cascade="all, delete-orphan")


@register("KBConflict", "orm")
class KBConflictORM(Base):
    __tablename__ = "KBConflict"

    conflict_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True, index=True)
    conflict_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBConflictBatch.batch_id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default=ConflictStatus.PENDING.value, nullable=False)
    detailed_explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    existing_snapshot: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    incoming_snapshot: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    resolution_instruction: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    detected_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    batch: Mapped[Optional["KBConflictBatchORM"]] = relationship(back_populates="conflicts")


@register("KBWarehouse", "orm")
class KBWarehouseORM(Base):
    __tablename__ = "KBWarehouse"

    warehouse_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    service: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    configs: Mapped[list["KBWarehouseConfigORM"]] = relationship(back_populates="warehouse", cascade="all, delete-orphan")


@register("KBWarehouse_Config", "orm")
class KBWarehouseConfigORM(Base):
    __tablename__ = "KBWarehouse_Config"

    config_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBWarehouse.warehouse_id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    warehouse: Mapped["KBWarehouseORM"] = relationship(back_populates="configs")


@register("KBTable", "orm")
class KBTableORM(Base):
    __tablename__ = "KBTable"

    table_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBData.data_id"), nullable=False, index=True)
    table_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    table_schema: Mapped[Optional[dict]] = mapped_column("schema", JSONB, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    created_on: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    owner: Mapped["KBDataORM"] = relationship(back_populates="tables")


@register("KBTextBlock", "orm")
class KBTextBlockORM(Base):
    __tablename__ = "KBTextBlock"

    block_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBData.data_id"), nullable=False, index=True)
    block_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    owner: Mapped["KBDataORM"] = relationship(back_populates="text_blocks")
    versions: Mapped[list["KBTextBlockVersionORM"]] = relationship(back_populates="block", cascade="all, delete-orphan")


@register("KBTextBlockVersion", "orm")
class KBTextBlockVersionORM(Base):
    __tablename__ = "KBTextBlockVersion"

    version_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    block_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBTextBlock.block_id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    table_involved: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    embedding_model_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBModel.model_id"), nullable=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    block: Mapped["KBTextBlockORM"] = relationship(back_populates="versions")
    embedding_model: Mapped[Optional["KBModelORM"]] = relationship(back_populates="text_block_versions")
    text_table: Mapped[Optional["KBTextTableORM"]] = relationship(back_populates="version", uselist=False, cascade="all, delete-orphan")


@register("KBTextTable", "orm")
class KBTextTableORM(Base):
    __tablename__ = "KBTextTable"

    version_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBTextBlockVersion.version_id"), primary_key=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    table_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    version: Mapped["KBTextBlockVersionORM"] = relationship(back_populates="text_table")


@register("KBQdrantConnection", "orm")
class KBQdrantConnectionORM(Base):
    __tablename__ = "KBQdrantConnection"

    connection_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    total_collection: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    collections: Mapped[list["KBQdrantCollectionORM"]] = relationship(back_populates="connection", cascade="all, delete-orphan")


@register("KBQdrantCollection", "orm")
class KBQdrantCollectionORM(Base):
    __tablename__ = "KBQdrantCollection"

    collection_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    connection_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBQdrantConnection.connection_id"), nullable=False, index=True)
    collection_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    similarity_metric: Mapped[str] = mapped_column(String(16), default=SimilarityMetric.COSINE.value, nullable=False)
    points_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    vector_dimension: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    embedding_model_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBModel.model_id"), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    connection: Mapped["KBQdrantConnectionORM"] = relationship(back_populates="collections")
    embedding_model: Mapped[Optional["KBModelORM"]] = relationship(back_populates="qdrant_collections")


@register("KBNeo4jConnection", "orm")
class KBNeo4jConnectionORM(Base):
    __tablename__ = "KBNeo4jConnection"

    connection_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    is_connected: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    total_node: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    total_edge: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    embedding_model_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBModel.model_id"), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    embedding_model: Mapped[Optional["KBModelORM"]] = relationship(back_populates="neo4j_connections")
    nodes: Mapped[list["KBNeo4jNodeORM"]] = relationship(back_populates="connection", cascade="all, delete-orphan")


@register("KBNeo4jNode", "orm")
class KBNeo4jNodeORM(Base):
    __tablename__ = "KBNeo4jNode"

    node_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    connection_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBNeo4jConnection.connection_id"), nullable=False, index=True)
    node_name: Mapped[str] = mapped_column(String(512), nullable=False)
    node_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    inserted_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    connection: Mapped["KBNeo4jConnectionORM"] = relationship(back_populates="nodes")
    outgoing_relationships: Mapped[list["KBNeo4jRelationshipORM"]] = relationship(
        back_populates="from_node_obj",
        foreign_keys="KBNeo4jRelationshipORM.from_node",
        cascade="all, delete-orphan",
    )
    incoming_relationships: Mapped[list["KBNeo4jRelationshipORM"]] = relationship(
        back_populates="to_node_obj",
        foreign_keys="KBNeo4jRelationshipORM.to_node",
        cascade="all, delete-orphan",
    )


@register("KBNeo4jRelationship", "orm")
class KBNeo4jRelationshipORM(Base):
    __tablename__ = "KBNeo4jRelationship"

    from_node: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBNeo4jNode.node_id"), primary_key=True)
    to_node: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("KBNeo4jNode.node_id"), primary_key=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    from_node_obj: Mapped["KBNeo4jNodeORM"] = relationship(back_populates="outgoing_relationships", foreign_keys=[from_node])
    to_node_obj: Mapped["KBNeo4jNodeORM"] = relationship(back_populates="incoming_relationships", foreign_keys=[to_node])


@register("KBEntityLookup", "orm")
class KBEntityLookupORM(Base):
    __tablename__ = "KBEntityLookup"

    lookup_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    alias_name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    canonical_name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)


@register("KBPublishAPI", "orm")
class KBPublishAPIORM(Base):
    __tablename__ = "KBPublishAPI"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    endpoint_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    http_method: Mapped[str] = mapped_column(String(8), nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
