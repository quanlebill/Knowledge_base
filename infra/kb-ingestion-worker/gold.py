"""
Gold stage: load silver chunks → extract entities/relations/intents via LLM →
embed via model-service → conflict detect → atomic commit (Postgres + Qdrant + Neo4j).

See original module docstring for full transaction and canonicalization guarantees.
"""
from __future__ import annotations

import json
import logging
import re
import time as _time
import uuid
from typing import Any

import llama_client
import entity_registry
from neo4j import AsyncDriver
from qdrant_client import models as qmodels
from qdrant_client.async_qdrant_client import AsyncQdrantClient
from sqlalchemy import update as sa_update

from basemodel.services_databaseconnector.postgres_model import (
    ConflictResolution,
    ConflictSeverity,
    ConflictStatus,
    ConflictType,
    KBConflictBatchInsert,
    KBConflictInsert,
    KBLifecycleHistoryInsert,
    Tier,
)
from basemodel.services_databaseconnector.postgres_orm.knowledge_base_orm import (
    KBDataORM,
    KBTextBlockORM,
    KBTextBlockVersionORM,
    KBTextTableORM,
)
from basemodel.services_databaseconnector.qdrant_model import (
    SearchRequest,
)
from services.database_connector.model_connector import ModelServiceClient
from services.database_connector.mongo_connector import MongoClient
from services.database_connector.postgres_connector import PostgresClient
from services.database_connector.qdrant_connector import (
    vector_search as qdrant_vector_search,
)

import config as cfg
from pipeline_events import PipelineEventEmitter

log = logging.getLogger(__name__)

_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)
_JSON_OBJ   = re.compile(r"\{[\s\S]*\}", re.DOTALL)
_CAPS_RE    = re.compile(r"\b([A-Z][a-z]{1,}(?:[A-Z][a-z]{0,})*|[A-Z]{2,})\b")

# Words that are never meaningful knowledge-graph entities regardless of context.
_GENERIC_BLACKLIST: frozenset[str] = frozenset({
    "model", "models", "system", "systems", "approach", "approaches",
    "method", "methods", "technique", "techniques", "architecture", "architectures",
    "pipeline", "pipelines", "module", "modules", "component", "components",
    "network", "networks", "framework", "frameworks", "process", "processes",
    "training", "evaluation", "fine-tuning", "finetuning", "fine tuning",
    "inference", "generation", "optimization", "processing", "learning",
    "testing", "performance", "result", "results", "output", "outputs",
    "input", "inputs", "feature", "features", "layer", "layers",
    "representation", "representations", "embedding", "embeddings",
    "vector", "vectors", "weight", "weights", "parameter", "parameters",
    "gradient", "gradients", "loss", "function", "functions",
    "data", "task", "tasks", "problem", "problems", "solution", "solutions",
    "work", "paper", "papers", "document", "documents", "section",
    "table", "figure", "equation", "experiment", "experiments",
    "baseline", "baselines", "ablation", "setup", "implementation",
    "configuration", "setting", "settings", "mechanism", "mechanisms",
    "operation", "operations", "procedure", "procedures", "strategy",
    "strategies", "scheme", "schemes", "step", "steps", "stage", "stages",
})


# ── LLM helpers ───────────────────────────────────────────────────────────────

def _json_hint(raw: str, exc: json.JSONDecodeError) -> str:
    msg = str(exc).lower()
    if "unterminated" in msg:
        return "your response was cut off before the JSON closed — use shorter values"
    if exc.pos and exc.pos >= len(raw) - 5:
        return "your response was truncated at the end — use shorter values"
    if "expecting" in msg or "invalid" in msg:
        return f"syntax error near position {exc.pos} — return only a valid JSON object, no extra text"
    return "response is not valid JSON — return only the JSON object with no markdown or extra text"


async def _llm_generate_json(
    system_prompt: str,
    user: str,
    max_tokens: int = 1024,
    grammar_gbnf: str = "",
    temperature: float = 0.1,
    max_retries: int = 2,
) -> tuple[dict, str, int]:
    """Returns (parsed_dict, last_raw_response, attempts_used)."""
    current_user = user
    last_hint = ""
    last_raw = ""

    for attempt in range(max_retries):
        raw = await llama_client.chat_json(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": current_user},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
            grammar_gbnf=grammar_gbnf,
        )
        last_raw = raw
        log.debug("Gold LLM raw attempt %d (first 300): %r", attempt + 1, raw[:300])

        fence_m = _JSON_FENCE.search(raw)
        if fence_m:
            candidate = fence_m.group(1).strip()
        else:
            obj_m = _JSON_OBJ.search(raw)
            candidate = obj_m.group(0) if obj_m else raw.strip()

        candidate = candidate.replace("\r\n", " ").replace("\r", " ").replace("\n", " ")

        try:
            return json.loads(candidate), raw, attempt + 1
        except json.JSONDecodeError as exc:
            last_hint = _json_hint(raw, exc)
            log.warning("Gold LLM JSON invalid (attempt %d/%d): %s", attempt + 1, max_retries, last_hint)
            current_user = f"{user}\n\nNote: {last_hint}."

    raise ValueError(f"LLM failed to return valid JSON after {max_retries} attempts: {last_hint}")


