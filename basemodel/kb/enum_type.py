from enum import Enum

from basemodel.services_databaseconnector.postgres_model import (
    Language,
    PolicyFilteringType,
    PolicyExtractionType,
    ConflictType,
    ConflictResolution,
    ConflictSeverity,
    ConflictStatus,
    TaskType,
    SimilarityMetric,
    HttpMethod,
    APIType,
)


class SourceType(str, Enum):
    DOC = "doc"
    WEB = "web"
    IMAGE = "image"
    VIDEO = "video"
    WAREHOUSE = "warehouse"

    Document = "doc"
    Web = "web"
    Image = "image"
    Video = "video"
    Warehouse = "warehouse"


class DataLayerTier(str, Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"

    bronze = "bronze"
    silver = "silver"
    gold = "gold"


Tier = DataLayerTier


class Status(str, Enum):
    active = "active"
    inactive = "inactive"
    draft = "Draft"
    published = "Published"
    archived = "Archived"


class PolicyType(str, Enum):
    ENTITY = "Entity"
    RELATIONSHIP_EDGE = "Relationship Edge"


class WarehouseType(Enum):
    snowflake  = "Snowflake"
    databricks = "Databricks"
