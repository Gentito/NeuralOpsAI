import os
from typing import Any

from . import db as sqlite_db


_provider: str = "sqlite"


def _map_filters(table: str, filters: dict[str, str] | None) -> dict[str, str] | None:
    if not filters:
        return None
    mapped: dict[str, str] = {}
    for k, v in filters.items():
        mapped[_to_supabase_key(table, k)] = v
    return mapped


def _to_supabase_key(table: str, key: str) -> str:
    maps = {
        "tasks": {"assignedTo": "assigned_to", "projectId": "project_id", "clientId": "client_id"},
        "projects": {"clientId": "client_id"},
        "invoices": {"clientId": "client_id", "projectId": "project_id"},
        "chat_messages": {"conversationKey": "conversation_key", "projectId": "project_id", "clientId": "client_id"},
    }
    return maps.get(table, {}).get(key, key)


def _to_supabase_payload(table: str, payload: dict[str, Any]) -> dict[str, Any]:
    if table == "tasks":
        return {
            "id": payload.get("id"),
            "title": payload.get("title"),
            "status": payload.get("status"),
            "assigned_to": payload.get("assignedTo"),
            "project_id": payload.get("projectId"),
            "client_id": payload.get("clientId"),
            "source": payload.get("source"),
        }
    if table == "projects":
        return {
            "id": payload.get("id"),
            "name": payload.get("name"),
            "status": payload.get("status"),
            "client_id": payload.get("clientId"),
        }
    if table == "clients":
        return {
            "id": payload.get("id"),
            "name": payload.get("name"),
            "email": payload.get("email"),
            "status": payload.get("status"),
        }
    if table == "invoices":
        return {
            "id": payload.get("id"),
            "invoice_number": payload.get("invoiceNumber"),
            "status": payload.get("status"),
            "client_id": payload.get("clientId"),
            "project_id": payload.get("projectId"),
            "currency": payload.get("currency"),
            "payment_terms": payload.get("paymentTerms"),
            "due_date": payload.get("dueDate"),
            "tax_rate": payload.get("taxRate"),
            "subtotal": payload.get("subtotal"),
            "tax_amount": payload.get("taxAmount"),
            "total": payload.get("total"),
            "line_items": payload.get("lineItems"),
        }
    if table == "chat_messages":
        return {
            "id": payload.get("id"),
            "conversation_key": payload.get("conversationKey"),
            "project_id": payload.get("projectId"),
            "client_id": payload.get("clientId"),
            "role": payload.get("role"),
            "agent": payload.get("agent"),
            "content": payload.get("content"),
        }
    return dict(payload)


def _from_supabase_row(table: str, row: dict[str, Any]) -> dict[str, Any]:
    if table == "tasks":
        return {
            "id": row.get("id"),
            "title": row.get("title"),
            "status": row.get("status"),
            "assignedTo": row.get("assigned_to"),
            "projectId": row.get("project_id"),
            "clientId": row.get("client_id"),
            "source": row.get("source"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }
    if table == "projects":
        return {
            "id": row.get("id"),
            "name": row.get("name"),
            "status": row.get("status"),
            "clientId": row.get("client_id"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }
    if table == "clients":
        return {
            "id": row.get("id"),
            "name": row.get("name"),
            "email": row.get("email"),
            "status": row.get("status"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }
    if table == "invoices":
        return {
            "id": row.get("id"),
            "invoiceNumber": row.get("invoice_number"),
            "status": row.get("status"),
            "clientId": row.get("client_id"),
            "projectId": row.get("project_id"),
            "currency": row.get("currency"),
            "paymentTerms": row.get("payment_terms"),
            "dueDate": row.get("due_date"),
            "taxRate": row.get("tax_rate"),
            "subtotal": row.get("subtotal"),
            "taxAmount": row.get("tax_amount"),
            "total": row.get("total"),
            "lineItems": row.get("line_items"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }
    if table == "chat_messages":
        return {
            "id": row.get("id"),
            "conversationKey": row.get("conversation_key"),
            "projectId": row.get("project_id"),
            "clientId": row.get("client_id"),
            "role": row.get("role"),
            "agent": row.get("agent"),
            "content": row.get("content"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }
    return row


def init_store() -> None:
    global _provider
    _provider = os.environ.get("DATABASE_PROVIDER", "sqlite").strip().lower() or "sqlite"

    if _provider == "supabase":
        from .supabase_store import init_supabase_store

        init_supabase_store()
        return

    db_path = os.environ.get("DATABASE_PATH", "./neuralops.sqlite3")
    sqlite_db.init_db(db_path)


def _supabase():
    from .supabase_store import init_supabase_store

    return init_supabase_store()


def require_user(auth_header: str | None) -> dict[str, Any]:
    if _provider != "supabase":
        return {"id": "local"}
    return _supabase().require_user(auth_header)


def list_items(table: str, token: str | None = None, filters: dict[str, str] | None = None) -> list[dict[str, Any]]:
    if _provider == "supabase":
        if not token:
            raise PermissionError("missing_token")
        rows = _supabase().list_items(table, token=token, filters=_map_filters(table, filters))
        return [_from_supabase_row(table, r) for r in rows]
    return sqlite_db.list_items(table)


def get_item(table: str, item_id: str, token: str | None = None) -> dict[str, Any] | None:
    if _provider == "supabase":
        if not token:
            raise PermissionError("missing_token")
        row = _supabase().get_item(table, token=token, item_id=item_id)
        return _from_supabase_row(table, row) if row else None
    return sqlite_db.get_item(table, item_id)


def create_item(table: str, payload: dict[str, Any], token: str | None = None) -> dict[str, Any]:
    if _provider == "supabase":
        if not token:
            raise PermissionError("missing_token")
        row = _supabase().create_item(table, token=token, payload=_to_supabase_payload(table, payload))
        return _from_supabase_row(table, row)
    return sqlite_db.create_item(table, payload)


def update_item(table: str, item_id: str, payload: dict[str, Any], token: str | None = None) -> dict[str, Any] | None:
    if _provider == "supabase":
        if not token:
            raise PermissionError("missing_token")
        row = _supabase().update_item(table, token=token, item_id=item_id, payload=_to_supabase_payload(table, payload))
        return _from_supabase_row(table, row) if row else None
    return sqlite_db.update_item(table, item_id, payload)


def delete_item(table: str, item_id: str, token: str | None = None) -> bool:
    if _provider == "supabase":
        if not token:
            raise PermissionError("missing_token")
        return _supabase().delete_item(table, token=token, item_id=item_id)
    return sqlite_db.delete_item(table, item_id)


def count_items(table: str, token: str | None = None) -> int:
    if _provider == "supabase":
        if not token:
            raise PermissionError("missing_token")
        return _supabase().count_items(table, token=token)
    return sqlite_db.count_items(table)