# ── Prompts ───────────────────────────────────────────────────────────────────

_ENTITY_INTENT_SYSTEM = """\
You are a knowledge extraction assistant for scientific and technical documents.

Given a text chunk, return JSON with exactly three keys: summary, entities, intents.

── 1. summary ──────────────────────────────────────────────────────────────────
One complete sentence (≤ 25 words) capturing the single most important idea.

── 2. entities (up to 8) ───────────────────────────────────────────────────────
Extract ONLY named, specific items that have a distinct identity of their own.
Each entity MUST have a "name" and a "description" (≤ 15 words).

INCLUDE — things that could be the title of a Wikipedia article or research paper:
  • Named models / architectures : BERT, GPT-3, BART, T5, ResNet, Transformer
  • Named systems / frameworks   : FAISS, Elasticsearch, REALM, Haystack, PyTorch
  • Named algorithms / methods   : DPR, BM25, RLHF, LoRA, AdaGrad, beam search
  • Named datasets / benchmarks  : TriviaQA, SQuAD, MMLU, ImageNet, MS MARCO
  • Named organisations / labs   : Google Brain, DeepMind, Hugging Face, OpenAI
  • Specific measurable metrics  : BLEU score, exact-match, Recall@5, perplexity
  • Precise technical concepts   : parametric memory, attention mechanism, knowledge graph

EXCLUDE — generic language that does NOT identify a specific named thing:
  ✗ Generic nouns       : model, system, approach, method, technique, architecture,
                          pipeline, module, component, network, framework, process
  ✗ Process words       : training, evaluation, fine-tuning, inference, generation,
                          optimization, processing, learning, testing, performance
  ✗ Descriptive words   : large, small, pre-trained, dense, sparse, efficient,
                          novel, proposed, existing, previous, recent, new

SELF-CHECK before including each entity:
  "Can I find an article or paper with exactly this name?"  → if NO, exclude it.
  "Could 'model' or 'method' replace this name?" → if YES, exclude it.

── 3. intents (2–4, snake_case) ────────────────────────────────────────────────
Describe the PURPOSE of the chunk. Choose from:
  information_retrieval, text_generation, knowledge_grounding, model_training,
  question_answering, document_indexing, entity_extraction, graph_construction,
  benchmarking, data_preprocessing, architecture_design, multimodal_processing
Add a custom label only if none of the above fits.

── 4. skip (boolean) ────────────────────────────────────────────────────────────
Set "skip": true ONLY if the chunk has NO meaningful technical content to index:
  • Pure reference / bibliography lists (e.g. "[1] Smith et al., 2020. Title…")
  • Isolated section headers or page numbers with no prose
  • Pure acknowledgements with no technical claims
  • Boilerplate legal/copyright text
For any chunk with at least one sentence of factual or technical content: "skip": false.

── Output format (JSON only — no markdown, no extra text) ──────────────────────
{"summary":"…","entities":[…],"intents":[…],"skip":false}

── Example ─────────────────────────────────────────────────────────────────────
Input:
"RAG combines BART with DPR to retrieve passages from a Wikipedia dense index.
 The system is fine-tuned end-to-end on Natural Questions and TriviaQA."
Output:
{"summary":"RAG jointly fine-tunes BART and DPR on Wikipedia retrieval for open-domain QA.",
 "entities":[
   {"name":"RAG","description":"Retrieval-Augmented Generation model combining retrieval and generation."},
   {"name":"BART","description":"Pre-trained seq2seq model serving as the RAG generator component."},
   {"name":"DPR","description":"Dense Passage Retriever for indexing and querying Wikipedia passages."},
   {"name":"Wikipedia","description":"Non-parametric knowledge source stored as a dense vector index."},
   {"name":"Natural Questions","description":"Open-domain QA benchmark dataset used for fine-tuning."},
   {"name":"TriviaQA","description":"Trivia-based QA benchmark used for evaluation."}
 ],
 "intents":["information_retrieval","model_training","question_answering"],"skip":false}"""


_RELATIONSHIP_SYSTEM = """\
You build knowledge graph edges. Given a list of ENTITIES and a TEXT, output relationships between those entities.

OUTPUT FORMAT — return exactly this JSON, nothing else:
{"relationships":[{"from":"...","to":"...","type":"..."}]}

STRICT RULES:
1. "from" and "to" values MUST be copied CHARACTER-FOR-CHARACTER from the ENTITIES list.
   No added words, no changed capitalisation, no abbreviations.
2. "type" is an UPPER_SNAKE_CASE verb (e.g. USES, EXTENDS, TRAINED_ON, EVALUATES_ON, OUTPERFORMS, COMBINES_WITH, RETRIEVES_FROM, PART_OF, IMPROVES, REPLACES).
3. Include relationships that are stated OR clearly implied by the text.
4. Return 1–8 relationships if entities interact. Return {"relationships":[]} only if no two entities relate at all.

EXAMPLE:
ENTITIES: ["RAG", "DPR", "BART", "SQuAD"]
TEXT: "RAG combines DPR for retrieval with BART for generation and is evaluated on SQuAD."
OUTPUT: {"relationships":[{"from":"RAG","to":"DPR","type":"USES"},{"from":"RAG","to":"BART","type":"USES"},{"from":"DPR","to":"BART","type":"FEEDS_INTO"},{"from":"RAG","to":"SQuAD","type":"EVALUATED_ON"}]}"""


