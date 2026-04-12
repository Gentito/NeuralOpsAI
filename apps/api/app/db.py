import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any


_DB_PATH: str | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db(db_path: str) -> None:
    global _DB_PATH
    _DB_PATH = db_path
    with _connect() as conn:
        conn.executescript(
            """
            PRAGMA journal_mode=WAL;

            CREATE TABLE IF NOT EXISTS agents (
              id TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS projects (
              id TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tasks (
              id TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS clients (
              id TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS invoices (
              id TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
              id TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            """
        )
        _seed_agents(conn)


def _connect() -> sqlite3.Connection:
    if not _DB_PATH:
        raise RuntimeError("Database not initialized")
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def list_items(table: str) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            f"SELECT id, payload, created_at, updated_at FROM {table} ORDER BY created_at DESC"
        ).fetchall()
    return [_row_to_item(r) for r in rows]


def count_items(table: str) -> int:
    with _connect() as conn:
        row = conn.execute(f"SELECT COUNT(1) AS c FROM {table}").fetchone()
        return int(row["c"])


def get_item(table: str, item_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute(
            f"SELECT id, payload, created_at, updated_at FROM {table} WHERE id = ?",
            (item_id,),
        ).fetchone()
    return _row_to_item(row) if row else None


def create_item(table: str, payload: dict[str, Any]) -> dict[str, Any]:
    item_id = payload.get("id") or str(uuid.uuid4())
    created_at = _now_iso()
    updated_at = created_at

    stored_payload = dict(payload)
    stored_payload["id"] = item_id

    with _connect() as conn:
        conn.execute(
            f"INSERT INTO {table} (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (item_id, json.dumps(stored_payload), created_at, updated_at),
        )
        conn.commit()

    return {**stored_payload, "created_at": created_at, "updated_at": updated_at}


def update_item(table: str, item_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    existing = get_item(table, item_id)
    if not existing:
        return None

    updated_at = _now_iso()
    merged = {k: v for k, v in existing.items() if k not in {"created_at", "updated_at"}}
    merged.update(payload)
    merged["id"] = item_id

    with _connect() as conn:
        conn.execute(
            f"UPDATE {table} SET payload = ?, updated_at = ? WHERE id = ?",
            (json.dumps(merged), updated_at, item_id),
        )
        conn.commit()

    return {**merged, "created_at": existing["created_at"], "updated_at": updated_at}


def delete_item(table: str, item_id: str) -> bool:
    with _connect() as conn:
        res = conn.execute(f"DELETE FROM {table} WHERE id = ?", (item_id,))
        conn.commit()
        return res.rowcount > 0


def _row_to_item(row: sqlite3.Row) -> dict[str, Any]:
    payload = json.loads(row["payload"])
    payload["created_at"] = row["created_at"]
    payload["updated_at"] = row["updated_at"]
    return payload


def _seed_agents(conn: sqlite3.Connection) -> None:
    count = conn.execute("SELECT COUNT(1) AS c FROM agents").fetchone()["c"]
    if count:
        return

    default_agents = [
        {"name": "Chief of Staff Agent", "department": "Executive", "role": "Orchestrator"},
        {"name": "Product Manager Agent", "department": "Product & Engineering", "role": "PM"},
        {"name": "UI/UX Designer Agent", "department": "Product & Engineering", "role": "Design"},
        {"name": "Frontend Developer Agent", "department": "Product & Engineering", "role": "Frontend"},
        {"name": "Backend Developer Agent", "department": "Product & Engineering", "role": "Backend"},
        {"name": "QA/Test Agent", "department": "Product & Engineering", "role": "QA"},
        {"name": "DevOps Agent", "department": "Product & Engineering", "role": "DevOps"},
        {"name": "CRM / Sales Agent", "department": "Business Operations", "role": "CRM"},
        {"name": "Finance / Invoicing Agent", "department": "Business Operations", "role": "Finance"},
        {"name": "Customer Support Agent", "department": "Business Operations", "role": "Support"},
        {"name": "Operations Manager Agent", "department": "Business Operations", "role": "Ops"},
        {"name": "HR / Recruiter Agent", "department": "People Operations", "role": "HR"},
        {"name": "Training & Policy Agent", "department": "People Operations", "role": "Policy"},
    ]

    now = _now_iso()
    for a in default_agents:
        item_id = str(uuid.uuid4())
        payload = {**a, "id": item_id}
        conn.execute(
            "INSERT INTO agents (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (item_id, json.dumps(payload), now, now),
        )
    conn.commit()
