import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# ── Path setup — import server/router.py and server/basemodel/ ────────────────
SERVER_DIR = Path(__file__).resolve().parent.parent / 'server'
sys.path.insert(0, str(SERVER_DIR / 'basemodel'))
sys.path.insert(0, str(SERVER_DIR))

from router import router, get_service, KBService          # noqa: E402
from basemodel.conflict import RequestResolveConflict       # noqa: E402

DATA_DIR = Path(__file__).resolve().parent / 'data'
PORT = 8000


# ── JSON-backed service ────────────────────────────────────────────────────────

class JsonKBService(KBService):
    def __init__(self):
        conflicts_raw       = json.loads((DATA_DIR / 'conflicts.json').read_text(encoding='utf-8'))
        self._batches       = conflicts_raw['batches']
        self._conflicts     = conflicts_raw['conflicts']
        self._documents     = json.loads((DATA_DIR / 'documents.json').read_text(encoding='utf-8'))
        self._kg            = json.loads((DATA_DIR / 'knowledge-graph.json').read_text(encoding='utf-8'))
        agents_raw          = json.loads((DATA_DIR / 'agents.json').read_text(encoding='utf-8'))
        self._agents        = agents_raw['agents']
        self._traces        = agents_raw['traces']
        self._agent_configs = agents_raw['configs']
        self._runs          = agents_raw['runs']
        deployments_raw     = json.loads((DATA_DIR / 'deployments.json').read_text(encoding='utf-8'))
        self._deployments   = deployments_raw['deployments']
        self._environments  = deployments_raw['environments']
        policies_raw        = json.loads((DATA_DIR / 'policies.json').read_text(encoding='utf-8'))
        self._filter_policies = policies_raw['filter_policies']
        self._extraction      = policies_raw['extraction']

    def _save(self, filename: str, data: Any) -> None:
        (DATA_DIR / filename).write_text(json.dumps(data, indent=2), encoding='utf-8')

    def _now_utc(self, fmt: str = '%Y-%m-%d %H:%M:%S UTC') -> str:
        return datetime.now(timezone.utc).strftime(fmt)

    def _ts_ms(self) -> int:
        return int(datetime.now(timezone.utc).timestamp() * 1000)

    # ── Fleet ──────────────────────────────────────────────────────────────────

    def fleet_stats(self) -> dict:
        gold = [d for d in self._documents if d.get('layer') == 'GOLD']
        content = {'documents': 0, 'web': 0, 'media': 0, 'warehouses': 0}
        for d in gold:
            t = (d.get('metadata') or {}).get('type', '')
            if t.startswith('Warehouse/'):             content['warehouses'] += 1
            elif t.lower() == 'web':                   content['web'] += 1
            elif t.startswith(('Video/', 'Image/')):   content['media'] += 1
            else:                                      content['documents'] += 1

        pending_batch_ids = {
            c['batch_id'] for c in self._conflicts
            if c.get('status') != 'resolved' and c.get('batch_id')
        }
        batch_ids = {b['id'] for b in self._batches}
        return {
            'content': content,
            'qdrant_collections': len(self._kg.get('qdrant_collections', [])),
            'neo4j_nodes': len((self._kg.get('neo4j') or {}).get('nodes', [])),
            'neo4j_relationships': len((self._kg.get('neo4j') or {}).get('edges', [])),
            'unresolved_conflict_batches': len(pending_batch_ids & batch_ids),
        }

    # ── Documents ──────────────────────────────────────────────────────────────

    def get_documents(self) -> list:
        return self._documents

    def update_document(self, doc_id: str, body: dict) -> dict:
        doc = next((d for d in self._documents if d['id'] == doc_id), None)
        if doc is None:
            raise KeyError(f'Document not found')
        doc.update(body)
        self._save('documents.json', self._documents)
        return doc

    def delete_document(self, doc_id: str) -> dict:
        idx = next((i for i, d in enumerate(self._documents) if d['id'] == doc_id), None)
        if idx is None:
            raise KeyError('Document not found')
        deleted = self._documents.pop(idx)
        self._save('documents.json', self._documents)
        return deleted

    # ── Agents / Deployments ───────────────────────────────────────────────────

    def get_agents(self) -> list:
        return self._agents

    def get_traces(self) -> list:
        return self._traces

    def get_agent_configs(self) -> list:
        return self._agent_configs

    def get_runs(self) -> list:
        return self._runs

    def get_deployments(self) -> list:
        return self._deployments

    def get_environments(self) -> list:
        return self._environments

    # ── Knowledge documents (Gold-layer GOL-xxx) ───────────────────────────────

    def get_kg_documents(self) -> list:
        return self._kg.get('documents', [])

    def get_kg_document(self, doc_id: str) -> dict:
        doc = next((d for d in self._kg.get('documents', []) if d['id'] == doc_id), None)
        if doc is None:
            raise KeyError('Document not found')
        return doc

    # ── Chunks ─────────────────────────────────────────────────────────────────

    def get_chunks(self, doc_id: str) -> list:
        chunks = self._kg.get('chunks', {}).get(doc_id)
        if chunks:
            return chunks
        return self._kg.get('chunks', {}).get('GOL-001', [])

    def create_chunk_version(self, doc_id: str, chunk_id: str, body: dict) -> dict:
        doc_chunks = self._kg.get('chunks', {}).get(doc_id)
        if doc_chunks is None:
            raise KeyError('Document not found')
        chunk = next((c for c in doc_chunks if c['id'] == chunk_id), None)
        if chunk is None:
            raise KeyError('Chunk not found')
        version_number = body.get('version_number')
        text = body.get('text')
        if not version_number or not text:
            raise ValueError('version_number and text are required')
        new_version = {
            'version_number': version_number,
            'create_at': self._now_utc(),
            'status': 'Inactive',
            'embedding_models': body.get('embedding_models', 'text-embedding-3-large (3072d)'),
            'entities': body.get('entities', []),
            'intent': body.get('intent', ''),
            'text': text,
        }
        chunk['versions'].insert(0, new_version)
        self._save('knowledge-graph.json', self._kg)
        return new_version

    def activate_chunk_version(self, doc_id: str, chunk_id: str, version_number: str) -> dict:
        doc_chunks = self._kg.get('chunks', {}).get(doc_id)
        if doc_chunks is None:
            raise KeyError('Document not found')
        chunk = next((c for c in doc_chunks if c['id'] == chunk_id), None)
        if chunk is None:
            raise KeyError('Chunk not found')
        target = next((v for v in chunk['versions'] if v['version_number'] == version_number), None)
        if target is None:
            raise KeyError('Version not found')
        for v in chunk['versions']:
            v['status'] = 'Active' if v['version_number'] == version_number else 'Inactive'
        self._save('knowledge-graph.json', self._kg)
        return chunk

    def delete_chunk(self, doc_id: str, chunk_id: str) -> dict:
        doc_chunks = self._kg.get('chunks', {}).get(doc_id)
        if doc_chunks is None:
            raise KeyError('Document not found in chunk store')
        idx = next((i for i, c in enumerate(doc_chunks) if c['id'] == chunk_id), None)
        if idx is None:
            raise KeyError('Chunk not found')
        deleted = doc_chunks.pop(idx)
        self._save('knowledge-graph.json', self._kg)
        return deleted

    def delete_chunk_version(self, doc_id: str, chunk_id: str, version_number: str) -> dict:
        doc_chunks = self._kg.get('chunks', {}).get(doc_id)
        if doc_chunks is None:
            raise KeyError('Document not found in chunk store')
        chunk = next((c for c in doc_chunks if c['id'] == chunk_id), None)
        if chunk is None:
            raise KeyError('Chunk not found')
        idx = next((i for i, v in enumerate(chunk['versions']) if v['version_number'] == version_number), None)
        if idx is None:
            raise KeyError('Version not found')
        if chunk['versions'][idx]['status'] == 'Active':
            raise ValueError('Cannot delete the active version. Activate another version first.')
        deleted = chunk['versions'].pop(idx)
        self._save('knowledge-graph.json', self._kg)
        return deleted

    # ── Tables ─────────────────────────────────────────────────────────────────

    def get_tables(self, doc_id: str) -> list:
        tables = self._kg.get('tables', {}).get(doc_id)
        if tables:
            return tables
        return self._kg.get('tables', {}).get('GOL-001', [])

    def update_table_row(self, doc_id: str, table_id: str, row_index: int, column: str, value: Any) -> dict:
        tables = self._kg.get('tables', {}).get(doc_id) or self._kg.get('tables', {}).get('GOL-001', [])
        table = next((t for t in tables if t['id'] == table_id), None)
        if table is None:
            raise KeyError('Table not found')
        if row_index < 0 or row_index >= len(table['rows']):
            raise IndexError('Row index out of bounds')
        table['rows'][row_index][column] = value
        return table['rows'][row_index]

    def delete_table(self, doc_id: str, table_id: str) -> dict:
        tables = self._kg.get('tables', {}).get(doc_id)
        if tables is None:
            raise KeyError('No tables found for this document')
        idx = next((i for i, t in enumerate(tables) if t['id'] == table_id), None)
        if idx is None:
            raise KeyError('Table not found')
        deleted = tables.pop(idx)
        self._save('knowledge-graph.json', self._kg)
        return deleted

    # ── Document warehouse configs (CONFIGS tab) ───────────────────────────────

    def get_doc_configs(self, doc_id: str) -> list:
        return self._kg.get('warehouse_configs', {}).get(doc_id, [])

    def create_doc_config(self, doc_id: str, body: dict) -> dict:
        if 'warehouse_configs' not in self._kg:
            self._kg['warehouse_configs'] = {}
        if doc_id not in self._kg['warehouse_configs']:
            self._kg['warehouse_configs'][doc_id] = []
        version_number = body.get('version_number')
        tables = body.get('tables')
        if not version_number or tables is None:
            raise ValueError('version_number and tables are required')
        new_config = {
            'id': f'{doc_id}-cfg-{self._ts_ms()}',
            'version_number': version_number,
            'status': 'Inactive',
            'created_at': self._now_utc(),
            'connection': body.get('connection', {}),
            'tables': tables,
        }
        self._kg['warehouse_configs'][doc_id].insert(0, new_config)
        return new_config

    def activate_doc_config(self, doc_id: str, config_id: str) -> dict:
        configs = self._kg.get('warehouse_configs', {}).get(doc_id)
        if not configs:
            raise KeyError('No configs for this document')
        target = next((c for c in configs if c['id'] == config_id), None)
        if target is None:
            raise KeyError('Config not found')
        for c in configs:
            c['status'] = 'Active' if c['id'] == config_id else 'Inactive'
        return target

    # ── Warehouse configs (GraphRAG Knowledge Hub) ─────────────────────────────

    def get_warehouse_configs(self, warehouse_id: str) -> list:
        return self._kg.get('warehouse_configs', {}).get(warehouse_id, [])

    def create_warehouse_config(self, warehouse_id: str, body: dict) -> dict:
        if 'warehouse_configs' not in self._kg:
            self._kg['warehouse_configs'] = {}
        if warehouse_id not in self._kg['warehouse_configs']:
            self._kg['warehouse_configs'][warehouse_id] = []
        name = body.get('name')
        version = body.get('version')
        tables = body.get('tables')
        if not name or not version or tables is None:
            raise ValueError('name, version, and tables are required')
        new_config = {
            'id': f'cfg-{self._ts_ms()}',
            'name': name,
            'version': version,
            'createdAt': self._now_utc('%Y-%m-%d %H:%M UTC'),
            'status': body.get('status', 'Draft'),
            'syncSchedule': body.get('sync_schedule', 'Manual'),
            'tables': tables,
        }
        self._kg['warehouse_configs'][warehouse_id].insert(0, new_config)
        self._save('knowledge-graph.json', self._kg)
        return new_config

    def activate_warehouse_config(self, warehouse_id: str, config_id: str) -> dict:
        configs = self._kg.get('warehouse_configs', {}).get(warehouse_id)
        if not configs:
            raise KeyError('No configs for this warehouse')
        target = next((c for c in configs if c['id'] == config_id), None)
        if target is None:
            raise KeyError('Config not found')
        for c in configs:
            if c['id'] == config_id:
                c['status'] = 'Active'
            elif c['status'] == 'Active':
                c['status'] = 'Draft'
        self._save('knowledge-graph.json', self._kg)
        return target

    def delete_warehouse_config(self, warehouse_id: str, config_id: str) -> dict:
        configs = self._kg.get('warehouse_configs', {}).get(warehouse_id)
        if not configs:
            raise KeyError('No configs for this warehouse')
        idx = next((i for i, c in enumerate(configs) if c['id'] == config_id), None)
        if idx is None:
            raise KeyError('Config not found')
        if configs[idx].get('status') == 'Active':
            raise ValueError('Cannot delete the active config. Activate another config first.')
        deleted = configs.pop(idx)
        self._save('knowledge-graph.json', self._kg)
        return deleted

    def delete_warehouse_config_table(self, warehouse_id: str, config_id: str, table_id: str) -> dict:
        configs = self._kg.get('warehouse_configs', {}).get(warehouse_id)
        if not configs:
            raise KeyError('No configs for this warehouse')
        config = next((c for c in configs if c['id'] == config_id), None)
        if config is None:
            raise KeyError('Config not found')
        idx = next((i for i, t in enumerate(config['tables']) if t.get('id') == table_id), None)
        if idx is None:
            raise KeyError('Table not found in config')
        deleted = config['tables'].pop(idx)
        self._save('knowledge-graph.json', self._kg)
        return deleted

    # ── Qdrant ─────────────────────────────────────────────────────────────────

    def get_qdrant_collections(self) -> list:
        return self._kg.get('qdrant_collections', [])

    def toggle_qdrant_collection(self, collection_id: str, active: bool) -> dict:
        col = next((c for c in self._kg.get('qdrant_collections', []) if c['id'] == collection_id), None)
        if col is None:
            raise KeyError('Collection not found')
        col['active'] = active
        self._save('knowledge-graph.json', self._kg)
        return col

    def search_qdrant(self, collection_id: str, query: str) -> list:
        collection = next(
            (c for c in self._kg.get('qdrant_collections', []) if c['id'] == collection_id), None
        )
        if collection is None:
            raise KeyError('Collection not found')
        if not query:
            raise ValueError('query is required')

        q = query[:40]
        seeds: dict[str, list[dict]] = {
            'qd-001': [
                {'summary': f'Enterprise policy clause defining the scope of "{q}" across all business units and regulatory jurisdictions.', 'entities': ['AeroFlow HQ', 'Compliance Team', 'Legal Department'], 'intent': ['Define regulatory scope', 'Establish compliance boundaries']},
                {'summary': f'Procedural guidelines for handling "{q}" in enterprise environments, including escalation paths.', 'entities': ['Platform Admin', 'Enterprise Security', 'Audit Committee'], 'intent': ['Outline operational procedures', 'Ensure audit compliance']},
                {'summary': f'Exception handling rules and override conditions applicable to "{q}" workflows.', 'entities': ['Risk Management', 'CISO Office', 'Incident Response Team'], 'intent': ['Define exception criteria', 'Specify override protocols']},
                {'summary': f'Historical versioning notes for knowledge artifacts governing "{q}" — tracks changes since v1.0.', 'entities': ['Document Repository', 'Change Board', 'Version Control'], 'intent': ['Preserve policy history', 'Track regulatory changes']},
                {'summary': f'Taxonomy labels and metadata annotations applied to chunks related to "{q}" for retrieval optimization.', 'entities': ['Metadata Store', 'Taxonomy Engine', 'Classification Service'], 'intent': ['Annotate knowledge chunks', 'Optimize retrieval accuracy']},
            ],
            'qd-002': [
                {'summary': f'Contract clause governing SLA obligations related to "{q}" between enterprise clients and AeroFlow.', 'entities': ['Legal Department', 'Client Success', 'SLA Board'], 'intent': ['Enforce SLA commitments', 'Define penalty clauses']},
                {'summary': f'Addendum to master services agreement addressing "{q}" in multi-jurisdiction deployments.', 'entities': ['AeroFlow Legal', 'Enterprise Clients', 'Procurement Office'], 'intent': ['Extend contract scope', 'Cover multi-jurisdiction use']},
                {'summary': f'IP ownership and data residency provisions for assets related to "{q}".', 'entities': ['IP Counsel', 'Data Governance', 'Compliance Officer'], 'intent': ['Protect intellectual property', 'Ensure data residency compliance']},
                {'summary': f'Amendment records and signing history for contracts mentioning "{q}".', 'entities': ['Contract Repository', 'DocuSign Audit', 'Legal Ops'], 'intent': ['Track contract amendments', 'Maintain signing audit trail']},
                {'summary': f'Force majeure and dispute resolution language as applied to "{q}" obligations.', 'entities': ['Dispute Resolution Board', 'External Counsel', 'Contract Manager'], 'intent': ['Handle force majeure events', 'Define dispute resolution process']},
            ],
            'qd-003': [
                {'summary': f'Regulatory mandate from GDPR Article 17 relevant to data processing for "{q}".', 'entities': ['GDPR Authority', 'DPO Office', 'Data Subjects'], 'intent': ['Enforce right to erasure', 'Comply with GDPR Article 17']},
                {'summary': f'ISO 27001 control requirements intersecting with "{q}" data handling practices.', 'entities': ['ISO Certification Body', 'ISMS Committee', 'Audit Team'], 'intent': ['Map ISO controls', 'Demonstrate certification compliance']},
                {'summary': f'SOC 2 Type II evidence collection requirements for systems processing "{q}".', 'entities': ['SOC Auditor', 'Trust Services Criteria', 'Security Engineering'], 'intent': ['Collect audit evidence', 'Satisfy trust service criteria']},
                {'summary': f'CCPA consumer rights obligations when processing data related to "{q}".', 'entities': ['Privacy Team', 'Consumer Rights Board', 'Legal Compliance'], 'intent': ['Fulfill CCPA rights requests', 'Document opt-out mechanisms']},
                {'summary': f'Industry-specific financial regulation (MiFID II) rules applicable to "{q}" in trading contexts.', 'entities': ['MiFID II Authority', 'Trading Desk', 'Compliance Officers'], 'intent': ['Apply MiFID II rules', 'Ensure trading compliance']},
            ],
        }
        default_seeds = [
            {'summary': f'Archived knowledge fragment indexed from legacy sources related to "{q}".', 'entities': ['Archive System', 'Legacy Importer'], 'intent': ['Preserve legacy data', 'Enable historical lookup']},
            {'summary': f'Deprecated policy entry superseded by newer regulations addressing "{q}".', 'entities': ['Policy Archive', 'Change Management'], 'intent': ['Mark deprecated policies', 'Maintain historical context']},
            {'summary': f'Cross-reference link between "{q}" and related knowledge artifacts in the graph.', 'entities': ['Graph Engine', 'Cross-Reference Service'], 'intent': ['Enable knowledge linking', 'Improve retrieval coverage']},
            {'summary': f'Summary chunk generated during Bronze → Gold processing pipeline for "{q}".', 'entities': ['ETL Pipeline', 'NLP Engine', 'Summarisation Model'], 'intent': ['Condense source material', 'Generate retrievable summary']},
            {'summary': f'Entity extraction result connecting "{q}" to known organizational hierarchies.', 'entities': ['NER Model', 'Entity Registry', 'Knowledge Graph'], 'intent': ['Extract named entities', 'Link to org hierarchy']},
        ]

        collection_seeds = seeds.get(collection_id, default_seeds)
        return [
            {
                'point_id': f'{collection_id}-pt-{str(i + 1).zfill(3)}',
                'score': round(0.98 - i * 0.04, 2),
                'summary': s['summary'],
                'entities': s['entities'],
                'intent': s['intent'],
            }
            for i, s in enumerate(collection_seeds)
        ]

    # ── Neo4j ──────────────────────────────────────────────────────────────────

    def get_neo4j_graph(self) -> dict:
        return self._kg.get('neo4j', {})

    def query_neo4j(self, cypher: str) -> dict:
        if not cypher:
            raise ValueError('cypher is required')
        return {
            'cypher': cypher,
            'status': 'simulated',
            'rows': [],
            'message': 'Query received. Connect a live Neo4j instance for real results.',
        }

    # ── Conflicts ──────────────────────────────────────────────────────────────

    def get_conflict_batches(self) -> list:
        return self._batches

    def get_conflicts(self) -> dict:
        pending  = [c for c in self._conflicts if c.get('status') == 'pending']
        awaiting = [c for c in self._conflicts if c.get('status') == 'awaiting']
        resolved = [c for c in self._conflicts if c.get('status') == 'resolved']

        batches = []
        for b in self._batches:
            bc = [c for c in pending if c.get('batch_id') == b['id']]
            batches.append({
                'batch_id':                b['id'],
                'batch_name':              b['name'],
                'extracted_date':          b['date'],
                'number_pending_conflict': len(bc),
                'conflicts':               [self._to_summary(c) for c in bc],
            })

        return {
            'pending':  batches,
            'awaiting': [self._to_summary(c) for c in awaiting],
            'resolved': [self._to_summary(c) for c in resolved],
        }

    def _to_summary(self, c: dict) -> dict:
        return {
            'conflict_id':   c['conflict_id'],
            'conflict_type': c['conflict_type'],
            'severity':      c['severity'],
            'detected_at':   c['detected_at'],
        }

    def get_conflict_detail(self, conflict_id: str) -> dict:
        c = next((x for x in self._conflicts if x['conflict_id'] == conflict_id), None)
        if c is None:
            raise KeyError(f"Conflict '{conflict_id}' not found")

        def normalise(v):
            return v if isinstance(v, dict) else {'text': v}

        return {
            'conflict_id':                c['conflict_id'],
            'conflict_type':              c['conflict_type'],
            'where_happens':              c.get('where_happens', ''),
            'severity':                   c['severity'],
            'detected_at':                c['detected_at'],
            'status':                     c['status'],
            'detailed_explanation':       c['detailed_explanation'],
            'existing_snapshot':          normalise(c['existing_snapshot']),
            'incoming_snapshot':          normalise(c['incoming_snapshot']),
            'affected_location':          c.get('affected_location', ''),
            'batch_id':                   c.get('batch_id', ''),
            'resolution_instruction':     c.get('resolution_instruction'),
            'selected_resolution_method': c.get('selected_resolution_method'),
            'resolved_at':                c.get('resolved_at'),
            'resolved_by':                c.get('resolved_by'),
        }

    def resolve_conflict(self, conflict_id: str, body: RequestResolveConflict) -> dict:
        c = next((x for x in self._conflicts if x['conflict_id'] == conflict_id), None)
        if c is None:
            raise KeyError(f"Conflict '{conflict_id}' not found")

        is_merge   = body.selected_resolution_method.value == 'Merge'
        new_status = 'awaiting' if is_merge else 'resolved'
        now        = self._now_utc('%Y-%m-%d %H:%M UTC')

        c['status']                     = new_status
        c['selected_resolution_method'] = body.selected_resolution_method.value
        c['resolution_instruction']     = body.resolution_instruction
        if new_status == 'resolved':
            c['resolved_at'] = now
            c['resolved_by'] = 'Platform Admin'

        return {
            'conflict_id':                conflict_id,
            'status':                     new_status,
            'selected_resolution_method': body.selected_resolution_method.value,
            'resolution_instruction':     body.resolution_instruction,
            'resolved_at':                c.get('resolved_at'),
            'resolved_by':                c.get('resolved_by'),
        }

    # ── Filter policies ────────────────────────────────────────────────────────

    def get_filter_policies(self) -> list:
        return self._filter_policies

    def create_filter_policy(self, body: dict) -> dict:
        name    = body.get('name')
        type_   = body.get('type')
        content = body.get('content')
        if not name or not type_ or content is None:
            raise ValueError('name, type, and content are required')
        new_id = f'FP-{str(len(self._filter_policies) + 1).zfill(3)}'
        policy = {
            'id':        new_id,
            'name':      name,
            'type':      type_,
            'content':   content,
            'added_by':  body.get('added_by', 'user'),
            'added_when': self._now_utc('%Y-%m-%d'),
            'active':    True,
        }
        self._filter_policies.append(policy)
        return policy

    def get_filter_policy(self, policy_id: str) -> dict:
        p = next((p for p in self._filter_policies if p['id'] == policy_id), None)
        if p is None:
            raise KeyError('Policy not found')
        return p

    def update_filter_policy(self, policy_id: str, body: dict) -> dict:
        idx = next((i for i, p in enumerate(self._filter_policies) if p['id'] == policy_id), None)
        if idx is None:
            raise KeyError('Policy not found')
        for field in ('name', 'type', 'content', 'active'):
            if field in body:
                self._filter_policies[idx][field] = body[field]
        return self._filter_policies[idx]

    def delete_filter_policy(self, policy_id: str) -> dict:
        idx = next((i for i, p in enumerate(self._filter_policies) if p['id'] == policy_id), None)
        if idx is None:
            raise KeyError('Policy not found')
        return self._filter_policies.pop(idx)

    # ── Extraction policy ──────────────────────────────────────────────────────

    def get_extraction_policy(self) -> dict:
        return self._extraction

    def update_extraction_policy_custom(self, custom: str) -> dict:
        self._extraction['custom'] = custom
        return self._extraction


# ── App ───────────────────────────────────────────────────────────────────────

_service = JsonKBService()

app = FastAPI(title='AeroFlow KB Testing Server')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    """Re-format HTTPException so the response body matches what mockApi.ts expects.

    FastAPI's default wraps detail in {"detail": ...}, but the UI reads
    j?.error or j?.error?.message directly from the top-level body.
    """
    detail = exc.detail
    if isinstance(detail, dict):
        return JSONResponse(status_code=exc.status_code, content=detail)
    return JSONResponse(status_code=exc.status_code, content={'error': str(detail)})


app.dependency_overrides[get_service] = lambda: _service
app.include_router(router)

if __name__ == '__main__':
    uvicorn.run(
        'server:app',
        host='0.0.0.0',
        port=PORT,
        reload=True,
        reload_dirs=[str(SERVER_DIR), str(Path(__file__).parent)],
    )