_CONFLICT_SYSTEM = """\
Compare two knowledge summaries. Decide if there is a conflict.
Conflict types: content_contradiction, content_conflict, content_duplicate, content_update.
Severity: low, medium, high.
Output a JSON object with keys: has_conflict (bool), conflict_type (string), severity (string), explanation (max 20 words)."""


SYSTEM_PROMPTS: dict[str, str] = {
    "entity-intent": _ENTITY_INTENT_SYSTEM,
    "relationship":  _RELATIONSHIP_SYSTEM,
    "conflict":      _CONFLICT_SYSTEM,
}


# ── Extraction helpers ────────────────────────────────────────────────────────

def _to_str_list(v: Any) -> list[str]:
    if not isinstance(v, list):
        return []
    result = []
    for item in v:
        if isinstance(item, str):
            result.append(item)
        elif isinstance(item, dict):
            result.append(str(
                item.get("name") or item.get("entity") or next(iter(item.values()), "")
            ))
        else:
            result.append(str(item))
    return [s.strip() for s in result if s.strip()]


def _to_entity_list(v: Any) -> list[dict[str, str]]:
    if not isinstance(v, list):
        return []
    result = []
    seen: set[str] = set()
    for item in v:
        if isinstance(item, dict):
            name = str(item.get("name") or "").strip()
            desc = str(item.get("description") or "").strip()
        elif isinstance(item, str):
            name = item.strip()
            desc = ""
        else:
            continue
        if not name or len(name) < 2:
            continue
        if name.lower() in _GENERIC_BLACKLIST:
            log.debug("Gold: filtered generic entity %r", name)
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append({"name": name, "description": desc})
    return result


def _fallback_extract(content: str) -> dict[str, Any]:
    words = content.split()
    first_sentence = re.split(r"[.!?]", content, maxsplit=1)[0].strip()
    summary = " ".join(first_sentence.split()[:25]) or " ".join(words[:25])
    caps = list(dict.fromkeys(m.group(1) for m in _CAPS_RE.finditer(content)))[:8]
    raw_caps: list[str] = caps if caps else ([words[0]] if words else ["document"])
    entities: list[dict[str, str]] = [{"name": e, "description": ""} for e in raw_caps]
    lower = content.lower()
    intents: list[str] = []
    if any(w in lower for w in ("retrieval", "search", "query", "retriev")):
        intents.append("information_retrieval")
    if any(w in lower for w in ("model", "neural", "train", "learn", "gradient")):
        intents.append("machine_learning")
    if any(w in lower for w in ("generate", "generation", "output", "answer")):
        intents.append("text_generation")
    if any(w in lower for w in ("knowledge", "entity", "graph", "relation")):
        intents.append("knowledge_extraction")
    if not intents:
        intents = ["document_content"]
    return {"summary": summary, "entities": entities, "intents": intents}


async def _stage1_entity_intent(content: str) -> dict[str, Any]:
    raw_answers: list[dict] = []   # [{attempt, temp, text}]
    attempts_used = 0
    for attempt, temp in enumerate([0.1, 0.3]):
        try:
            result, raw, _ = await _llm_generate_json(
                _ENTITY_INTENT_SYSTEM,
                content[:3000],
                max_tokens=1024,
                grammar_gbnf="",   # no GBNF — need extra 'skip' field
                temperature=temp,
            )
            raw_answers.append({"attempt": attempt + 1, "temp": temp, "text": raw[:2000]})
            attempts_used = attempt + 1
            summary  = str(result.get("summary") or "").strip()
            entities = _to_entity_list(result.get("entities"))
            intents  = _to_str_list(result.get("intents"))
            skip     = bool(result.get("skip", False))

            if summary and intents:
                log.debug("Gold stage1: OK on attempt %d (entities=%d skip=%s)", attempt + 1, len(entities), skip)
                return {
                    "summary": summary, "entities": entities, "intents": intents,
                    "used_fallback": False, "skip": skip,
                    "raw_answers": raw_answers, "attempts": attempts_used,
                }

            log.warning(
                "Gold stage1: attempt %d incomplete "
                "(summary=%r entities=%d intents=%d) — retrying",
                attempt + 1, bool(summary), len(entities), len(intents),
            )
        except Exception as exc:
            log.warning("Gold stage1: attempt %d failed: %s — retrying", attempt + 1, exc)
            raw_answers.append({"attempt": attempt + 1, "temp": temp, "text": f"ERROR: {exc}"})
            attempts_used = attempt + 1

    log.warning("Gold stage1: heuristic fallback for chunk starting %r", content[:80])
    result = _fallback_extract(content)
    result["used_fallback"] = True
    result["skip"] = False
    result["raw_answers"] = raw_answers
    result["attempts"] = attempts_used
    return result


