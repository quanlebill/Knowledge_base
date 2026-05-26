import uuid
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from basemodel.API_response import ResponseModel, Error
from basemodel.conflict import (
    ConflictsConfigure,
    ConflictDetailConfigure,
    ConflictResolveConfigure,
    RequestResolveConflict,
)
from basemodel.data import RequestConfirmDataUpload, RequestDataUpload
from basemodel.fleet import FleetConfigure
from basemodel.knowledge import (
    RequestActivateChunkVersion,
    RequestCreateChunkVersion,
    RequestSearchQdrant,
    RequestToggleQdrantCollection,
)
from basemodel.warehouse import RequestConnectWarehouse, RequestSelectTable


ROLE_PERMISSIONS: dict[str, set[str]] = {
    'PLATFORM_ADMIN': {
        'delete_data', 'edit_conflict', 'process_layer', 'add_data', 'add_warehouse',
        'add_filtering_policy', 'edit_filtering_policy', 'delete_filtering_policy',
        'edit_extraction_policy', 'toggle_qdrant', 'add_warehouse_config',
        'edit_warehouse_config', 'add_chunk_version',
    },
    'AI_ENGINEER':       {'toggle_qdrant', 'edit_extraction_policy'},
    'BUSINESS_OPERATOR': {'add_warehouse', 'add_warehouse_config', 'edit_warehouse_config'},
    'EXECUTIVE':         {'edit_conflict', 'process_layer', 'add_filtering_policy'},
}


def require_permission(*permissions: str):
    """Returns a FastAPI dependency that enforces role-based access via X-Role header."""
    def dependency(x_role: str = Header(default='UNKNOWN')):
        allowed = ROLE_PERMISSIONS.get(x_role, set())
        for perm in permissions:
            if perm not in allowed:
                raise HTTPException(
                    status_code=403,
                    detail={
                        'error': f'Your role ({x_role}) does not have permission to perform this action.',
                        'required': perm,
                        'role': x_role,
                    },
                )
    return dependency



class KBService:
    # Fleet
    def fleet_stats(self) -> Any: raise NotImplementedError

    # Documents
    def get_documents(self) -> Any: raise NotImplementedError
    def update_document(self, doc_id: str, body: dict) -> Any: raise NotImplementedError
    def delete_document(self, doc_id: str) -> Any: raise NotImplementedError

    # Agents / Deployments
    def get_agents(self) -> Any: raise NotImplementedError
    def get_traces(self) -> Any: raise NotImplementedError
    def get_agent_configs(self) -> Any: raise NotImplementedError
    def get_runs(self) -> Any: raise NotImplementedError
    def get_deployments(self) -> Any: raise NotImplementedError
    def get_environments(self) -> Any: raise NotImplementedError

    # Knowledge documents (Gold-layer / GOL-xxx)
    def get_kg_documents(self) -> Any: raise NotImplementedError
    def get_kg_document(self, doc_id: str) -> Any: raise NotImplementedError

    # Chunks
    def get_chunks(self, doc_id: str) -> Any: raise NotImplementedError
    def create_chunk_version(self, doc_id: str, chunk_id: str, body: dict) -> Any: raise NotImplementedError
    def activate_chunk_version(self, doc_id: str, chunk_id: str, version_number: str) -> Any: raise NotImplementedError
    def delete_chunk(self, doc_id: str, chunk_id: str) -> Any: raise NotImplementedError
    def delete_chunk_version(self, doc_id: str, chunk_id: str, version_number: str) -> Any: raise NotImplementedError

    # Tables
    def get_tables(self, doc_id: str) -> Any: raise NotImplementedError
    def update_table_row(self, doc_id: str, table_id: str, row_index: int, column: str, value: Any) -> Any: raise NotImplementedError
    def delete_table(self, doc_id: str, table_id: str) -> Any: raise NotImplementedError

    # Document warehouse configs (per-doc, CONFIGS tab)
    def get_doc_configs(self, doc_id: str) -> Any: raise NotImplementedError
    def create_doc_config(self, doc_id: str, body: dict) -> Any: raise NotImplementedError
    def activate_doc_config(self, doc_id: str, config_id: str) -> Any: raise NotImplementedError

    # Warehouse configs (hub, GraphRAG knowledge tab)
    def get_warehouse_configs(self, warehouse_id: str) -> Any: raise NotImplementedError
    def create_warehouse_config(self, warehouse_id: str, body: dict) -> Any: raise NotImplementedError
    def activate_warehouse_config(self, warehouse_id: str, config_id: str) -> Any: raise NotImplementedError
    def delete_warehouse_config(self, warehouse_id: str, config_id: str) -> Any: raise NotImplementedError
    def delete_warehouse_config_table(self, warehouse_id: str, config_id: str, table_id: str) -> Any: raise NotImplementedError

    # Qdrant
    def get_qdrant_collections(self) -> Any: raise NotImplementedError
    def toggle_qdrant_collection(self, collection_id: str, active: bool) -> Any: raise NotImplementedError
    def search_qdrant(self, collection_id: str, query: str) -> Any: raise NotImplementedError

    # Neo4j
    def get_neo4j_graph(self) -> Any: raise NotImplementedError
    def query_neo4j(self, cypher: str) -> Any: raise NotImplementedError

    # Conflicts
    def get_conflict_batches(self) -> Any: raise NotImplementedError
    def get_conflicts(self) -> Any: raise NotImplementedError
    def get_conflict_detail(self, conflict_id: str) -> Any: raise NotImplementedError
    def resolve_conflict(self, conflict_id: str, body: RequestResolveConflict) -> Any: raise NotImplementedError

    # Filter policies
    def get_filter_policies(self) -> Any: raise NotImplementedError
    def create_filter_policy(self, body: dict) -> Any: raise NotImplementedError
    def get_filter_policy(self, policy_id: str) -> Any: raise NotImplementedError
    def update_filter_policy(self, policy_id: str, body: dict) -> Any: raise NotImplementedError
    def delete_filter_policy(self, policy_id: str) -> Any: raise NotImplementedError

    # Extraction policy
    def get_extraction_policy(self) -> Any: raise NotImplementedError
    def update_extraction_policy_custom(self, custom: str) -> Any: raise NotImplementedError


