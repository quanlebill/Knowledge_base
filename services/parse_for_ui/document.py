import json
from .common import to_string


def map_doc(row: dict) -> dict:
    meta = row.get("metadata") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except Exception:
            meta = {}

    st = row.get("source_type", "doc")
    ext = (row.get("extension") or "").upper()
    doc_type = (
        f"Doc/{ext}" if st == "doc" and ext else
        "Web" if st == "web" else
        f"Image/{ext}" if ext else "Image" if st == "image" else
        f"Video/{ext}" if ext else "Video" if st == "video" else
        f"Warehouse/{meta.get('warehouseType', '')}" if st == "warehouse" else
        st
    )
    tier = (row.get("current_tier") or "bronze").lower()
    return {
        "id": to_string(row["data_id"]),
        "name": row.get("name", ""),
        "layer": tier.upper(),
        "status": {"gold": "PUBLISHED", "silver": "EMBEDDING"}.get(tier, "RAW"),
        "version": "v1.0",
        "author": meta.get("author") or to_string(row.get("added_by")),
        "lastUpdated": to_string(row.get("added_on", "")),
        "metadata": {
            "type": doc_type,
            "language": row.get("language"),
            "accessRole": meta.get("access_role") or meta.get("accessRole"),
            "url": meta.get("url"),
            "author": meta.get("author"),
            "publishedDate": meta.get("published_date") or meta.get("publishedDate"),
            "warehouseType": meta.get("warehouseType") or meta.get("warehouse_type"),
            "width": meta.get("width"),
            "height": meta.get("height"),
            "colorSpace": meta.get("color_space") or meta.get("colorSpace"),
            "fileSize": meta.get("file_size") or meta.get("fileSize"),
            "totalFrame": meta.get("total_frame") or meta.get("totalFrame"),
        },
    }
