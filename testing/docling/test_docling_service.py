"""
Docling service tests.

Unit tests run without Docling (pure Python, fast).
Integration tests parse the downloaded arXiv paper via Docling (slow, ~30-60s first run).

Run all:
    pytest testing/docling/test_docling_service.py -v

Run only unit tests (fast):
    pytest testing/docling/test_docling_service.py -v -m unit

Run only integration tests:
    pytest testing/docling/test_docling_service.py -v -m integration
"""

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from services.docling.docling_service import (
    DoclingClient,
    _table_description,
    _build_parsed_tables,
    _iter_chunks,
)
from basemodel.services_docling.docling_model import DoclingResult, ParsedChunk, ParsedTable

FIXTURES  = Path(__file__).parent / "fixtures"
PAPERS    = Path(__file__).parent / "papers"
ARXIV_PDF = PAPERS / "attention_is_all_you_need.pdf"


# ── Shared opened client fixture ──────────────────────────────────────────────

@pytest.fixture(scope="module")
def event_loop():
    import asyncio
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def opened_client(event_loop):
    c = DoclingClient()
    event_loop.run_until_complete(c.open())
    yield c
    event_loop.run_until_complete(c.close())


# ── Mock helpers ──────────────────────────────────────────────────────────────

def _make_table(name: str, headers: list, rows: list) -> ParsedTable:
    return ParsedTable(
        table_name=name,
        description=_table_description(name, headers, rows),
        data={"headers": headers, "rows": rows},
    )


def _mock_table_item(headers: list, rows: list, caption: str = "") -> MagicMock:
    cell = lambda t: MagicMock(text=t)
    item = MagicMock()
    item.data.grid = [[cell(h) for h in headers]] + [[cell(v) for v in row] for row in rows]
    item.caption_text = MagicMock(return_value=caption)
    return item


def _mock_doc(table_items: list) -> MagicMock:
    doc = MagicMock()
    doc.tables = table_items
    return doc


# ══════════════════════════════════════════════════════════════════════════════
# Unit tests — no Docling, pure Python
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestTableDescription:

    def test_contains_table_name(self):
        assert "Results" in _table_description("Results", ["A", "B"], [["1", "2"]])

    def test_contains_column_names(self):
        desc = _table_description("T", ["Col1", "Col2"], [])
        assert "Col1" in desc and "Col2" in desc

    def test_contains_row_count(self):
        assert "3" in _table_description("T", ["A"], [["x"], ["y"], ["z"]])

    def test_first_row_sample_included(self):
        desc = _table_description("T", ["Key", "Val"], [["foo", "bar"]])
        assert "foo" in desc or "bar" in desc

    def test_no_rows_no_sample(self):
        assert "First row" not in _table_description("T", ["A", "B"], [])

    def test_empty_cells_skipped_in_sample(self):
        desc = _table_description("T", ["A", "B"], [["", "val"]])
        assert "A=" not in desc and "val" in desc


@pytest.mark.unit
class TestSplitTableMerge:

    def test_no_merge_when_different_headers(self):
        doc = _mock_doc([
            _mock_table_item(["A", "B"], [["1", "2"]], "Table 1"),
            _mock_table_item(["X", "Y"], [["a", "b"]], "Table 2"),
        ])
        result = _build_parsed_tables(doc)
        assert len(result) == 2
        assert all(r is not None for r in result)

    def test_merge_when_same_headers(self):
        doc = _mock_doc([
            _mock_table_item(["A", "B"], [["1", "2"]], "Table 1"),
            _mock_table_item(["A", "B"], [["3", "4"]], "Table 1 cont."),
        ])
        result = _build_parsed_tables(doc)
        assert result[1] is None
        assert len(result[0].data["rows"]) == 2

    def test_merged_description_reflects_total_rows(self):
        doc = _mock_doc([
            _mock_table_item(["A", "B"], [["1", "2"], ["3", "4"]], "T"),
            _mock_table_item(["A", "B"], [["5", "6"]], "T cont."),
        ])
        result = _build_parsed_tables(doc)
        assert "3 row" in result[0].description

    def test_three_part_table_all_merged(self):
        doc = _mock_doc([
            _mock_table_item(["A"], [["1"]], "T"),
            _mock_table_item(["A"], [["2"]], "T cont."),
            _mock_table_item(["A"], [["3"]], "T cont."),
        ])
        result = _build_parsed_tables(doc)
        assert result[0] is not None
        assert result[1] is None
        assert result[2] is None
        assert len(result[0].data["rows"]) == 3