async def _stage2_relationships(
    content: str, entities: list[str]
) -> tuple[list[dict], list[dict], int]:
    """Returns (valid_relationships, raw_answers[{attempt,temp,text}], attempts_used)."""
    if not entities:
        return [], [], 0

    entity_str = ", ".join(f'"{e}"' for e in entities)
    user_msg = (
        f"ENTITIES: [{entity_str}]\n\n"
        f"TEXT:\n{content[:3000]}\n\n"
        f"Now output the relationships JSON using ONLY the entity names listed in ENTITIES above."
    )
    raw_answers: list[dict] = []   # [{attempt, temp, text}]
    attempts_used = 0

    entity_set = set(entities)
    entity_lower = {e.lower(): e for e in entities}

    def _coerce_s2(name: str) -> str | None:
        """Map LLM-output entity name back to one of the given entity names.

        Handles padded names like 'RAG model' → 'RAG', or wrong case 'bert' → 'BERT'.
        """
        s = str(name).strip()
        if s in entity_set:
            return s
        sl = s.lower()
        # Case-insensitive exact
        if sl in entity_lower:
            return entity_lower[sl]
        # Strip common suffix words added by the model (e.g. "RAG model" → "RAG")
        for suffix in (" model", " system", " network", " framework", " method",
                       " algorithm", " approach", " architecture", " module",
                       " encoder", " decoder", " generator", " retriever"):
            if sl.endswith(suffix):
                trimmed = sl[: -len(suffix)].strip()
                if trimmed in entity_lower:
                    return entity_lower[trimmed]
        # Strip leading articles
        for prefix in ("the ", "a ", "an "):
            if sl.startswith(prefix):
                trimmed = sl[len(prefix):]
                if trimmed in entity_lower:
                    return entity_lower[trimmed]
        # Word-boundary substring: entity name appears as a whole word inside LLM output
        for ename_lower, ename_orig in entity_lower.items():
            if len(ename_lower) >= 3 and re.search(
                r"(?<![a-z0-9])" + re.escape(ename_lower) + r"(?![a-z0-9])", sl
            ):
                return ename_orig
        return None

    for attempt, temp in enumerate([0.1, 0.3]):
        try:
            result, raw, _ = await _llm_generate_json(
                _RELATIONSHIP_SYSTEM,
                user_msg,
                max_tokens=1024,
                grammar_gbnf="",   # Ollama ignores grammar_gbnf; format=json handles structure
                temperature=temp,
            )
            raw_answers.append({"attempt": attempt + 1, "temp": temp, "text": raw[:2000]})
            attempts_used = attempt + 1
            rels = result.get("relationships", [])
            if not isinstance(rels, list):
                log.warning("Gold stage2: attempt %d — 'relationships' is not a list: %r", attempt + 1, type(rels))
                continue
            valid = []
            for r in rels:
                if not isinstance(r, dict):
                    continue
                f = _coerce_s2(str(r.get("from", "")))
                t = _coerce_s2(str(r.get("to", "")))
                rt = str(r.get("type", "")).strip()
                if f and t and rt and f != t:
                    valid.append({**r, "from": f, "to": t})
            log.info(
                "Gold stage2: attempt %d temp=%.1f → %d raw rels, %d valid (entities=%d)",
                attempt + 1, temp, len(rels), len(valid), len(entities),
            )
            if valid:
                return valid, raw_answers, attempts_used
            log.warning(
                "Gold stage2: attempt %d returned no valid rels (raw_rels=%d) — retrying",
                attempt + 1, len(rels),
            )
        except Exception as exc:
            log.warning("Gold stage2: attempt %d failed: %s — retrying", attempt + 1, exc)
            raw_answers.append({"attempt": attempt + 1, "temp": temp, "text": f"ERROR: {exc}"})
            attempts_used = attempt + 1

    log.warning("Gold stage2: all attempts returned no valid relationships — committing without edges")
    return [], raw_answers, attempts_used


