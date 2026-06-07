"""
Postgres connector tests.

Requires the test Postgres server to be running:
    docker compose -f docker/docker-compose.test.yml up -d

Run:
    pytest testing/postgres_connector/test_connector.py -v
"""

import pytest
import pytest_asyncio
from basemodel.services_databaseconnector.postgres_model import (
    KBDataInsert, KBDataDelete,
    KBFilterPolicyInsert, KBFilterPolicyDelete,
    KBTextBlockVersionInsert, KBTextBlockVersionDelete,
    KBConflictDelete,
    ReadJoinRequest, SelectInLoadRequest, WhereFilter, SelectedColumn,
)
from services.database_connector.postgres_connector import PostgresClient

TENANT_ID = "11111111-1111-1111-1111-111111111111"
ROLE_ID   = "33333333-3333-3333-3333-333333333333"


# ══════════════════════════════════════════════════════════════════
# insert
# ══════════════════════════════════════════════════════════════════

class TestInsert:

    @pytest.mark.asyncio
    async def test_insert_with_tenant(self, client, seeded):
        result = await client.insert(KBDataInsert(
            tenant_id=TENANT_ID,
            role_id=ROLE_ID,
            name="test_insert_doc.pdf",
            extension="pdf",
            language="english",
            source_type="doc",
            added_by="test.user",
            abstract="Test insert document.",
            doc_metadata={"source_type": "doc", "doc_type": "PDF"},
            current_tier="bronze",
        ))
        assert result.code == 200
        assert "data_id" in result.data

    @pytest.mark.asyncio
    async def test_insert_without_tenant(self, client, seeded):
        result = await client.insert(KBTextBlockVersionInsert(
            block_id=seeded["block_ids"][0],
            version_number=99,
            content="Test version content.",
            is_active=False,
        ))
        assert result.code == 200
        assert "version_id" in result.data

    @pytest.mark.asyncio
    async def test_insert_duplicate_raises_409(self, client, seeded):
        # name has a unique constraint on KBData
        payload = KBDataInsert(
            tenant_id=TENANT_ID,
            role_id=ROLE_ID,
            name="annual_report_2024.pdf",  # already seeded
            extension="pdf",
            language="english",
            source_type="doc",
            added_by="test.user",
            abstract="Duplicate.",
            doc_metadata={"source_type": "doc", "doc_type": "PDF"},
        )
        result = await client.insert(payload)
        assert result.code == 409


# ══════════════════════════════════════════════════════════════════
# read
# ══════════════════════════════════════════════════════════════════

