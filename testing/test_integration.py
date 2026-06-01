"""
Integration tests: UI -> router -> services (Postgres / Qdrant / Neo4j).

Each test hits a real FastAPI endpoint backed by the live Docker databases
that were seeded by testing/mockdata/seed.py.

Run from the project root:
    python -m pytest testing/test_integration.py -v
"""

import sys
from pathlib import Path

# Ensure both project root and server/ are on the path (same as main.py)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from main import app  # type: ignore

HEADERS = {"Authorization": "Bearer demo-admin"}


@pytest_asyncio.fixture(scope="session")
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", headers=HEADERS
    ) as c:
        yield c


# ── Fleet ──────────────────────────────────────────────────────────────────────

async def test_fleet_stats(client):
    r = await client.get("/api/fleet/stats")
    assert r.status_code == 200
    data = r.json()["data"]
    assert "content" in data
    assert "qdrant_collections" in data
    assert data["neo4j_nodes"] > 0
    assert data["neo4j_relationships"] > 0


# ── Documents (Inventory) ─────────────────────────────────────────────────────

async def test_get_documents(client):
    r = await client.get("/api/data/documents")
    assert r.status_code == 200
    docs = r.json()["data"]
    assert isinstance(docs, list)
    assert len(docs) >= 4  # 3 bronze + 1 silver + 1 gold doc + 1 warehouse
    layers = {d["layer"] for d in docs}
    assert "BRONZE" in layers
    assert "SILVER" in layers
    assert "GOLD" in layers


async def test_promote_document(client):
    r = await client.get("/api/data/documents")
    bronze = next(d for d in r.json()["data"] if d["layer"] == "BRONZE" and d["metadata"].get("type", "").startswith("Doc/"))
    doc_id = bronze["id"]

    patch = await client.patch(f"/api/data/documents/{doc_id}", json={"layer": "SILVER"})
    assert patch.status_code == 200

    # Restore to bronze so state is clean
    await client.patch(f"/api/data/documents/{doc_id}", json={"layer": "BRONZE"})


# ── Knowledge Hub — DATABASE tab ──────────────────────────────────────────────

async def test_get_gold_documents(client):
    r = await client.get("/api/knowledge/documents")
    assert r.status_code == 200
    docs = r.json()["data"]
    assert all(d["layer"] == "GOLD" for d in docs)
    assert len(docs) >= 1


async def test_get_chunks(client):
    r = await client.get("/api/knowledge/documents")
    gold_doc = next(
        d for d in r.json()["data"]
        if not (d["metadata"].get("type") or "").startswith("Warehouse/")
    )
    doc_id = gold_doc["id"]

    r2 = await client.get(f"/api/knowledge/documents/{doc_id}/chunks")
    assert r2.status_code == 200
    chunks = r2.json()["data"]
    assert len(chunks) == 3
    for chunk in chunks:
        assert "id" in chunk
        assert "title" in chunk
        assert "versions" in chunk
        active = [v for v in chunk["versions"] if v["status"] == "active"]
        assert len(active) == 1


async def test_get_tables(client):
    r = await client.get("/api/knowledge/documents")
    gold_doc = next(
        d for d in r.json()["data"]
        if not (d["metadata"].get("type") or "").startswith("Warehouse/")
    )
    doc_id = gold_doc["id"]

    r2 = await client.get(f"/api/knowledge/documents/{doc_id}/tables")
    assert r2.status_code == 200
    tables = r2.json()["data"]
    assert len(tables) >= 1
    t = tables[0]
    assert "table_name" in t
    assert "data" in t
    assert "columns" in t["data"]
    assert "rows" in t["data"]


async def test_create_and_activate_chunk_version(client):
    r = await client.get("/api/knowledge/documents")
    gold_doc = next(
        d for d in r.json()["data"]
        if not (d["metadata"].get("type") or "").startswith("Warehouse/")
    )
    doc_id = gold_doc["id"]

    chunks_r = await client.get(f"/api/knowledge/documents/{doc_id}/chunks")
    chunk = chunks_r.json()["data"][0]
    chunk_id = chunk["id"]

    # Create new version
    cr = await client.post(
        f"/api/knowledge/documents/{doc_id}/chunks/{chunk_id}/versions",
        json={"text": "New version content for integration test"},
    )
    assert cr.status_code == 201
    new_version_num = cr.json()["data"]["version_number"]

    # Activate new version
    ar = await client.patch(
        f"/api/knowledge/documents/{doc_id}/chunks/{chunk_id}/activate",
        json={"version_number": new_version_num},
    )
    assert ar.status_code == 200

    # Re-activate version 2 (restore)
    await client.patch(
        f"/api/knowledge/documents/{doc_id}/chunks/{chunk_id}/activate",
        json={"version_number": 2},
    )


# ── Qdrant collections ────────────────────────────────────────────────────────

async def test_get_qdrant_collections(client):
    r = await client.get("/api/knowledge/qdrant/collections")
    assert r.status_code == 200
    cols = r.json()["data"]
    assert len(cols) >= 2
    names = {c["name"] for c in cols}
    assert "kb_chunks_v1" in names
    assert "kb_tables_v1" in names
    for c in cols:
        assert "id" in c
        assert "active" in c
        assert "dimensions" in c


