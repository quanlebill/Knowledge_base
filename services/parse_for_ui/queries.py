"""
Join query builder functions.

Each function returns a dict accepted by pg.read_join().
Keeping join definitions here keeps router.py free of SQL-level detail.
"""

import uuid


def q_qdrant_fleet_count(tenant_id: uuid.UUID) -> dict:
    return {
        "joins_table": ["KBQdrantConnection", "KBQdrantCollection"],
        "join_on": [{
            "left_table": "KBQdrantConnection", "left_column": "connection_id",
            "right_table": "KBQdrantCollection", "right_column": "connection_id",
            "join_type": "INNER",
        }],
        "selected_columns": [
            {"table_name": "KBQdrantCollection", "column_name": "collection_id", "alias": "id"},
        ],
        "filters": [
            {"table_name": "KBQdrantConnection", "column_name": "tenant_id", "value": tenant_id},
        ],
        "limit": 200,
    }


def q_chunks(doc_id: uuid.UUID) -> dict:
    return {
        "joins_table": ["KBTextBlock", "KBTextBlockVersion"],
        "join_on": [{
            "left_table": "KBTextBlock", "left_column": "block_id",
            "right_table": "KBTextBlockVersion", "right_column": "block_id",
            "join_type": "LEFT",
        }],
        "selected_columns": [
            {"table_name": "KBTextBlock", "column_name": "block_id", "alias": "block_id"},
            {"table_name": "KBTextBlock", "column_name": "block_index", "alias": "block_index"},
            {"table_name": "KBTextBlockVersion", "column_name": "version_id", "alias": "version_id"},
            {"table_name": "KBTextBlockVersion", "column_name": "version_number", "alias": "version_number"},
            {"table_name": "KBTextBlockVersion", "column_name": "content", "alias": "content"},
            {"table_name": "KBTextBlockVersion", "column_name": "is_active", "alias": "is_active"},
            {"table_name": "KBTextBlockVersion", "column_name": "created_at", "alias": "created_at"},
            {"table_name": "KBTextBlockVersion", "column_name": "payload", "alias": "payload"},
            {"table_name": "KBTextBlockVersion", "column_name": "embedding_model_id", "alias": "embedding_model_id"},
        ],
        "filters": [
            {"table_name": "KBTextBlock", "column_name": "owner_id", "value": doc_id},
        ],
        "order_by": "KBTextBlock.block_index ASC, KBTextBlockVersion.version_number ASC",
        "limit": 500,
    }


def q_tables(doc_id: uuid.UUID) -> dict:
    return {
        "joins_table": ["KBTextBlock", "KBTextBlockVersion", "KBTextTable"],
        "join_on": [
            {
                "left_table": "KBTextBlock", "left_column": "block_id",
                "right_table": "KBTextBlockVersion", "right_column": "block_id",
                "join_type": "INNER",
            },
            {
                "left_table": "KBTextBlockVersion", "left_column": "version_id",
                "right_table": "KBTextTable", "right_column": "version_id",
                "join_type": "INNER",
            },
        ],
        "selected_columns": [
            {"table_name": "KBTextBlockVersion", "column_name": "version_id", "alias": "id"},
            {"table_name": "KBTextTable", "column_name": "table_name", "alias": "table_name"},
            {"table_name": "KBTextTable", "column_name": "description", "alias": "description"},
            {"table_name": "KBTextTable", "column_name": "data", "alias": "data"},
        ],
        "filters": [
            {"table_name": "KBTextBlock", "column_name": "owner_id", "value": doc_id},
            {"table_name": "KBTextBlockVersion", "column_name": "is_active", "value": True},
            {"table_name": "KBTextBlockVersion", "column_name": "table_involved", "value": True},
        ],
        "order_by": "KBTextBlock.block_index ASC",
        "limit": 100,
    }