class TestRead:

    @pytest.mark.asyncio
    async def test_read_single_table(self, client, seeded):
        result = await client.read(ReadJoinRequest(
            tenant_id=TENANT_ID,
            joins_table=["KBData"],
            filters=[WhereFilter(table_name="KBData", column_name="current_tier", value="bronze")],
            limit=10,
        ))
        assert result.code == 200
        assert isinstance(result.data, list)
        assert all(r["current_tier"] == "bronze" for r in result.data)

    @pytest.mark.asyncio
    async def test_read_returns_all_columns_when_none_selected(self, client, seeded):
        result = await client.read(ReadJoinRequest(
            tenant_id=TENANT_ID,
            joins_table=["KBData"],
            selected_columns=[],
            limit=5,
        ))
        assert result.code == 200
        assert len(result.data) > 0
        assert "data_id" in result.data[0]
        assert "name" in result.data[0]
        assert "inserted_at" in result.data[0]

    @pytest.mark.asyncio
    async def test_read_cursor_pagination(self, client, seeded):
        page1 = await client.read(ReadJoinRequest(
            tenant_id=TENANT_ID,
            joins_table=["KBData"],
            limit=2,
        ))
        assert page1.code == 200
        assert len(page1.data) == 2

        cursor = page1.data[-1]["inserted_at"]
        page2 = await client.read(ReadJoinRequest(
            tenant_id=TENANT_ID,
            joins_table=["KBData"],
            limit=2,
            cursor=cursor,
        ))
        assert page2.code == 200
        # all page2 rows must be after the cursor
        assert all(r["inserted_at"] > cursor for r in page2.data)

    @pytest.mark.asyncio
    async def test_read_multi_table_join(self, client, seeded):
        result = await client.read(ReadJoinRequest(
            tenant_id=TENANT_ID,
            joins_table=["KBData", "KBTextBlock"],
            selected_columns=[
                SelectedColumn(table_name="KBData",      column_name="data_id",    alias="data_id"),
                SelectedColumn(table_name="KBData",      column_name="name",       alias="name"),
                SelectedColumn(table_name="KBTextBlock", column_name="block_id",   alias="block_id"),
                SelectedColumn(table_name="KBTextBlock", column_name="block_index",alias="block_index"),
            ],
            limit=20,
        ))
        assert result.code == 200
        assert len(result.data) > 0
        assert "data_id" in result.data[0]
        assert "block_id" in result.data[0]

    @pytest.mark.asyncio
    async def test_read_unknown_table_returns_400(self, client, seeded):
        result = await client.read(ReadJoinRequest(
            joins_table=["NonExistentTable"],
            limit=5,
        ))
        assert result.code == 400

    @pytest.mark.asyncio
    async def test_read_specific_columns(self, client, seeded):
        result = await client.read(ReadJoinRequest(
            tenant_id=TENANT_ID,
            joins_table=["KBFilterPolicy"],
            selected_columns=[
                SelectedColumn(table_name="KBFilterPolicy", column_name="policy_id"),
                SelectedColumn(table_name="KBFilterPolicy", column_name="policy_name"),
                SelectedColumn(table_name="KBFilterPolicy", column_name="is_active"),
            ],
            limit=10,
        ))
        assert result.code == 200
        assert all("policy_id" in r and "policy_name" in r for r in result.data)
        # unselected columns should not be present
        assert all("configformat" not in r for r in result.data)


# ══════════════════════════════════════════════════════════════════
# read_deep
# ══════════════════════════════════════════════════════════════════

class TestReadDeep:

    @pytest.mark.asyncio
    async def test_read_deep_nested_chain(self, client, seeded):
        result = await client.read_deep(SelectInLoadRequest(
            tenant_id=TENANT_ID,
            table="KBData",
            load_paths=["KBTextBlock.KBTextBlockVersion"],
            filters=[WhereFilter(table_name="KBData", column_name="current_tier", value="gold")],
            limit=5,
        ))
        assert result.code == 200
        assert len(result.data) > 0

        row = result.data[0]
        assert "KBTextBlock" in row
        assert isinstance(row["KBTextBlock"], list)
        assert len(row["KBTextBlock"]) > 0
        assert "KBTextBlockVersion" in row["KBTextBlock"][0]

    @pytest.mark.asyncio
    async def test_read_deep_multiple_paths(self, client, seeded):
        result = await client.read_deep(SelectInLoadRequest(
            tenant_id=TENANT_ID,
            table="KBData",
            load_paths=["KBTextBlock", "KBLifecycleHistory"],
            limit=5,
        ))
        assert result.code == 200
        row = result.data[0]
        assert "KBTextBlock" in row
        assert "KBLifecycleHistory" in row

    @pytest.mark.asyncio
    async def test_read_deep_invalid_table_returns_400(self, client, seeded):
        result = await client.read_deep(SelectInLoadRequest(
            table="GhostTable",
            load_paths=["KBTextBlock"],
            limit=5,
        ))
        assert result.code == 400

    @pytest.mark.asyncio
    async def test_read_deep_invalid_path_returns_400(self, client, seeded):
        result = await client.read_deep(SelectInLoadRequest(
            tenant_id=TENANT_ID,
            table="KBData",
            load_paths=["KBConflict"],  # no relationship from KBData → KBConflict
            limit=5,
        ))
        assert result.code == 400

    @pytest.mark.asyncio
    async def test_read_deep_cursor_pagination(self, client, seeded):
        page1 = await client.read_deep(SelectInLoadRequest(
            tenant_id=TENANT_ID,
            table="KBData",
            load_paths=["KBTextBlock"],
            limit=1,
        ))
        assert page1.code == 200
        assert len(page1.data) == 1

        cursor = page1.data[0]["inserted_at"]
        page2 = await client.read_deep(SelectInLoadRequest(
            tenant_id=TENANT_ID,
            table="KBData",
            load_paths=["KBTextBlock"],
            limit=5,
            cursor=cursor,
        ))
        assert page2.code == 200
        assert all(r["inserted_at"] > cursor for r in page2.data)


