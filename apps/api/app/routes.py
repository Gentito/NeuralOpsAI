import os
from typing import Any

from flask import Blueprint, Response, jsonify, request

from .db import create_item, delete_item, get_item, list_items, update_item


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


def _register_crud(resource: str) -> None:
    table = resource

    def _list_view() -> tuple[Response, int]:
        return jsonify(list_items(table)), 200

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
    _register_crud(_r)


@api.post("/chat")
def chat() -> tuple[Response, int]:
    payload = _parse_json()
    message = str(payload.get("message") or "")
    agent = str(payload.get("agent") or "Chief of Staff Agent")

    response_text = (
        f"{agent} received: {message}\n\n"
        "Next: wire this endpoint to an LLM provider, then log conversations per project/client."
    )

    return jsonify({"agent": agent, "message": message, "response": response_text}), 200