async def _extract_chunk(
    content: str,
    emitter: PipelineEventEmitter | None = None,
    block_index: int = 0,
) -> dict[str, Any] | None:
    t_s1 = _time.monotonic()
    stage1 = await _stage1_entity_intent(content)
    s1_ms = round((_time.monotonic() - t_s1) * 1000)

    # LLM flagged this chunk as non-descriptive boilerplate — skip early
    if stage1.get("skip"):
        log.info("_extract_chunk: LLM flagged chunk #%d as boilerplate — skipping", block_index)
        if emitter:
            await emitter.emit("gold.chunk.skipped", {
                "index":  block_index,
                "reason": "boilerplate_no_descriptive_content",
            })
        return None

    entities = stage1["entities"]

    if emitter:
        await emitter.emit("gold.stage1.complete", {
            "index":        block_index,
            "summary":      stage1["summary"],
            "entities":     stage1["entities"],
            "intents":      stage1["intents"],
            "used_fallback": stage1.get("used_fallback", False),
            "duration_ms":  s1_ms,
            "attempts":     stage1.get("attempts", 1),
            "raw_answers":  stage1.get("raw_answers", []),
        })

    if not entities:
        log.warning("_extract_chunk: no entities after blacklist filter — committing with empty entity list")

    entity_names = [e["name"] for e in entities]
    entity_set   = set(entity_names)
    entity_lower = {e.lower(): e for e in entity_names}

    def _coerce(name: str) -> str | None:
        s = str(name).strip()
        if s in entity_set:
            return s
        return entity_lower.get(s.lower())

    def _filter_rels(rels: list[dict]) -> list[dict]:
        valid = []
        for r in rels:
            if not isinstance(r, dict):
                continue
            f = _coerce(str(r.get("from", "")))
            t = _coerce(str(r.get("to", "")))
            rt = str(r.get("type", "")).strip()
            if f and t and rt and f != t:
                valid.append({**r, "from": f, "to": t})
        return valid

    t_s2 = _time.monotonic()
    valid_rels: list[dict] = []
    rel_retries = 0
    s2_raw_answers: list[dict] = []

    if entity_names:
        valid_rels, s2_raw_answers, rel_retries = await _stage2_relationships(content, entity_names)
        # _stage2_relationships already coerces entity names; _filter_rels is a safety pass
        valid_rels = _filter_rels(valid_rels)
    else:
        log.info(
            "_extract_chunk: block #%d has no entities after blacklist filter — "
            "skipping relationship stage",
            block_index,
        )

    s2_ms = round((_time.monotonic() - t_s2) * 1000)

    if emitter:
        await emitter.emit("gold.stage2.complete", {
            "index":         block_index,
            "relationships": valid_rels,
            "duration_ms":   s2_ms,
            "retries":       rel_retries,
            "raw_answers":   s2_raw_answers,
        })

    return {
        "summary":       stage1["summary"],
        "entities":      entities,
        "relationships": valid_rels,
        "intents":       stage1["intents"],
    }


# ── Conflict detection ────────────────────────────────────────────────────────

def _remap_relationship_entities(
    relationships: list[dict],
    raw_to_canonical: dict[str, str],
) -> list[dict]:
    remapped: list[dict] = []
    for rel in relationships:
        raw_from = str(rel.get("from", "")).strip()
        raw_to   = str(rel.get("to",   "")).strip()
        if not raw_from or not raw_to:
            continue

        def _resolve(raw: str) -> str:
            return (
                raw_to_canonical.get(raw)
                or raw_to_canonical.get(raw.lower())
                or raw_to_canonical.get(entity_registry.to_canonical(raw))
                or entity_registry.to_canonical(raw)
            )

        can_from = _resolve(raw_from)
        can_to   = _resolve(raw_to)

        if can_from and can_to:
            remapped.append({**rel, "from": can_from, "to": can_to})
        else:
            log.debug(
                "Gold: dropping relationship (%r→%r) — empty canonical endpoint",
                raw_from, raw_to,
            )
    return remapped


async def _detect_conflict(existing_summary: str, incoming_summary: str) -> tuple[dict, str]:
    """Returns (conflict_result_dict, raw_llm_answer)."""
    user = (
        f"Existing chunk summary:\n{existing_summary}\n\n"
        f"Incoming chunk summary:\n{incoming_summary}"
    )
    try:
        result, raw, _ = await _llm_generate_json(_CONFLICT_SYSTEM, user, max_tokens=128)
        return result, raw
    except Exception as exc:
        log.warning("Gold: conflict detection failed (%s) — treating as no conflict", exc)
        return {"has_conflict": False}, f"ERROR: {exc}"


# ── Neo4j helpers ─────────────────────────────────────────────────────────────

async def _neo4j_commit_chunk(
    neo4j: AsyncDriver,
    tenant_id: str,
    data_id: str,
    block_id: str,
    entity_data: list[tuple[str, str, list[float]]],
    relationships: list[dict],
) -> None:
    async with neo4j.session() as session:
        for name, description, vector in entity_data:
            result = await session.run(
                "MERGE (n:Entity {name: $name, tenant_id: $tid}) "
                "SET n.description = $desc, n.vector = $vec",
                name=name, tid=tenant_id, desc=description, vec=vector,
            )
            await result.consume()
        for rel in relationships:
            from_e   = str(rel.get("from", "")).strip()
            to_e     = str(rel.get("to", "")).strip()
            rel_type = str(rel.get("type", "RELATES")).strip()
            if not from_e or not to_e:
                continue
            result = await session.run(
                "MATCH (a:Entity {name: $from_e, tenant_id: $tid}) "
                "MATCH (b:Entity {name: $to_e,   tenant_id: $tid}) "
                "CREATE (a)-[r:RELATES {rel_type: $rtype, tenant_id: $tid, "
                "                       block_id: $bid,   data_id: $did}]->(b)",
                from_e=from_e, to_e=to_e, rtype=rel_type,
                tid=tenant_id, bid=block_id, did=data_id,
            )
            await result.consume()