@pytest.mark.unit
class TestIterChunks:

    def _make_text_item(self, text: str):
        from docling_core.types.doc import TextItem
        item = MagicMock(spec=TextItem)
        item.text = text
        return item

    def _make_header_item(self, text: str):
        from docling_core.types.doc import SectionHeaderItem
        item = MagicMock(spec=SectionHeaderItem)
        item.text = text
        return item

    def _make_table_doc_item(self):
        from docling_core.types.doc import TableItem
        return MagicMock(spec=TableItem)

    def _make_doc(self, items: list):
        doc = MagicMock()
        doc.iterate_items = MagicMock(return_value=[(item, 1) for item in items])
        return doc

    def test_text_items_produce_chunks(self):
        doc = self._make_doc([self._make_text_item("Hello world.")])
        chunks = list(_iter_chunks(doc, [], 1500))
        assert len(chunks) == 1
        assert chunks[0].content == "Hello world."

    def test_section_header_flushes_and_starts_new_chunk(self):
        doc = self._make_doc([
            self._make_text_item("Intro text."),
            self._make_header_item("Section 2"),
            self._make_text_item("Section 2 text."),
        ])
        chunks = list(_iter_chunks(doc, [], 1500))
        assert len(chunks) == 2
        assert "Intro text." in chunks[0].content
        assert "Section 2" in chunks[1].content

    def test_table_item_gets_own_chunk(self):
        pt = _make_table(name="T", headers=["A"], rows=[["1"]])
        doc = self._make_doc([
            self._make_text_item("Before table."),
            self._make_table_doc_item(),
            self._make_text_item("After table."),
        ])
        chunks = list(_iter_chunks(doc, [pt], 1500))
        table_chunks = [c for c in chunks if c.table_involved]
        assert len(table_chunks) == 1
        assert table_chunks[0].table == pt

    def test_block_indices_are_sequential(self):
        doc = self._make_doc([
            self._make_text_item("A"),
            self._make_header_item("B"),
            self._make_text_item("C"),
        ])
        chunks = list(_iter_chunks(doc, [], 1500))
        assert [c.block_index for c in chunks] == list(range(len(chunks)))

    def test_long_text_splits_on_max_chars(self):
        long_text = "word " * 400
        doc = self._make_doc([
            self._make_text_item(long_text[:800]),
            self._make_text_item(long_text[800:]),
        ])
        chunks = list(_iter_chunks(doc, [], 500))
        assert len(chunks) >= 2

    def test_merged_table_none_skipped(self):
        pt = _make_table("T", ["A"], [["1"], ["2"]])
        doc = self._make_doc([
            self._make_table_doc_item(),
            self._make_table_doc_item(),
        ])
        chunks = list(_iter_chunks(doc, [pt, None], 1500))
        table_chunks = [c for c in chunks if c.table_involved]
        assert len(table_chunks) == 1


@pytest.mark.unit
class TestDoclingClientProtocol:

    def test_initial_state_not_connected(self):
        c = DoclingClient()
        assert not c.is_connected() and not c.is_healthy()

    def test_default_use_vlm_false(self):
        assert DoclingClient()._use_vlm is False

    def test_custom_use_vlm_true(self):
        assert DoclingClient(use_vlm=True)._use_vlm is True

    def test_get_client_returns_self(self):
        c = DoclingClient()
        assert c.get_client() is c

    def test_set_url_is_no_op(self):
        c = DoclingClient()
        c.set_url("anything")
        assert not c.is_connected()

    @pytest.mark.asyncio
    async def test_parse_before_open_raises(self):
        with pytest.raises(RuntimeError, match="not open"):
            await DoclingClient().parse(FIXTURES / "no_tables.md")

    @pytest.mark.asyncio
    async def test_unsupported_extension_raises(self):
        with pytest.raises(ValueError, match="Unsupported"):
            await DoclingClient().parse("file.xyz")