def get_service() -> KBService:
    return KBService()


# ResponseModel For Different Messages
def SuccessFlag(data: Any) -> ResponseModel:
    return ResponseModel(code=200, data=data)

def CreateFlag(data: Any) -> ResponseModel:
    return ResponseModel(code=201, data=data)

def ErrorFlag(code: int, message: str, error_type: str = 'Error') -> ResponseModel:
    return ResponseModel(code=code, error=Error(message=message, error_type=error_type))

def _to_dict(raw: Any) -> dict:
    return raw.model_dump() if hasattr(raw, 'model_dump') else raw



class RequestUpdateDocument(BaseModel):
    layer: Optional[str] = None
    status: Optional[str] = None
    metadata: Optional[dict] = None


class RequestTableRowUpdate(BaseModel):
    column: str
    value: Any = None


class RequestDocConfig(BaseModel):
    version_number: str
    connection: Optional[dict] = None
    tables: list


class RequestWarehouseConfigCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    version: str
    status: Optional[str] = 'Draft'
    tables: list
    sync_schedule: Optional[str] = Field(default='Manual', alias='syncSchedule')


class RequestNeo4jQuery(BaseModel):
    cypher: str


class RequestCreateFilterPolicy(BaseModel):
    name: str
    type: str
    content: str
    added_by: Optional[str] = 'user'


