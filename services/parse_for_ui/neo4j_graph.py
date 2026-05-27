def build_neo4j_schema(node_rows: list, edge_rows: list) -> dict:
    """
    Build entity list + connections map for the query builder.
    edge_rows must have 'from_id' and 'to_id' as UUID strings (or objects with __str__).
    """
    id_to_name: dict[str, str] = {str(r["node_id"]): r.get("node_name", "") for r in node_rows}
    entities = [r.get("node_name", "") for r in node_rows if r.get("node_name")]

    connections: dict[str, list[str]] = {}
    for e in edge_rows:
        from_name = id_to_name.get(str(e.get("from_id", "")), "")
        to_name   = id_to_name.get(str(e.get("to_id",   "")), "")
        if not from_name or not to_name:
            continue
        targets = connections.setdefault(from_name, [])
        if to_name not in targets:
            targets.append(to_name)

    return {"entities": entities, "connections": connections}
