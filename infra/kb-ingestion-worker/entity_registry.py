"""
Entity Registry — semantic deduplication and normalisation for extracted entities.

Each unique entity (per tenant) is stored in the entity_registry Qdrant collection.
Point ID is a deterministic UUID v5:  uuid5(NS, "{tenant_id}:{canonical}")
so an upsert is idempotent — re-processing the same entity never creates a duplicate.

Canonical form: lower_case_with_underscore  (e.g. "Retrieval-Augmented Generation" → "retrieval_augmented_generation")

Matching rules (checked in order, first match wins):
  1. cosine ≥ ENTITY_SIMILARITY_THRESHOLD  → definite match
  2. cosine ≥ ENTITY_SOFT_THRESHOLD  AND  word-overlap Jaccard ≥ ENTITY_WORD_OVERLAP_THRESHOLD
     → same entity, different surface form
  3. none matched → new entity; register and return candidate canonical
"""
from __future__ import annotations

import logging
import re
import uuid

from qdrant_client import models
from qdrant_client.async_qdrant_client import AsyncQdrantClient

from services.database_connector.model_connector import ModelServiceClient
import config as cfg

log = logging.getLogger(__name__)

# Stable namespace for deterministic entity UUIDs
_ENTITY_NS = uuid.UUID("6ba7b812-9dad-11d1-80b4-00c04fd430c9")


# ── Canonical normalisation ────────────────────────────────────────────────────

def to_canonical(name: str) -> str:
    """Convert any entity surface form to lower_case_with_underscore canonical."""
    s = name.lower().strip()
    s = re.sub(r"[\s\-/\\]+", "_", s)   # whitespace / hyphens / slashes → _
    s = re.sub(r"[^a-z0-9_]", "", s)     # drop everything else
    s = re.sub(r"_+", "_", s).strip("_") # collapse runs, trim edges
    return s


def _word_overlap(a: str, b: str) -> float:
    """Jaccard similarity on word token sets (handles spaces and underscores)."""
    tokens_a = set(re.split(r"[\s_\-]+", a.lower())) - {""}
    tokens_b = set(re.split(r"[\s_\-]+", b.lower())) - {""}
    if not tokens_a or not tokens_b:
        return 0.0
    return len(tokens_a & tokens_b) / len(tokens_a | tokens_b)


def _entity_point_id(tenant_id: str, canonical: str) -> str:
    return str(uuid.uuid5(_ENTITY_NS, f"{tenant_id}:{canonical}"))


# ── Qdrant helpers ─────────────────────────────────────────────────────────────

def _tenant_filter(tenant_id: str) -> models.Filter:
    return models.Filter(must=[
        models.FieldCondition(key="tenant_id", match=models.MatchValue(value=tenant_id)),
        models.FieldCondition(key="is_deleted", match=models.MatchValue(value=False)),
    ])


async def _lookup_existing(
    qdrant: AsyncQdrantClient,
    tenant_id: str,
    raw: str,
    embedding: list[float],
) -> str | None:
    """Return canonical name of the best matching existing entity, or None."""
    match = await _lookup_existing_with_score(qdrant, tenant_id, raw, embedding)
    return match[0] if match else None


async def _lookup_existing_with_score(
    qdrant: AsyncQdrantClient,
    tenant_id: str,
    raw: str,
    embedding: list[float],
) -> tuple[str, float, str] | None:
    """Return (canonical, score, action) of the best match, or None if no match.

    action is "matched_hard" (cosine >= ENTITY_SIMILARITY_THRESHOLD) or
    "matched_soft" (cosine >= ENTITY_SOFT_THRESHOLD + word-overlap).
    """
    try:
        resp = await qdrant.query_points(
            collection_name=cfg.ENTITY_COLLECTION,
            query=embedding,
            limit=3,
            query_filter=_tenant_filter(tenant_id),
            with_payload=True,
        )
        hits = resp.points
    except Exception as exc:
        log.warning("entity_registry | lookup failed: %s", exc)
        return None

    for hit in hits:
        score = hit.score
        payload = hit.payload or {}
        existing_canonical: str = payload.get("canonical", "")
        existing_aliases: list[str] = payload.get("aliases", [])

        if score >= cfg.ENTITY_SIMILARITY_THRESHOLD:
            log.debug("entity_registry | hit score=%.3f %r → %r", score, raw, existing_canonical)
            return (existing_canonical, score, "matched_hard")

        if score >= cfg.ENTITY_SOFT_THRESHOLD:
            overlap = max(
                _word_overlap(raw, existing_canonical.replace("_", " ")),
                *(_word_overlap(raw, a) for a in existing_aliases),
                0.0,
            )
            if overlap >= cfg.ENTITY_WORD_OVERLAP_THRESHOLD:
                log.debug(
                    "entity_registry | word-overlap match score=%.3f overlap=%.2f %r → %r",
                    score, overlap, raw, existing_canonical,
                )
                return (existing_canonical, score, "matched_soft")

    return None