async def test_toggle_qdrant_collection(client):
    r = await client.get("/api/knowledge/qdrant/collections")
    col = r.json()["data"][0]
    col_id = col["id"]
    original = col["active"]

    # Toggle off
    toggle = await client.patch(
        f"/api/knowledge/qdrant/collections/{col_id}",
        json={"active": not original},
    )
    assert toggle.status_code == 200

    # Restore
    await client.patch(
        f"/api/knowledge/qdrant/collections/{col_id}",
        json={"active": original},
    )


async def test_qdrant_search(client):
    r = await client.get("/api/knowledge/qdrant/collections")
    chunks_col = next(c for c in r.json()["data"] if c["name"] == "kb_chunks_v1")
    col_id = chunks_col["id"]

    sr = await client.post(
        f"/api/knowledge/qdrant/collections/{col_id}/search",
        json={"query": "RAG"},
    )
    assert sr.status_code == 200
    results = sr.json()["data"]
    assert isinstance(results, list)
    # At least one result should match 'rag' in its payload
    assert len(results) >= 1
    assert "summary" in results[0]


# ── Neo4j ─────────────────────────────────────────────────────────────────────

async def test_get_neo4j_graph(client):
    r = await client.get("/api/knowledge/neo4j/graph")
    assert r.status_code == 200
    graph = r.json()["data"]
    assert "nodes" in graph
    assert "edges" in graph
    assert len(graph["nodes"]) == 10
    assert len(graph["edges"]) >= 9
    for node in graph["nodes"]:
        assert "id" in node
        assert "name" in node


# ── Conflicts ─────────────────────────────────────────────────────────────────

async def test_get_conflicts(client):
    r = await client.get("/api/knowledge/conflicts")
    assert r.status_code == 200
    data = r.json()["data"]
    assert "pending" in data
    assert "awaiting" in data
    assert "resolved" in data
    assert len(data["pending"]) == 1
    batch = data["pending"][0]
    assert "batch_name" in batch
    assert "extracted_date" in batch
    assert "number_pending_conflict" in batch
    assert batch["number_pending_conflict"] == 2
    assert len(data["awaiting"]) == 1
    assert len(data["resolved"]) == 1


async def test_get_conflict_detail(client):
    r = await client.get("/api/knowledge/conflicts")
    pending_conflict = r.json()["data"]["pending"][0]["conflicts"][0]
    conflict_id = pending_conflict["conflict_id"]

    dr = await client.get(f"/api/knowledge/conflicts/{conflict_id}")
    assert dr.status_code == 200
    detail = dr.json()["data"]
    assert detail["conflict_id"] == conflict_id
    assert "conflict_type" in detail
    assert "severity" in detail
    assert "detailed_explanation" in detail
    assert "existing_snapshot" in detail
    assert "incoming_snapshot" in detail


async def test_resolve_conflict_keep_existing(client):
    r = await client.get("/api/knowledge/conflicts")
    pending_conflict = r.json()["data"]["pending"][0]["conflicts"][0]
    conflict_id = pending_conflict["conflict_id"]

    rr = await client.patch(
        f"/api/knowledge/conflicts/{conflict_id}",
        json={"selected_resolution_method": "Keep Existing"},
    )
    assert rr.status_code == 200
    result = rr.json()["data"]
    assert result["status"] == "resolved"

    # Restore to pending for idempotency
    import services.database_connector.postgres.db_client as pg
    import uuid as _uuid
    await pg.update("KBConflict", {"conflict_id": _uuid.UUID(conflict_id), "status": "pending", "resolved_by": None})


# ── Policies ──────────────────────────────────────────────────────────────────

async def test_get_filter_policies(client):
    r = await client.get("/api/knowledge/policies/filtering")
    assert r.status_code == 200
    policies = r.json()["data"]
    assert len(policies) >= 2
    for p in policies:
        assert "id" in p
        assert "name" in p
        assert "type" in p
        assert p["type"] in ("natural_language", "exact_word")
        assert "content" in p


async def test_create_update_delete_filter_policy(client):
    # Create
    cr = await client.post(
        "/api/knowledge/policies/filtering",
        json={
            "name":    "Test Policy",
            "type":    "natural_language",
            "content": "Remove all test markers from documents",
        },
    )
    assert cr.status_code == 201
    policy_id = str(cr.json()["data"]["policy_id"])

    # Read back
    gr = await client.get(f"/api/knowledge/policies/filtering/{policy_id}")
    assert gr.status_code == 200
    assert gr.json()["data"]["name"] == "Test Policy"

    # Update
    ur = await client.put(
        f"/api/knowledge/policies/filtering/{policy_id}",
        json={"name": "Test Policy Updated", "type": "exact_word", "content": '["marker1","marker2"]'},
    )
    assert ur.status_code == 200

    # Delete
    dr = await client.delete(f"/api/knowledge/policies/filtering/{policy_id}")
    assert dr.status_code == 200


async def test_get_extraction_policy(client):
    r = await client.get("/api/knowledge/policies/extraction")
    assert r.status_code == 200
    ep = r.json()["data"]
    assert "base" in ep
    assert "custom" in ep


async def test_update_extraction_policy(client):
    r = await client.put(
        "/api/knowledge/policies/extraction/custom",
        json={"custom": "Extract all financial entities and metric values."},
    )
    assert r.status_code == 200

    # Restore original value
    await client.put(
        "/api/knowledge/policies/extraction/custom",
        json={"custom": "Extract organisations, financial metrics, and product names."},
    )