async def _neo4j_rollback_chunk(neo4j: AsyncDriver, tenant_id: str, block_id: str) -> None:
    try:
        async with neo4j.session() as session:
            result = await session.run(
                "MATCH ()-[r:RELATES {block_id: $bid, tenant_id: $tid}]-() DELETE r",
                bid=block_id, tid=tenant_id,
            )
            await result.consume()
        log.debug("Gold: Neo4j relationships rolled back for block_id=%s", block_id)
    except Exception as exc:
        log.error("Gold: Neo4j rollback failed for block_id=%s: %s", block_id, exc)


# ── Atomic per-chunk commit ───────────────────────────────────────────────────

async def _commit_chunk_atomic(
    postgres: PostgresClient,
    qdrant: AsyncQdrantClient,
    neo4j: AsyncDriver,
    tenant_id: str,
    data_id: str,
    block_index: int,
    content: str,
    table_involved: bool,
    table: dict | None,
    payload_meta: dict,
    embedding: list[float],
    entity_data: list[tuple[str, str, list[float]]],
    relationships: list[dict],
    intents: list[str],
    summary: str,
    approved_by: str,
    emitter: PipelineEventEmitter | None = None,
) -> str:
    block_id: str | None = None
    qdrant_upserted = False
    neo4j_written   = False

    try:
        async with postgres.get_client() as session:
            try:
                t_pg = _time.monotonic()
                block_orm = KBTextBlockORM(
                    owner_id=uuid.UUID(data_id),
                    block_index=block_index,
                )
                session.add(block_orm)
                await session.flush()

                version_orm = KBTextBlockVersionORM(
                    block_id=block_orm.block_id,
                    version_number=1,
                    content=content,
                    created_by=approved_by,
                    table_involved=table_involved,
                    payload=payload_meta,
                    is_active=True,
                )
                session.add(version_orm)

                if table_involved and table:
                    table_orm = KBTextTableORM(
                        version_id=version_orm.version_id,
                        table_name=table.get("table_name", f"table_{block_index}"),
                        description=table.get("description"),
                        data=table.get("data"),
                    )
                    session.add(table_orm)

                await session.flush()
                block_id = str(block_orm.block_id)
                pg_ms = round((_time.monotonic() - t_pg) * 1000)

                entity_names = [e[0] for e in entity_data]
                t_qd = _time.monotonic()
                await qdrant.upsert(
                    collection_name=cfg.QDRANT_COLLECTION,
                    points=[
                        qmodels.PointStruct(
                            id=block_id,
                            vector=embedding,
                            payload={
                                "tenant_id":  tenant_id,
                                "data_id":    data_id,
                                "block_id":   block_id,
                                "summary":    summary,
                                "entities":   entity_names,
                                "intents":    intents,
                                "is_deleted": False,
                            },
                        )
                    ],
                )
                qdrant_upserted = True
                qd_ms = round((_time.monotonic() - t_qd) * 1000)

                t_n4 = _time.monotonic()
                await _neo4j_commit_chunk(
                    neo4j, tenant_id, data_id, block_id, entity_data, relationships,
                )
                neo4j_written = True
                n4_ms = round((_time.monotonic() - t_n4) * 1000)

                await session.commit()
                log.info("Gold: atomic commit OK block_index=%d block_id=%s", block_index, block_id)

                if emitter:
                    await emitter.emit("gold.store.timing", {
                        "index":       block_index,
                        "postgres_ms": pg_ms,
                        "qdrant_ms":   qd_ms,
                        "neo4j_ms":    n4_ms,
                    })

                return block_id

            except Exception as exc:
                await session.rollback()

                if qdrant_upserted and block_id:
                    try:
                        await qdrant.delete(
                            collection_name=cfg.QDRANT_COLLECTION,
                            points_selector=qmodels.PointIdsList(points=[block_id]),
                        )
                    except Exception as ce:
                        log.error("Gold: Qdrant rollback FAILED block_id=%s: %s", block_id, ce)

                if neo4j_written and block_id:
                    await _neo4j_rollback_chunk(neo4j, tenant_id, block_id)

                raise RuntimeError(
                    f"Atomic commit failed block_index={block_index}: {exc}"
                ) from exc

    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(
            f"Unexpected error during atomic commit block_index={block_index}: {exc}"
        ) from exc


# ── Main stage function ────────────────────────────────────────────────────────

