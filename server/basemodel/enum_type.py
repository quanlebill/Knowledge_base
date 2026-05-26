from enum import Enum


# Define Categorical Data

class APIType(Enum):
    graph = "graph"
    qdrant = "qdrant"
    retrieve = "retrieve"

class DataLayerTier(Enum):
    bronze = "Bronze"
    silver = "Silver"
    gold = "Gold"

class SourceType(Enum):
    Document = "Document"
    Image = "media"
    Video = "video"
    Web = "web"
    Warehouse = "Warehouse"

# Conflict
class ConflictType(Enum):
    table_schema = "Table Schema"
    content_contradiction = "Content Contradiction"
    content_conflict = "Content Conflict"
    content_duplicate = "Content Duplicate"
    content_update = "Content Update"

class ConflictStatus(Enum):
    pending = "pending"
    awaiting = "awaiting"
    resolved = "resolved"

class ConflictResolution(Enum):
    keep_existing = "Keep Existing"
    keep_incoming = "Keep Incoming"
    merge = "Merge"
    no_action = "No Action"

class ConflictSeverity(Enum):
    high = "High"
    medium = "Medium"
    low = "Low"

# Policy
class PolicyFilteringType(Enum):
    natural_language = "Natural Language"
    exact_match = "Exact Match For Word or Phrase"

class PolicyExtractionType(Enum):
    entity_node = "Entity"
    relationship_edge = "Relationship Edge"

# Qdrant
class SimilarityMetric(Enum):
    cosine = "Cosine Similarity"
    euclidean = "Euclidean Similarity"
    dot = "Dot Product Similarity"

# Embedding Model
class TaskType(Enum):
    embedding = "Embedding Task"
    vision_language = "Vision to Language Task"

# General
class Status(Enum):
    active = "Active"
    inactive = "Inactive"

class Language(Enum):
    EN = "English"
    VI = "Vietnamese"

class WarehouseType(Enum):
    snowflake = "Snowflake"
    databricks = "Databricks"