async def _upsert_entity(
    qdrant: AsyncQdrantClient,
    tenant_id: str,
    canonical: str,
    raw: str,
    description: str,
    embedding: list[float],
) -> None:
    """Insert a new entity or add raw as an alias to an existing canonical."""
    point_id = _entity_point_id(tenant_id, canonical)

    try:
        existing = await qdrant.retrieve(
            collection_name=cfg.ENTITY_COLLECTION,
            ids=[point_id],
            with_payload=True,
        )
    except Exception:
        existing = []

    if existing:
        # Canonical exists — append alias and update description + vector if we
        # now have a richer description than what was stored.
        payload = existing[0].payload or {}
        current_aliases: list[str] = payload.get("aliases", [])
        updates: dict = {}
        if raw not in current_aliases and raw != canonical.replace("_", " "):
            current_aliases.append(raw)
            updates["aliases"] = current_aliases
        if description and not payload.get("description"):
            updates["description"] = description
            await qdrant.upsert(
                collection_name=cfg.ENTITY_COLLECTION,
                points=[models.PointStruct(
                    id=point_id, vector=embedding,
                    payload={**payload, **updates},
                )],
            )
            return
        if updates:
            await qdrant.set_payload(
                collection_name=cfg.ENTITY_COLLECTION,
                payload=updates,
                points=[point_id],
            )
        return

    # New entity
    aliases = [raw] if raw != canonical.replace("_", " ") else []
    await qdrant.upsert(
        collection_name=cfg.ENTITY_COLLECTION,
        points=[
            models.PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "tenant_id":   tenant_id,
                    "canonical":   canonical,
                    "aliases":     aliases,
                    "description": description,
                    "is_deleted":  False,
                },
            )
        ],
    )
    log.debug("entity_registry | registered canonical=%r raw=%r", canonical, raw)


# ── Public API ─────────────────────────────────────────────────────────────────

async def normalize_entities(
    qdrant: AsyncQdrantClient,
    model: ModelServiceClient,
    tenant_id: str,
    raw_entities: list[dict[str, str]],
) -> list[str]:
    """Normalise raw entities — returns deduplicated canonical name list."""
    canonicals, _ = await normalize_entities_detailed(qdrant, model, tenant_id, raw_entities)
    return canonicals


async def normalize_entities_detailed(
    qdrant: AsyncQdrantClient,
    model: ModelServiceClient,
    tenant_id: str,
    raw_entities: list[dict[str, str]],
) -> tuple[list[str], list[dict]]:
    """Normalise raw entities and return canonicalization details for each.

    Returns:
        (canonical_names, details) where each detail dict contains:
            raw        — original surface form
            canonical  — resolved canonical name
            action     — "matched_hard" | "matched_soft" | "new"
            similarity — cosine score if matched, None if new
    """
    clean = [
        {
            "name":        e["name"].strip(),
            "description": (e.get("description") or "").strip(),
            "embed_text":  (e.get("description") or e["name"]).strip(),
        }
        for e in raw_entities
        if isinstance(e, dict) and e.get("name", "").strip()
    ]
    if not clean:
        return [], []

    try:
        embeddings = await model.embed([e["embed_text"] for e in clean])
    except Exception as exc:
        log.warning("entity_registry | embed failed (%s) — falling back to canonical-only", exc)
        fallback = list(dict.fromkeys(
            c for e in clean if (c := to_canonical(e["name"]))
        ))
        details = [
            {"raw": e["name"], "canonical": to_canonical(e["name"]), "action": "new", "similarity": None}
            for e in clean
        ]
        return fallback, details

    result: list[str] = []
    details: list[dict] = []

    for entry, embedding in zip(clean, embeddings):
        raw                 = entry["name"]
        description         = entry["description"]
        canonical_candidate = to_canonical(raw)
        if not canonical_candidate:
            continue

        match = await _lookup_existing_with_score(qdrant, tenant_id, raw, embedding)
        if match:
            existing_canonical, score, action = match
            result.append(existing_canonical)
            details.append({
                "raw":        raw,
                "canonical":  existing_canonical,
                "action":     action,
                "similarity": round(score, 4),
            })
        else:
            await _upsert_entity(qdrant, tenant_id, canonical_candidate, raw, description, embedding)
            result.append(canonical_candidate)
            details.append({
                "raw":        raw,
                "canonical":  canonical_candidate,
                "action":     "new",
                "similarity": None,
            })

    seen: set[str] = set()
    deduped_names: list[str] = []
    deduped_details: list[dict] = []
    for name, detail in zip(result, details):
        if name not in seen:
            seen.add(name)
            deduped_names.append(name)
            deduped_details.append(detail)
    return deduped_names, deduped_details
