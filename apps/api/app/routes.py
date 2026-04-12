import os
from typing import Any

from flask import Blueprint, Response, jsonify, request

from .db import count_items, create_item, delete_item, get_item, list_items, update_item


api = Blueprint("api", __name__)


def _cors_allow_origins() -> list[str]:
    raw = os.environ.get("CORS_ALLOW_ORIGINS", "")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins


@api.after_request
def _add_cors_headers(resp: Response) -> Response:
    origins = _cors_allow_origins()
    origin = request.headers.get("Origin")
    if origin and (not origins or origin in origins):
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    return resp


@api.route("/<path:_path>", methods=["OPTIONS"])
def _options(_path: str) -> tuple[Response, int]:
    return jsonify({"ok": True}), 200


@api.get("/health")
def health() -> tuple[Response, int]:
    return jsonify({"ok": True}), 200


def _parse_json() -> dict[str, Any]:
    data = request.get_json(silent=True)
    if isinstance(data, dict):
        return data
    return {}


def _filter_items(items: list[dict[str, Any]], filters: dict[str, str]) -> list[dict[str, Any]]:
    if not filters:
        return items

    def _matches(item: dict[str, Any]) -> bool:
        for k, v in filters.items():
            if v == "":
                continue
            if str(item.get(k, "")) != v:
                return False
        return True

    return [i for i in items if _matches(i)]


def _register_crud(resource: str, filter_keys: tuple[str, ...]) -> None:
    table = resource

    def _list_view() -> tuple[Response, int]:
        filters: dict[str, str] = {}
        for k in filter_keys:
            val = request.args.get(k)
            if val is not None:
                filters[k] = str(val)
        items = list_items(table)
        return jsonify(_filter_items(items, filters)), 200

    def _create_view() -> tuple[Response, int]:
        payload = _parse_json()
        item = create_item(table, payload)
        return jsonify(item), 201

    def _get_view(item_id: str) -> tuple[Response, int]:
        item = get_item(table, item_id)
        if not item:
            return jsonify({"error": "not_found"}), 404
        return jsonify(item), 200

    def _update_view(item_id: str) -> tuple[Response, int]:
        payload = _parse_json()
        item = update_item(table, item_id, payload)
        if not item:
            return jsonify({"error": "not_found"}), 404
        return jsonify(item), 200

    def _delete_view(item_id: str) -> tuple[Response, int]:
        ok = delete_item(table, item_id)
        if not ok:
            return jsonify({"error": "not_found"}), 404
        return jsonify({"ok": True}), 200

    api.add_url_rule(
        f"/{resource}",
        endpoint=f"{resource}_list",
        view_func=_list_view,
        methods=["GET"],
    )
    api.add_url_rule(
        f"/{resource}",
        endpoint=f"{resource}_create",
        view_func=_create_view,
        methods=["POST"],
    )
    api.add_url_rule(
        f"/{resource}/<item_id>",
        endpoint=f"{resource}_get",
        view_func=_get_view,
        methods=["GET"],
    )
    api.add_url_rule(
        f"/{resource}/<item_id>",
        endpoint=f"{resource}_update",
        view_func=_update_view,
        methods=["PUT", "PATCH"],
    )
    api.add_url_rule(
        f"/{resource}/<item_id>",
        endpoint=f"{resource}_delete",
        view_func=_delete_view,
        methods=["DELETE"],
    )


for _r in ("agents", "projects", "tasks", "clients", "invoices"):
    if _r == "tasks":
        _register_crud(_r, ("status", "assignedTo", "projectId", "clientId"))
    elif _r == "projects":
        _register_crud(_r, ("status", "clientId"))
    elif _r == "invoices":
        _register_crud(_r, ("status", "clientId", "projectId"))
    else:
        _register_crud(_r, ())


def _conversation_key(project_id: str | None, client_id: str | None) -> str:
    if project_id:
        return f"project:{project_id}"
    if client_id:
        return f"client:{client_id}"
    return "global"


def _next_invoice_number() -> str:
    n = count_items("invoices") + 1
    return f"INV-{n:06d}"


def _to_money(value: Any) -> float:
    try:
        return round(float(value), 2)
    except Exception:
        return 0.0