@pytest.mark.unit
class TestDoclingClientWithFixtures:

    @pytest.mark.asyncio
    async def test_parse_markdown_no_tables(self, opened_client):
        result = await opened_client.parse(FIXTURES / "no_tables.md")
        assert isinstance(result, DoclingResult)
        assert len(result.chunks) >= 1
        assert all(not c.table_involved for c in result.chunks)

    @pytest.mark.asyncio
    async def test_parse_markdown_with_tables(self, opened_client):
        result = await opened_client.parse(FIXTURES / "sample_with_tables.md")
        assert len([c for c in result.chunks if c.table_involved]) == 2

    @pytest.mark.asyncio
    async def test_table_chunk_has_parsedtable(self, opened_client):
        result = await opened_client.parse(FIXTURES / "sample_with_tables.md")
        for chunk in result.chunks:
            if chunk.table_involved:
                assert isinstance(chunk.table, ParsedTable)
                assert chunk.table.table_name
                assert "headers" in chunk.table.data
                assert "rows" in chunk.table.data

    @pytest.mark.asyncio
    async def test_block_indices_are_sequential(self, opened_client):
        result = await opened_client.parse(FIXTURES / "sample_with_tables.md")
        indices = [c.block_index for c in result.chunks]
        assert indices == list(range(len(result.chunks)))

    @pytest.mark.asyncio
    async def test_no_marker_in_content(self, opened_client):
        result = await opened_client.parse(FIXTURES / "sample_with_tables.md")
        assert all("[TABLE_" not in c.content for c in result.chunks)

    @pytest.mark.asyncio
    async def test_table_data_headers_present(self, opened_client):
        result = await opened_client.parse(FIXTURES / "sample_with_tables.md")
        table_chunks = [c for c in result.chunks if c.table_involved]
        assert len(table_chunks[0].table.data["headers"]) > 0

    @pytest.mark.asyncio
    async def test_custom_max_chunk_chars(self, opened_client):
        small = await opened_client.parse(FIXTURES / "sample_with_tables.md", max_chunk_chars=200)
        large = await opened_client.parse(FIXTURES / "sample_with_tables.md", max_chunk_chars=5000)
        assert len(small.chunks) >= len(large.chunks)

    def test_is_connected_after_open(self, opened_client):
        assert opened_client.is_connected()

    def test_is_healthy_after_open(self, opened_client):
        assert opened_client.is_healthy()

    def test_get_client_returns_self(self, opened_client):
        assert opened_client.get_client() is opened_client

    def test_executor_is_running_after_open(self, opened_client):
        assert opened_client._executor is not None


# ══════════════════════════════════════════════════════════════════════════════
# Integration test — parses the real arXiv PDF via Docling
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.integration
class TestDoclingClientIntegration:

    @pytest.fixture(scope="class")
    def arxiv_result(self, opened_client, event_loop):
        assert ARXIV_PDF.exists(), f"Paper not found at {ARXIV_PDF}"
        return event_loop.run_until_complete(opened_client.parse(ARXIV_PDF))

    def test_produces_chunks(self, arxiv_result):
        assert len(arxiv_result.chunks) > 0

    def test_tables_extracted(self, arxiv_result):
        assert len([c for c in arxiv_result.chunks if c.table_involved]) >= 1

    def test_table_data_structure(self, arxiv_result):
        for chunk in arxiv_result.chunks:
            if chunk.table_involved:
                assert isinstance(chunk.table.data.get("headers"), list)
                assert isinstance(chunk.table.data.get("rows"), list)
                assert len(chunk.table.data["headers"]) > 0

    def test_no_marker_leaks_in_chunks(self, arxiv_result):
        assert all("[TABLE_" not in c.content for c in arxiv_result.chunks)

    def test_all_chunks_have_content(self, arxiv_result):
        for chunk in arxiv_result.chunks:
            assert chunk.content.strip(), f"Empty at block_index={chunk.block_index}"

    def test_has_figures_flag(self, arxiv_result):
        assert isinstance(arxiv_result.has_figures, bool)

    def test_known_attention_table_headers(self, arxiv_result):
        all_headers = [
            h for c in arxiv_result.chunks
            if c.table_involved and c.table
            for h in c.table.data["headers"]
        ]
        assert any("Layer" in h or "Type" in h for h in all_headers)

    def test_kb_insert_model_compatibility(self, arxiv_result):
        from basemodel.services_databaseconnector.postgres_model import (
            KBTextBlockInsert, KBTextBlockVersionInsert, KBTextTableInsert,
        )
        import uuid
        owner_id   = str(uuid.uuid4())
        block_id   = str(uuid.uuid4())
        version_id = str(uuid.uuid4())

        for chunk in arxiv_result.chunks[:5]:
            block = KBTextBlockInsert(owner_id=owner_id, block_index=chunk.block_index)
            assert block.owner_id == owner_id

            version = KBTextBlockVersionInsert(
                block_id=block_id, version_number=1,
                content=chunk.content, table_involved=chunk.table_involved, is_active=True,
            )
            assert version.content == chunk.content

            if chunk.table_involved and chunk.table:
                table = KBTextTableInsert(
                    version_id=version_id,
                    table_name=chunk.table.table_name,
                    description=chunk.table.description,
                    data=chunk.table.data,
                )
                assert table.table_name == chunk.table.table_name