def q_qdrant_collections(tenant_id: uuid.UUID) -> dict:
    return {
        "joins_table": ["KBQdrantConnection", "KBQdrantCollection", "KBModel"],
        "join_on": [
            {
                "left_table": "KBQdrantConnection", "left_column": "connection_id",
                "right_table": "KBQdrantCollection", "right_column": "connection_id",
                "join_type": "INNER",
            },
            {
                "left_table": "KBQdrantCollection", "left_column": "embedding_model_id",
                "right_table": "KBModel", "right_column": "model_id",
                "join_type": "LEFT",
            },
        ],
        "selected_columns": [
            {"table_name": "KBQdrantCollection", "column_name": "collection_id", "alias": "id"},
            {"table_name": "KBQdrantCollection", "column_name": "collection_name", "alias": "name"},
            {"table_name": "KBQdrantCollection", "column_name": "is_active", "alias": "active"},
            {"table_name": "KBQdrantCollection", "column_name": "points_count", "alias": "points"},
            {"table_name": "KBQdrantCollection", "column_name": "vector_dimension", "alias": "dimensions"},
            {"table_name": "KBQdrantCollection", "column_name": "similarity_metric", "alias": "distance"},
            {"table_name": "KBModel", "column_name": "model_name", "alias": "embedding_model"},
        ],
        "filters": [
            {"table_name": "KBQdrantConnection", "column_name": "tenant_id", "value": tenant_id},
        ],
        "order_by": "KBQdrantCollection.collection_name ASC",
        "limit": 100,
    }


def q_qdrant_collection_by_id(tenant_id: uuid.UUID, collection_id: uuid.UUID) -> dict:
    q = q_qdrant_collections(tenant_id)
    q["filters"].append(
        {"table_name": "KBQdrantCollection", "column_name": "collection_id", "value": collection_id}
    )
    q["limit"] = 1
    return q


def q_qdrant_collection_name(tenant_id: uuid.UUID, collection_id: uuid.UUID) -> dict:
    return {
        "joins_table": ["KBQdrantConnection", "KBQdrantCollection"],
        "join_on": [{
            "left_table": "KBQdrantConnection", "left_column": "connection_id",
            "right_table": "KBQdrantCollection", "right_column": "connection_id",
            "join_type": "INNER",
        }],
        "selected_columns": [
            {"table_name": "KBQdrantCollection", "column_name": "collection_name", "alias": "name"},
        ],
        "filters": [
            {"table_name": "KBQdrantConnection", "column_name": "tenant_id", "value": tenant_id},
            {"table_name": "KBQdrantCollection", "column_name": "collection_id", "value": collection_id},
        ],
        "limit": 1,
    }


def q_neo4j_edges(conn_id: uuid.UUID) -> dict:
    return {
        "joins_table": ["KBNeo4jNode", "KBNeo4jRelationship"],
        "join_on": [{
            "left_table": "KBNeo4jNode", "left_column": "node_id",
            "right_table": "KBNeo4jRelationship", "right_column": "from_node",
            "join_type": "INNER",
        }],
        "selected_columns": [
            {"table_name": "KBNeo4jRelationship", "column_name": "from_node", "alias": "from_id"},
            {"table_name": "KBNeo4jRelationship", "column_name": "to_node", "alias": "to_id"},
            {"table_name": "KBNeo4jRelationship", "column_name": "description", "alias": "description"},
            {"table_name": "KBNeo4jRelationship", "column_name": "score", "alias": "score"},
        ],
        "filters": [
            {"table_name": "KBNeo4jNode", "column_name": "connection_id", "value": conn_id},
        ],
        "limit": 1000,
    }


def q_neo4j_schema_edges(conn_id: uuid.UUID) -> dict:
    return {
        "joins_table": ["KBNeo4jNode", "KBNeo4jRelationship"],
        "join_on": [{
            "left_table": "KBNeo4jNode", "left_column": "node_id",
            "right_table": "KBNeo4jRelationship", "right_column": "from_node",
            "join_type": "INNER",
        }],
        "selected_columns": [
            {"table_name": "KBNeo4jRelationship", "column_name": "from_node", "alias": "from_id"},
            {"table_name": "KBNeo4jRelationship", "column_name": "to_node", "alias": "to_id"},
        ],
        "filters": [
            {"table_name": "KBNeo4jNode", "column_name": "connection_id", "value": conn_id},
        ],
        "limit": 1000,
    }


