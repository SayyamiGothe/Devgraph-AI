import logging

from app.graph.neo4j_client import run_query

logger = logging.getLogger(__name__)

BATCH = 500

# Labels and relationship types cannot be parameterised in Cypher,
# so there is one statement per kind rather than one generic one.
# This is also what lets us avoid requiring the APOC plugin.
KIND_TO_LABEL = {
    "module": "Module",
    "class": "Class",
    "function": "Function",
}

EDGE_KINDS = {"DEFINES", "IMPORTS", "CALLS", "INHERITS"}


class CodeGraphRepository:
    """
    All Cypher lives here.

    Every read MUST filter on repository_id - that is the tenancy
    boundary, the same role organisation_id plays in the SQL repos.
    """

    @staticmethod
    def node_key(repository_id: int, fqn: str) -> str:
        # fqn alone collides across repositories: every repo has an
        # `app.main`. Prefixing keeps their graphs from fusing.
        return f"{repository_id}:{fqn}"

    # ------------------------------------------------------------------
    # write
    # ------------------------------------------------------------------

    def upsert_nodes(self, repository_id: int, nodes) -> int:
        by_kind = {kind: [] for kind in KIND_TO_LABEL}

        for node in nodes:

            if node.kind not in by_kind:
                logger.warning("Unknown node kind %r, skipping", node.kind)
                continue

            by_kind[node.kind].append(
                {
                    "node_key": self.node_key(repository_id, node.fqn),
                    "fqn": node.fqn,
                    "name": node.name,
                    "kind": node.kind,
                    "file_path": node.file_path,
                    "start_line": node.start_line,
                    "end_line": node.end_line,
                    # Neo4j has no null property: assigning None DELETES
                    # the key, so a later read would KeyError.
                    "signature": node.signature or "",
                    "docstring": node.docstring or "",
                    "decorators": [str(d) for d in (node.decorators or [])],
                    "is_async": bool(node.is_async),
                    "repository_id": repository_id,
                }
            )

        total = 0

        for kind, rows in by_kind.items():

            if not rows:
                continue

            label = KIND_TO_LABEL[kind]

            query = (
                "UNWIND $rows AS row "
                "MERGE (n:CodeNode {node_key: row.node_key}) "
                "SET n += row "
                f"SET n:{label}"
            )

            for start in range(0, len(rows), BATCH):
                run_query(query, {"rows": rows[start:start + BATCH]})

            total += len(rows)

        return total

    def upsert_edges(self, repository_id: int, edges) -> int:
        by_kind = {}

        for src, dst, kind in edges:

            if kind not in EDGE_KINDS:
                logger.warning("Unknown edge kind %r, skipping", kind)
                continue

            by_kind.setdefault(kind, []).append(
                {
                    "src": self.node_key(repository_id, src),
                    "dst": self.node_key(repository_id, dst),
                }
            )

        total = 0

        for kind, rows in by_kind.items():

            # MATCH both endpoints, never MERGE them: MERGE would
            # create a property-less phantom node when an endpoint is
            # missing, hiding a resolver bug behind fake graph data.
            query = (
                "UNWIND $rows AS row "
                "MATCH (a:CodeNode {node_key: row.src}) "
                "MATCH (b:CodeNode {node_key: row.dst}) "
                f"MERGE (a)-[:{kind}]->(b)"
            )

            for start in range(0, len(rows), BATCH):
                run_query(query, {"rows": rows[start:start + BATCH]})

            total += len(rows)

        return total

    def delete_repository(self, repository_id: int):
        run_query(
            "MATCH (n:CodeNode {repository_id: $rid}) DETACH DELETE n",
            {"rid": repository_id},
        )

    # ------------------------------------------------------------------
    # read
    # ------------------------------------------------------------------

    def get_neighbours(self, repository_id: int, fqn: str, limit: int = 15):
        """The query the graph-aware Q&A step depends on."""
        records = run_query(
            """
            MATCH (n:CodeNode {node_key: $key})
            OPTIONAL MATCH (caller)-[:CALLS]->(n)
            OPTIONAL MATCH (n)-[:CALLS]->(callee)
            OPTIONAL MATCH (n)-[:INHERITS]->(base)
            OPTIONAL MATCH (parent)-[:DEFINES]->(n)
            RETURN n AS node,
                   [c IN collect(DISTINCT caller)
                       WHERE c IS NOT NULL | c.fqn][..$limit] AS callers,
                   [c IN collect(DISTINCT callee)
                       WHERE c IS NOT NULL | c.fqn][..$limit] AS callees,
                   [b IN collect(DISTINCT base)
                       WHERE b IS NOT NULL | b.fqn] AS bases,
                   head([p IN collect(parent)
                       WHERE p IS NOT NULL | p.fqn]) AS parent
            """,
            {"key": self.node_key(repository_id, fqn), "limit": limit},
        )

        if not records:
            return None

        record = records[0]

        return {
            "node": dict(record["node"]),
            "callers": record["callers"],
            "callees": record["callees"],
            "bases": record["bases"],
            "parent": record["parent"],
        }

    def find_by_name(self, repository_id: int, name: str, limit: int = 10):
        """Fallback when vector search misses a function the user named."""
        records = run_query(
            """
            MATCH (n:CodeNode {repository_id: $rid, name: $name})
            RETURN n.fqn AS fqn, n.kind AS kind,
                   n.file_path AS file_path,
                   n.start_line AS start_line,
                   n.end_line AS end_line,
                   n.signature AS signature
            LIMIT $limit
            """,
            {"rid": repository_id, "name": name, "limit": limit},
        )

        return [dict(record) for record in records]

    def get_stats(self, repository_id: int):
        nodes = run_query(
            "MATCH (n:CodeNode {repository_id: $rid}) "
            "RETURN n.kind AS kind, count(*) AS count",
            {"rid": repository_id},
        )

        edges = run_query(
            "MATCH (a:CodeNode {repository_id: $rid})-[r]->() "
            "RETURN type(r) AS kind, count(*) AS count",
            {"rid": repository_id},
        )

        return {
            "nodes": {r["kind"]: r["count"] for r in nodes},
            "edges": {r["kind"]: r["count"] for r in edges},
        }