# ══════════════════════════════════════════════════════════════════
# soft_delete
# ══════════════════════════════════════════════════════════════════

class TestSoftDelete:

    @pytest.mark.asyncio
    async def test_soft_delete_sets_is_deleted(self, client, seeded):
        policy_id = seeded["policy_ids"][1]  # inactive policy — safe to soft-delete
        result = await client.soft_delete(KBFilterPolicyDelete(
            tenant_id=TENANT_ID,
            policy_id=policy_id,
        ))
        assert result.code == 200

        # read filters is_deleted=False by default — soft-deleted row should not appear
        check = await client.read(ReadJoinRequest(
            tenant_id=TENANT_ID,
            joins_table=["KBFilterPolicy"],
            filters=[WhereFilter(table_name="KBFilterPolicy", column_name="policy_id", value=policy_id)],
        ))
        assert check.data == []

    @pytest.mark.asyncio
    async def test_soft_delete_already_deleted_returns_404(self, client, seeded):
        policy_id = seeded["policy_ids"][1]
        result = await client.soft_delete(KBFilterPolicyDelete(
            tenant_id=TENANT_ID,
            policy_id=policy_id,
        ))
        assert result.code == 404


# ══════════════════════════════════════════════════════════════════
# delete
# ══════════════════════════════════════════════════════════════════

class TestDelete:

    @pytest.mark.asyncio
    async def test_hard_delete_by_pk(self, client, seeded):
        conflict_id = seeded["conflict_ids"][1]
        result = await client.delete(KBConflictDelete(
            tenant_id=TENANT_ID,
            conflict_id=conflict_id,
        ))
        assert result.code == 200

    @pytest.mark.asyncio
    async def test_hard_delete_kb_data_requires_data_id(self, client, seeded):
        # insert a throwaway record then hard-delete it by data_id
        ins = await client.insert(KBDataInsert(
            tenant_id=TENANT_ID,
            role_id=ROLE_ID,
            name="throwaway_delete_test.pdf",
            extension="pdf",
            language="english",
            source_type="doc",
            added_by="test.user",
            abstract="Record created only to be deleted.",
            doc_metadata={"source_type": "doc", "doc_type": "PDF"},
        ))
        assert ins.code == 200
        data_id = ins.data["data_id"]

        result = await client.delete(KBDataDelete(
            tenant_id=TENANT_ID,
            data_id=data_id,          # required — must always be provided
        ))
        assert result.code == 200

    @pytest.mark.asyncio
    async def test_delete_unregistered_model_returns_400(self, client, seeded):
        from pydantic import BaseModel as PydanticBase

        class UnregisteredModel(PydanticBase):
            some_id: str = "test"

        result = await client.delete(UnregisteredModel())
        assert result.code == 400


# ══════════════════════════════════════════════════════════════════
# flush
# ══════════════════════════════════════════════════════════════════

class TestFlush:

    @pytest.mark.asyncio
    async def test_flush_removes_soft_deleted_rows(self, client, seeded):
        result = await client.flush("KBFilterPolicy")
        assert result.code == 200

    @pytest.mark.asyncio
    async def test_flush_unknown_table_returns_400(self, client, seeded):
        result = await client.flush("GhostTable")
        assert result.code == 400
