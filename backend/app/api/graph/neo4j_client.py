import logging

from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError, ServiceUnavailable

from app.core.config import settings

logger = logging.getLogger(__name__)

_driver = None

SCHEMA_STATEMENTS = [
    """
    CREATE CONSTRAINT code_node_key IF NOT EXISTS
    FOR (n:CodeNode) REQUIRE n.node_key IS UNIQUE
    """,
    "CREATE INDEX code_node_repository IF NOT EXISTS "
    "FOR (n:CodeNode) ON (n.repository_id)",
    "CREATE INDEX code_node_name IF NOT EXISTS "
    "FOR (n:CodeNode) ON (n.name)",
]


def get_driver():
    """One driver for the whole process. It is thread-safe and pools
    connections internally, so it must NOT be created per request."""
    global _driver

    if _driver is None:
        _driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
            max_connection_pool_size=20,
        )

    return _driver


def close_driver():
    global _driver

    if _driver is not None:
        _driver.close()
        _driver = None


def run_query(query: str, parameters: dict | None = None):
    """Every Cypher call in the app goes through here."""
    records, _summary, _keys = get_driver().execute_query(
        query,
        parameters_=parameters or {},
        database_=settings.NEO4J_DATABASE,
    )
    return records


def verify_connection() -> bool:
    try:
        get_driver().verify_connectivity()
        return True
    except (ServiceUnavailable, Neo4jError) as exc:
        logger.warning("Neo4j is not reachable: %s", exc)
        return False


def ensure_schema() -> bool:
    """Idempotent. Safe to run on every startup."""
    if not verify_connection():
        return False

    for statement in SCHEMA_STATEMENTS:
        try:
            run_query(statement)
        except Neo4jError as exc:
            logger.warning("Neo4j schema statement failed: %s", exc)
            return False

    logger.info("Neo4j schema is ready")
    return True