class RequestUpdateFilterPolicy(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    content: Optional[str] = None
    active: Optional[bool] = None


class RequestExtractionCustom(BaseModel):
    custom: str



router = APIRouter()



@router.get('/api/fleet/stats', response_model=ResponseModel, tags=['Fleet'])
async def get_fleet_stats(service: KBService = Depends(get_service)):
    try:
        data = FleetConfigure(**_to_dict(service.fleet_stats())).model_dump(mode='json')
        return SuccessFlag(data)
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/data/documents', response_model=ResponseModel, tags=['Data'])
async def get_documents(service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_documents())
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.patch(
    '/api/data/documents/{doc_id}',
    response_model=ResponseModel, tags=['Data'],
    dependencies=[Depends(require_permission('process_layer'))],
)
async def update_document(
    doc_id: str,
    body: RequestUpdateDocument,
    service: KBService = Depends(get_service),
):
    try:
        return SuccessFlag(service.update_document(doc_id, body.model_dump(exclude_none=True)))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.delete(
    '/api/data/documents/{doc_id}',
    response_model=ResponseModel, tags=['Data'],
    dependencies=[Depends(require_permission('delete_data'))],
)
async def delete_document(doc_id: str, service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.delete_document(doc_id))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/data/agents', response_model=ResponseModel, tags=['Data'])
async def get_agents(service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_agents())
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/data/traces', response_model=ResponseModel, tags=['Data'])
async def get_traces(service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_traces())
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/data/configs', response_model=ResponseModel, tags=['Data'])
async def get_agent_configs(service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_agent_configs())
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/data/runs', response_model=ResponseModel, tags=['Data'])
async def get_runs(service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_runs())
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/data/deployments', response_model=ResponseModel, tags=['Data'])
async def get_deployments(service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_deployments())
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/data/environments', response_model=ResponseModel, tags=['Data'])
async def get_environments(service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_environments())
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/knowledge/documents', response_model=ResponseModel, tags=['Knowledge'])
async def get_kg_documents(service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_kg_documents())
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/knowledge/documents/{doc_id}', response_model=ResponseModel, tags=['Knowledge'])
async def get_kg_document(doc_id: str, service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_kg_document(doc_id))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/knowledge/documents/{doc_id}/chunks', response_model=ResponseModel, tags=['Knowledge'])
async def get_chunks(doc_id: str, service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_chunks(doc_id))
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.post(
    '/api/knowledge/documents/{doc_id}/chunks/{chunk_id}/versions',
    response_model=ResponseModel, tags=['Knowledge'],
    dependencies=[Depends(require_permission('add_chunk_version'))],
)
async def create_chunk_version(
    doc_id: str,
    chunk_id: str,
    body: RequestCreateChunkVersion,
    service: KBService = Depends(get_service),
):
    try:
        return CreateFlag(service.create_chunk_version(doc_id, chunk_id, body.model_dump()))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except ValueError as e:
        return ErrorFlag(400, str(e), 'ValueError')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.patch(
    '/api/knowledge/documents/{doc_id}/chunks/{chunk_id}/activate',
    response_model=ResponseModel, tags=['Knowledge'],
    dependencies=[Depends(require_permission('add_chunk_version'))],
)
async def activate_chunk_version(
    doc_id: str,
    chunk_id: str,
    body: RequestActivateChunkVersion,
    service: KBService = Depends(get_service),
):
    try:
        return SuccessFlag(service.activate_chunk_version(doc_id, chunk_id, body.version_number))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.delete(
    '/api/knowledge/documents/{doc_id}/chunks/{chunk_id}/versions/{version_number}',
    response_model=ResponseModel, tags=['Knowledge'],
    dependencies=[Depends(require_permission('delete_data'))],
)
async def delete_chunk_version(
    doc_id: str,
    chunk_id: str,
    version_number: str,
    service: KBService = Depends(get_service),
):
    try:
        return SuccessFlag(service.delete_chunk_version(doc_id, chunk_id, version_number))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except ValueError as e:
        return ErrorFlag(400, str(e), 'ValueError')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.delete(
    '/api/knowledge/documents/{doc_id}/chunks/{chunk_id}',
    response_model=ResponseModel, tags=['Knowledge'],
    dependencies=[Depends(require_permission('delete_data'))],
)
async def delete_chunk(doc_id: str, chunk_id: str, service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.delete_chunk(doc_id, chunk_id))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/knowledge/documents/{doc_id}/tables', response_model=ResponseModel, tags=['Knowledge'])
async def get_tables(doc_id: str, service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_tables(doc_id))
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.patch(
    '/api/knowledge/documents/{doc_id}/tables/{table_id}/rows/{row_index}',
    response_model=ResponseModel, tags=['Knowledge'],
)
async def update_table_row(
    doc_id: str,
    table_id: str,
    row_index: int,
    body: RequestTableRowUpdate,
    service: KBService = Depends(get_service),
):
    try:
        return SuccessFlag(service.update_table_row(doc_id, table_id, row_index, body.column, body.value))
    except (KeyError, IndexError) as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.delete(
    '/api/knowledge/documents/{doc_id}/tables/{table_id}',
    response_model=ResponseModel, tags=['Knowledge'],
    dependencies=[Depends(require_permission('delete_data'))],
)
async def delete_table(doc_id: str, table_id: str, service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.delete_table(doc_id, table_id))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)




@router.get('/api/knowledge/documents/{doc_id}/configs', response_model=ResponseModel, tags=['Knowledge'])
async def get_doc_configs(doc_id: str, service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_doc_configs(doc_id))
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.post('/api/knowledge/documents/{doc_id}/configs', response_model=ResponseModel, tags=['Knowledge'])
async def create_doc_config(
    doc_id: str,
    body: RequestDocConfig,
    service: KBService = Depends(get_service),
):
    try:
        return CreateFlag(service.create_doc_config(doc_id, body.model_dump()))
    except ValueError as e:
        return ErrorFlag(400, str(e), 'ValueError')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.patch(
    '/api/knowledge/documents/{doc_id}/configs/{config_id}/activate',
    response_model=ResponseModel, tags=['Knowledge'],
)
async def activate_doc_config(
    doc_id: str,
    config_id: str,
    service: KBService = Depends(get_service),
):
    try:
        return SuccessFlag(service.activate_doc_config(doc_id, config_id))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)