def q_conflicts(tenant_id: uuid.UUID) -> dict:
    return {
        "joins_table": ["KBConflictBatch", "KBConflict"],
        "join_on": [{
            "left_table": "KBConflictBatch", "left_column": "batch_id",
            "right_table": "KBConflict", "right_column": "batch_id",
            "join_type": "LEFT",
        }],
        "selected_columns": [
            {"table_name": "KBConflictBatch", "column_name": "batch_id", "alias": "batch_id"},
            {"table_name": "KBConflictBatch", "column_name": "batch_title", "alias": "batch_title"},
            {"table_name": "KBConflictBatch", "column_name": "status", "alias": "batch_status"},
            {"table_name": "KBConflictBatch", "column_name": "created_at", "alias": "batch_created_at"},
            {"table_name": "KBConflict", "column_name": "conflict_id", "alias": "conflict_id"},
            {"table_name": "KBConflict", "column_name": "conflict_type", "alias": "conflict_type"},
            {"table_name": "KBConflict", "column_name": "severity", "alias": "severity"},
            {"table_name": "KBConflict", "column_name": "status", "alias": "conflict_status"},
            {"table_name": "KBConflict", "column_name": "detected_at", "alias": "detected_at"},
        ],
        "filters": [
            {"table_name": "KBConflictBatch", "column_name": "tenant_id", "value": tenant_id},
        ],
        "order_by": "KBConflictBatch.created_at DESC, KBConflict.detected_at DESC",
        "limit": 500,
    }


def q_conflict_detail(tenant_id: uuid.UUID, conflict_id: uuid.UUID) -> dict:
    return {
        "joins_table": ["KBConflictBatch", "KBConflict"],
        "join_on": [{
            "left_table": "KBConflictBatch", "left_column": "batch_id",
            "right_table": "KBConflict", "right_column": "batch_id",
            "join_type": "INNER",
        }],
        "selected_columns": [
            {"table_name": "KBConflictBatch", "column_name": "batch_id", "alias": "batch_id"},
            {"table_name": "KBConflictBatch", "column_name": "batch_title", "alias": "batch_title"},
            {"table_name": "KBConflict", "column_name": "conflict_id", "alias": "conflict_id"},
            {"table_name": "KBConflict", "column_name": "conflict_type", "alias": "conflict_type"},
            {"table_name": "KBConflict", "column_name": "severity", "alias": "severity"},
            {"table_name": "KBConflict", "column_name": "status", "alias": "status"},
            {"table_name": "KBConflict", "column_name": "detected_at", "alias": "detected_at"},
            {"table_name": "KBConflict", "column_name": "detailed_explanation", "alias": "detailed_explanation"},
            {"table_name": "KBConflict", "column_name": "existing_snapshot", "alias": "existing_snapshot"},
            {"table_name": "KBConflict", "column_name": "incoming_snapshot", "alias": "incoming_snapshot"},
            {"table_name": "KBConflict", "column_name": "resolution_instruction", "alias": "resolution_instruction"},
            {"table_name": "KBConflict", "column_name": "selected_resolution_method",
             "alias": "selected_resolution_method"},
            {"table_name": "KBConflict", "column_name": "resolved_at", "alias": "resolved_at"},
            {"table_name": "KBConflict", "column_name": "resolved_by", "alias": "resolved_by"},
        ],
        "filters": [
            {"table_name": "KBConflictBatch", "column_name": "tenant_id", "value": tenant_id},
            {"table_name": "KBConflict", "column_name": "conflict_id", "value": conflict_id},
        ],
        "limit": 1,
    }