async def promote_to_gold(
    postgres: PostgresClient,
    qdrant: AsyncQdrantClient,
    neo4j: AsyncDriver,
    mongo: MongoClient,
    model: ModelServiceClient,
    data_id: str,
    tenant_id: str,
    approved_by: str,
    emitter: PipelineEventEmitter | None = None,
) -> dict:
    """
    Load silver staging chunks → per-chunk extract → canonicalize → atomic commit.
    Updates KBData tier to GOLD after all chunks processed.
    Returns: {data_id, committed, conflicted, failed, layer}
    """
    mongo_db = mongo.get_client()
    staging = await mongo_db["kb_silver_staging"].find_one({"data_id": data_id})
    if not staging:
        raise ValueError(f"No silver staging found for data_id={data_id}")

    chunks: list[dict] = staging.get("chunks", [])
    log.info("Gold: processing %d chunks data_id=%s", len(chunks), data_id)

    if emitter:
        await emitter.emit("gold.start", {
            "total_chunks": len(chunks),
        })

    committed_count  = 0
    conflicted_count = 0
    failed_count     = 0
    conflict_batch_id: str | None = None

    for chunk in chunks:
        block_index: int  = chunk["block_index"]
        content: str      = chunk["content"]
        table_involved    = chunk.get("table_involved", False)
        table: dict | None = chunk.get("table")

        if emitter:
            await emitter.emit("gold.chunk.start", {
                "index":   block_index,
                "content": content,
                "length":  len(content),
            })

        try:
            # ── Step A: Extract ───────────────────────────────────────────────
            extraction = await _extract_chunk(content, emitter, block_index)
            if extraction is None:
                failed_count += 1
                log.warning("Gold: skipping block_index=%d — extraction validation failed", block_index)
                if emitter:
                    await emitter.emit("gold.chunk.skipped", {
                        "index":  block_index,
                        "reason": "extraction_failed",
                    })
                continue

            summary                          = extraction["summary"]
            raw_entities_with_desc: list[dict[str, str]] = extraction["entities"]
            relationships                    = extraction["relationships"]
            raw_intents                      = extraction["intents"]
            raw_names                        = [e["name"] for e in raw_entities_with_desc]

            # ── Step B: Canonicalize ──────────────────────────────────────────
            entities, canon_details = await entity_registry.normalize_entities_detailed(
                qdrant, model, tenant_id, raw_entities_with_desc,
            )
            if not entities:
                entities = [entity_registry.to_canonical(n) for n in raw_names if n.strip()]
                if not entities:
                    entities = ["document_chunk"]
                canon_details = [
                    {"raw": n, "canonical": entity_registry.to_canonical(n), "action": "new", "similarity": None}
                    for n in raw_names
                ]

            if emitter:
                await emitter.emit("gold.canonicalize", {
                    "index":    block_index,
                    "mappings": canon_details,
                })

            # Build raw→canonical map for relationship remapping.
            raw_to_canonical: dict[str, str] = {}
            for raw_e, can_e in zip(raw_names, entities):
                raw_to_canonical[raw_e]                               = can_e
                raw_to_canonical[raw_e.lower()]                       = can_e
                raw_to_canonical[entity_registry.to_canonical(raw_e)] = can_e

            relationships = _remap_relationship_entities(relationships, raw_to_canonical)

            canonical_set = set(entities)
            relationships = [
                r for r in relationships
                if r.get("from") in canonical_set and r.get("to") in canonical_set
            ]

            if not relationships:
                log.info(
                    "Gold: block_index=%d has no valid relationships after canonicalization — "
                    "committing with empty edge list",
                    block_index,
                )

            intents = raw_intents

            # ── Step C: Embed ─────────────────────────────────────────────────
            raw_desc_by_canonical: dict[str, str] = {}
            for raw_ent in raw_entities_with_desc:
                approx = entity_registry.to_canonical(raw_ent["name"])
                if approx not in raw_desc_by_canonical:
                    raw_desc_by_canonical[approx] = raw_ent["description"]

            desc_texts = [
                raw_desc_by_canonical.get(can) or can.replace("_", " ")
                for can in entities
            ]
            t_emb = _time.monotonic()
            summary_and_descs = await model.embed([summary] + desc_texts)
            emb_ms = round((_time.monotonic() - t_emb) * 1000)
            embedding      = summary_and_descs[0]
            entity_vectors = summary_and_descs[1:]

            entity_data: list[tuple[str, str, list[float]]] = [
                (can, raw_desc_by_canonical.get(can, ""), vec)
                for can, vec in zip(entities, entity_vectors)
            ]

            if emitter:
                await emitter.emit("gold.embed.complete", {
                    "index":        block_index,
                    "dim":          len(embedding),
                    "entity_count": len(entity_data),
                    "duration_ms":  emb_ms,
                })

            # ── Step D: Conflict detection ────────────────────────────────────
            search_res = await qdrant_vector_search(qdrant, SearchRequest(
                tenant_id=tenant_id,
                collection_name=cfg.QDRANT_COLLECTION,
                query_vector=embedding,
                limit=5,
            ))

            candidates = len(search_res.data) if search_res.code == 200 and search_res.data else 0
            if emitter:
                await emitter.emit("gold.conflict.check", {
                    "index":      block_index,
                    "candidates": candidates,
                    "threshold":  cfg.CONFLICT_SIMILARITY_THRESHOLD,
                })

            conflict_found = False
            if search_res.code == 200 and search_res.data:
                for hit in search_res.data:
                    if hit.score < cfg.CONFLICT_SIMILARITY_THRESHOLD:
                        continue
                    existing_summary = (hit.payload or {}).get("summary", "")
                    conflict_result, conflict_raw = await _detect_conflict(existing_summary, summary)
                    if conflict_result.get("has_conflict"):
                        if conflict_batch_id is None:
                            batch_res = await postgres.insert(KBConflictBatchInsert(
                                tenant_id=tenant_id,
                                batch_title=f"Conflict batch for data {data_id}",
                                status=ConflictStatus.PENDING,
                            ))
                            if batch_res.code == 200:
                                conflict_batch_id = batch_res.data["batch_id"]

                        raw_type     = conflict_result.get("conflict_type", ConflictType.CONTENT_CONFLICT.value)
                        raw_severity = conflict_result.get("severity", ConflictSeverity.MEDIUM.value)
                        try:
                            conflict_type_enum = ConflictType(raw_type)
                        except ValueError:
                            conflict_type_enum = ConflictType.CONTENT_CONFLICT
                        try:
                            severity_enum = ConflictSeverity(raw_severity)
                        except ValueError:
                            severity_enum = ConflictSeverity.MEDIUM

                        is_duplicate = conflict_type_enum == ConflictType.CONTENT_DUPLICATE
                        await postgres.insert(KBConflictInsert(
                            tenant_id=tenant_id,
                            conflict_type=conflict_type_enum,
                            severity=severity_enum,
                            batch_id=conflict_batch_id,
                            status=ConflictStatus.RESOLVED if is_duplicate else ConflictStatus.PENDING,
                            detailed_explanation=conflict_result.get("explanation", ""),
                            existing_snapshot={
                                "block_id": str(hit.id),
                                "summary":  existing_summary,
                                "entities": (hit.payload or {}).get("entities", []),
                            },
                            incoming_snapshot={
                                "block_index":    block_index,
                                "data_id":        data_id,
                                "tenant_id":      tenant_id,
                                "approved_by":    approved_by,
                                "content":        content,
                                "summary":        summary,
                                "embedding":      embedding,
                                "entity_data":    [{"name": n, "description": d} for n, d, _ in entity_data],
                                "relationships":  relationships,
                                "intents":        intents,
                                "table_involved": table_involved,
                                "table":          table,
                            },
                        ))
                        conflict_found = True
                        conflicted_count += 1

                        if emitter:
                            await emitter.emit("gold.conflict.found", {
                                "index":            block_index,
                                "conflict_type":    raw_type,
                                "severity":         raw_severity,
                                "explanation":      conflict_result.get("explanation", ""),
                                "existing_summary": existing_summary,
                                "similarity":       round(hit.score, 4),
                                "raw_answer":       conflict_raw[:2000],
                            })

                        log.info(
                            "Gold: conflict detected block_index=%d type=%s severity=%s",
                            block_index, raw_type, raw_severity,
                        )
                        break

            if conflict_found:
                continue

            # ── Step E: Atomic commit ─────────────────────────────────────────
            entity_names = [e[0] for e in entity_data]
            payload_meta = {
                "summary":       summary,
                "entities":      entity_names,
                "relationships": relationships,
                "intents":       intents,
            }

            block_id = await _commit_chunk_atomic(
                postgres=postgres,
                qdrant=qdrant,
                neo4j=neo4j,
                tenant_id=tenant_id,
                data_id=data_id,
                block_index=block_index,
                content=content,
                table_involved=table_involved,
                table=table,
                payload_meta=payload_meta,
                embedding=embedding,
                entity_data=entity_data,
                relationships=relationships,
                intents=intents,
                summary=summary,
                approved_by=approved_by,
                emitter=emitter,
            )
            committed_count += 1

            if emitter:
                await emitter.emit("gold.commit.ok", {
                    "index":    block_index,
                    "block_id": block_id,
                    "entities": entity_names,
                    "neo4j_nodes":   len(entity_data),
                    "neo4j_edges":   len(relationships),
                })

        except Exception as exc:
            failed_count += 1
            log.error("Gold: chunk failed block_index=%d data_id=%s: %s", block_index, data_id, exc)
            if emitter:
                await emitter.emit("gold.chunk.failed", {
                    "index": block_index,
                    "error": str(exc)[:300],
                })

    # ── Update document tier ──────────────────────────────────────────────────
    async with postgres.get_client() as session:
        await session.execute(
            sa_update(KBDataORM)
            .where(KBDataORM.data_id == uuid.UUID(data_id))
            .values(current_tier=Tier.GOLD.value)
        )
        await session.commit()

    await postgres.insert(KBLifecycleHistoryInsert(
        data_id=data_id,
        to_tier=Tier.GOLD,
        from_tier=Tier.SILVER,
        approved_by=approved_by,
        notes=(
            f"Promoted to gold: {committed_count} committed, "
            f"{conflicted_count} conflicts, {failed_count} failed"
        ),
    ))

    log.info(
        "Gold complete data_id=%s committed=%d conflicted=%d failed=%d",
        data_id, committed_count, conflicted_count, failed_count,
    )

    if emitter:
        await emitter.emit("gold.complete", {
            "committed":  committed_count,
            "conflicted": conflicted_count,
            "failed":     failed_count,
        })
        await emitter.emit("pipeline.done", {})

    return {
        "data_id":    data_id,
        "committed":  committed_count,
        "conflicted": conflicted_count,
        "failed":     failed_count,
        "layer":      Tier.GOLD.value,
    }
