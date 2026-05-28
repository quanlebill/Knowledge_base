from enum import Enum


class Language(Enum):
    EN = "english"
    VN = "vietnamese"

class SourceType(str, Enum):
    DOC = "doc"
    WEB = "web"
    IMAGE = "image"
    VIDEO = "video"
    WAREHOUSE = "warehouse"


class Tier(Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"

class status(Enum):
    active = "active"
    inactive = "inactive"

class PolicyFilteringType(Enum):
    NATURAL_LANG = "Natural Language"
    EXACT_MATCH = "Exact Match For Word or Phrase"

PolicyFormat = PolicyFilteringType

class PolicyExtractionType(Enum):
    ENTITY_NODE = "Entity"
    RELATIONSHIP_EDGE = "Relationship Edge"

PolicyType = PolicyExtractionType

class ConflictType(Enum):
    CONTENT_CONTRADICTION = "content_contradiction"
    CONTENT_CONFLICT = "content_conflict"
    CONTENT_DUPLICATE = "content_duplicate"
    CONTENT_UPDATE = "content_update"
    TABLE_SCHEMA = "table_schema"

class ConflictResolution(Enum):
    KEEP_EXISTING = "keep_existing"
    KEEP_INCOMING = "keep_incoming"
    MERGE = "merge"
    DELETE = "delete"

class ConflictSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ConflictStatus(Enum):
    PENDING = "pending"
    AWAITING = "awaiting"
    RESOLVED = "resolved"

class TaskType(Enum):
    EMBEDDING = "embedding"
    VLM = "Vision Language Model"

class SimilarityMetric(Enum):
    COSINE = "cosine"
    EUCLIDEAN = "euclidean"
    DOT = "dot"

class HttpMethod(Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"

class APIType(Enum):
    NEO4J= "NEO4J"
    QDRANT = "QDRANT"
    RETRIEVE = "RETRIEVE"