@router.get('/api/knowledge/warehouses/{warehouse_id}/configs', response_model=ResponseModel, tags=['Knowledge'])
async def get_warehouse_configs(warehouse_id: str, service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_warehouse_configs(warehouse_id))
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.post(
    '/api/knowledge/warehouses/{warehouse_id}/configs',
    response_model=ResponseModel, tags=['Knowledge'],
    dependencies=[Depends(require_permission('add_warehouse_config'))],
)
async def create_warehouse_config(
    warehouse_id: str,
    body: RequestWarehouseConfigCreate,
    service: KBService = Depends(get_service),
):
    try:
        return CreateFlag(service.create_warehouse_config(warehouse_id, body.model_dump(by_alias=False)))
    except ValueError as e:
        return ErrorFlag(400, str(e), 'ValueError')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.patch(
    '/api/knowledge/warehouses/{warehouse_id}/configs/{config_id}/activate',
    response_model=ResponseModel, tags=['Knowledge'],
    dependencies=[Depends(require_permission('edit_warehouse_config'))],
)
async def activate_warehouse_config(
    warehouse_id: str,
    config_id: str,
    service: KBService = Depends(get_service),
):
    try:
        return SuccessFlag(service.activate_warehouse_config(warehouse_id, config_id))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.delete(
    '/api/knowledge/warehouses/{warehouse_id}/configs/{config_id}/tables/{table_id}',
    response_model=ResponseModel, tags=['Knowledge'],
    dependencies=[Depends(require_permission('delete_data'))],
)
async def delete_warehouse_config_table(
    warehouse_id: str,
    config_id: str,
    table_id: str,
    service: KBService = Depends(get_service),
):
    try:
        return SuccessFlag(service.delete_warehouse_config_table(warehouse_id, config_id, table_id))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.delete(
    '/api/knowledge/warehouses/{warehouse_id}/configs/{config_id}',
    response_model=ResponseModel, tags=['Knowledge'],
    dependencies=[Depends(require_permission('delete_data'))],
)
async def delete_warehouse_config(
    warehouse_id: str,
    config_id: str,
    service: KBService = Depends(get_service),
):
    try:
        return SuccessFlag(service.delete_warehouse_config(warehouse_id, config_id))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except ValueError as e:
        return ErrorFlag(400, str(e), 'ValueError')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/knowledge/qdrant/collections', response_model=ResponseModel, tags=['Qdrant'])
async def get_qdrant_collections(service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_qdrant_collections())
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.patch(
    '/api/knowledge/qdrant/collections/{collection_id}',
    response_model=ResponseModel, tags=['Qdrant'],
    dependencies=[Depends(require_permission('toggle_qdrant'))],
)
async def toggle_qdrant_collection(
    collection_id: str,
    body: RequestToggleQdrantCollection,
    service: KBService = Depends(get_service),
):
    try:
        return SuccessFlag(service.toggle_qdrant_collection(collection_id, body.active))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.post(
    '/api/knowledge/qdrant/collections/{collection_id}/search',
    response_model=ResponseModel, tags=['Qdrant'],
    dependencies=[Depends(require_permission('toggle_qdrant'))],
)
async def search_qdrant(
    collection_id: str,
    body: RequestSearchQdrant,
    service: KBService = Depends(get_service),
):
    try:
        return SuccessFlag(service.search_qdrant(collection_id, body.query))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except ValueError as e:
        return ErrorFlag(400, str(e), 'ValueError')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)



@router.get('/api/knowledge/neo4j/graph', response_model=ResponseModel, tags=['Neo4j'])
async def get_neo4j_graph(service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_neo4j_graph())
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.post('/api/knowledge/neo4j/query', response_model=ResponseModel, tags=['Neo4j'])
async def query_neo4j(body: RequestNeo4jQuery, service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.query_neo4j(body.cypher))
    except ValueError as e:
        return ErrorFlag(400, str(e), 'ValueError')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)