def _compute_invoice_totals(line_items: list[dict[str, Any]], tax_rate: float) -> dict[str, Any]:
    normalized: list[dict[str, Any]] = []
    subtotal = 0.0
    for li in line_items:
        desc = str(li.get("description") or "").strip()
        qty = _to_money(li.get("qty") or 0)
        unit_price = _to_money(li.get("unitPrice") or 0)
        amount = round(qty * unit_price, 2)
        subtotal = round(subtotal + amount, 2)
        normalized.append(
            {
                "description": desc,
                "qty": qty,
                "unitPrice": unit_price,
                "amount": amount,
            }
        )

    tax_amount = round(subtotal * max(tax_rate, 0.0), 2)
    total = round(subtotal + tax_amount, 2)
    return {
        "lineItems": normalized,
        "subtotal": subtotal,
        "taxRate": tax_rate,
        "taxAmount": tax_amount,
        "total": total,
    }


@api.post("/invoices/generate")
def generate_invoice() -> tuple[Response, int]:
    payload = _parse_json()
    client_id = payload.get("clientId")
    project_id = payload.get("projectId")
    currency = str(payload.get("currency") or "USD")
    payment_terms = str(payload.get("paymentTerms") or "Net 14")
    due_date = payload.get("dueDate")
    tax_rate = float(payload.get("taxRate") or 0.0)

    raw_items = payload.get("lineItems")
    if not isinstance(raw_items, list):
        raw_items = []

    totals = _compute_invoice_totals(raw_items, tax_rate)

    invoice_payload = {
        "invoiceNumber": _next_invoice_number(),
        "status": "issued",
        "clientId": client_id,
        "projectId": project_id,
        "currency": currency,
        "paymentTerms": payment_terms,
        "dueDate": due_date,
        **totals,
    }

    created = create_item("invoices", invoice_payload)
    return jsonify(created), 201


@api.post("/orchestrate")
def orchestrate() -> tuple[Response, int]:
    payload = _parse_json()
    objective = str(payload.get("objective") or "").strip()
    if not objective:
        return jsonify({"error": "objective_required"}), 400

    project_id = payload.get("projectId")
    client_id = payload.get("clientId")

    planned = [
        ("Product Manager Agent", f"Create PRD for: {objective}"),
        ("UI/UX Designer Agent", f"Create user flows + wireframes for: {objective}"),
        ("Backend Developer Agent", f"Implement backend APIs for: {objective}"),
        ("Frontend Developer Agent", f"Implement frontend UI for: {objective}"),
        ("QA/Test Agent", f"Create test plan and validate: {objective}"),
        ("DevOps Agent", f"Prepare deployment for: {objective}"),
    ]

    created_tasks: list[dict[str, Any]] = []
    for assigned_to, title in planned:
        created_tasks.append(
            create_item(
                "tasks",
                {
                    "title": title,
                    "status": "todo",
                    "assignedTo": assigned_to,
                    "projectId": project_id,
                    "clientId": client_id,
                    "source": "orchestrate",
                },
            )
        )

    return jsonify({"objective": objective, "tasks": created_tasks}), 201


@api.post("/chat")
def chat() -> tuple[Response, int]:
    payload = _parse_json()
    message = str(payload.get("message") or "")
    agent = str(payload.get("agent") or "Chief of Staff Agent")
    project_id = payload.get("projectId")
    client_id = payload.get("clientId")
    conversation_key = _conversation_key(project_id, client_id)

    response_text = (
        f"{agent} received: {message}\n\n"
        "Next: wire this endpoint to an LLM provider, then log conversations per project/client."
    )

    user_msg = create_item(
        "chat_messages",
        {
            "conversationKey": conversation_key,
            "projectId": project_id,
            "clientId": client_id,
            "role": "user",
            "agent": agent,
            "content": message,
        },
    )
    agent_msg = create_item(
        "chat_messages",
        {
            "conversationKey": conversation_key,
            "projectId": project_id,
            "clientId": client_id,
            "role": "agent",
            "agent": agent,
            "content": response_text,
        },
    )

    return (
        jsonify(
            {
                "agent": agent,
                "message": message,
                "response": response_text,
                "conversationKey": conversation_key,
                "messages": [user_msg, agent_msg],
            }
        ),
        200,
    )


@api.get("/chat/messages")
def list_chat_messages() -> tuple[Response, int]:
    project_id = request.args.get("projectId")
    client_id = request.args.get("clientId")
    conversation_key = request.args.get("conversationKey") or _conversation_key(project_id, client_id)

    items = list_items("chat_messages")
    filtered = _filter_items(items, {"conversationKey": str(conversation_key)})
    return jsonify(list(reversed(filtered))), 200
