from enum import Enum

from services.database_connector.postgres.input_schema.enums import (
    Language,
    SourceType,
    Tier,
    status as Status,
    PolicyFilteringType,
    PolicyExtractionType,
    PolicyType,
    ConflictType,
    ConflictResolution,
    ConflictSeverity,
    ConflictStatus,
    TaskType,
    SimilarityMetric,
    HttpMethod,
    APIType,
)

# Alias used in inventory models
DataLayerTier = Tier


class WarehouseType(Enum):
    snowflake  = "Snowflake"
    databricks = "Databricks"
