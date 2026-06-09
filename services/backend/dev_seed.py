"""
Dev/test seed data — inserts fixed-UUID rows for Tenants and RolePermissions
so the ingestion pipeline can store FK references without external auth services.

These UUIDs are stable and deterministic; any environment that runs this seed
will have the same IDs, making cross-service dev configs predictable.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

log = logging.getLogger(__name__)

DEV_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

# One RolePermissions row per role name; resource=kb_data / action=write.
# KBData.role_id stores the UUID of the permission that authorized the upload.
DEV_ROLE_PERMISSION_IDS: dict[str, uuid.UUID] = {
    "PLATFORM_ADMIN":      uuid.UUID("00000000-0000-0000-0000-000000000010"),
    "AI_ENGINEER":         uuid.UUID("00000000-0000-0000-0000-000000000011"),
    "BUSINESS_OPERATOR":   uuid.UUID("00000000-0000-0000-0000-000000000012"),
    "EXECUTIVE":           uuid.UUID("00000000-0000-0000-0000-000000000013"),
}


async def seed_dev_data(engine: AsyncEngine) -> None:
    """Idempotent: inserts rows only if they don't already exist."""
    async with engine.begin() as conn:
        # Seed Tenants
        await conn.execute(text("""
            INSERT INTO "Tenants" (id, name, slug, data_residency, is_active)
            VALUES (:id, :name, :slug, :dr, true)
            ON CONFLICT (id) DO NOTHING
        """), {"id": DEV_TENANT_ID, "name": "Dev Tenant", "slug": "dev", "dr": "Asia-SE1"})

        # Seed RolePermissions — one KB write entry per role
        for role_name, perm_id in DEV_ROLE_PERMISSION_IDS.items():
            await conn.execute(text("""
                INSERT INTO "RolePermissions" (id, role_id, resource, action)
                VALUES (:id, :role_id, :resource, :action)
                ON CONFLICT (id) DO NOTHING
            """), {
                "id":       perm_id,
                "role_id":  role_name,
                "resource": "kb_data",
                "action":   "write",
            })

    log.info("dev_seed: Tenants and RolePermissions seeded OK")