@router.get('/api/knowledge/conflicts/batches', response_model=ResponseModel, tags=['Conflicts'])
async def get_conflict_batches(service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_conflict_batches())
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/knowledge/conflicts', response_model=ResponseModel, tags=['Conflicts'])
async def get_conflicts(service: KBService = Depends(get_service)):
    try:
        data = ConflictsConfigure(**_to_dict(service.get_conflicts())).model_dump(mode='json')
        return SuccessFlag(data)
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/knowledge/conflicts/{conflict_id}', response_model=ResponseModel, tags=['Conflicts'])
async def get_conflict_detail(conflict_id: str, service: KBService = Depends(get_service)):
    try:
        data = ConflictDetailConfigure(**_to_dict(service.get_conflict_detail(conflict_id))).model_dump(mode='json')
        return SuccessFlag(data)
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.patch(
    '/api/knowledge/conflicts/{conflict_id}',
    response_model=ResponseModel, tags=['Conflicts'],
    dependencies=[Depends(require_permission('edit_conflict'))],
)
async def resolve_conflict(
    conflict_id: str,
    body: RequestResolveConflict,
    service: KBService = Depends(get_service),
):
    try:
        data = ConflictResolveConfigure(**_to_dict(service.resolve_conflict(conflict_id, body))).model_dump(mode='json')
        return SuccessFlag(data)
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)



@router.get('/api/knowledge/policies/filtering', response_model=ResponseModel, tags=['Policies'])
async def get_filter_policies(service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_filter_policies())
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.post(
    '/api/knowledge/policies/filtering',
    response_model=ResponseModel, tags=['Policies'],
    dependencies=[Depends(require_permission('add_filtering_policy'))],
)
async def create_filter_policy(
    body: RequestCreateFilterPolicy,
    service: KBService = Depends(get_service),
):
    try:
        return CreateFlag(service.create_filter_policy(body.model_dump()))
    except ValueError as e:
        return ErrorFlag(400, str(e), 'ValueError')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/knowledge/policies/filtering/{policy_id}', response_model=ResponseModel, tags=['Policies'])
async def get_filter_policy(policy_id: str, service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_filter_policy(policy_id))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.put(
    '/api/knowledge/policies/filtering/{policy_id}',
    response_model=ResponseModel, tags=['Policies'],
    dependencies=[Depends(require_permission('edit_filtering_policy'))],
)
async def update_filter_policy(
    policy_id: str,
    body: RequestUpdateFilterPolicy,
    service: KBService = Depends(get_service),
):
    try:
        return SuccessFlag(service.update_filter_policy(policy_id, body.model_dump(exclude_none=True)))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.delete(
    '/api/knowledge/policies/filtering/{policy_id}',
    response_model=ResponseModel, tags=['Policies'],
    dependencies=[Depends(require_permission('delete_filtering_policy'))],
)
async def delete_filter_policy(policy_id: str, service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.delete_filter_policy(policy_id))
    except KeyError as e:
        return ErrorFlag(404, str(e), 'NotFound')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.get('/api/knowledge/policies/extraction', response_model=ResponseModel, tags=['Policies'])
async def get_extraction_policy(service: KBService = Depends(get_service)):
    try:
        return SuccessFlag(service.get_extraction_policy())
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.put(
    '/api/knowledge/policies/extraction/custom',
    response_model=ResponseModel, tags=['Policies'],
    dependencies=[Depends(require_permission('edit_extraction_policy'))],
)
async def update_extraction_policy_custom(
    body: RequestExtractionCustom,
    service: KBService = Depends(get_service),
):
    try:
        return SuccessFlag(service.update_extraction_policy_custom(body.custom))
    except ValueError as e:
        return ErrorFlag(400, str(e), 'ValueError')
    except NotImplementedError:
        return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
    except Exception as e:
        return ErrorFlag(500, str(e), type(e).__name__)


@router.post('/api/knowledge/data_upload', response_model=ResponseModel, tags=['Data'])
async def upload_data(body: RequestDataUpload, service: KBService = Depends(get_service)):
    return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')


@router.post('/api/knowledge/confirm/{upload_id}', response_model=ResponseModel, tags=['Data'])
async def confirm_upload(upload_id: uuid.UUID, body: RequestConfirmDataUpload, service: KBService = Depends(get_service)):
    return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')


@router.post('/api/knowledge/connect', response_model=ResponseModel, tags=['Warehouse'])
async def connect_warehouse(body: RequestConnectWarehouse, service: KBService = Depends(get_service)):
    return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')


@router.post('/api/knowledge/select_table/{connection_id}', response_model=ResponseModel, tags=['Warehouse'])
async def select_tables(connection_id: uuid.UUID, body: RequestSelectTable, service: KBService = Depends(get_service)):
    return ErrorFlag(501, 'Service not implemented', 'NotImplementedError')
