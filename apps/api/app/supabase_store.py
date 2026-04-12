import os
from typing import Any

import requests


class SupabaseStore:
    def __init__(self, url: str, anon_key: str) -> None:
        self.url = url.rstrip("/")
        self.anon_key = anon_key

    def require_user(self, auth_header: str | None) -> dict[str, Any]:
        if not auth_header or not auth_header.lower().startswith("bearer "):
            raise PermissionError("missing_token")

        token = auth_header.split(" ", 1)[1].strip()
        r = requests.get(
            f"{self.url}/auth/v1/user",
            headers={"apikey": self.anon_key, "Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if r.status_code != 200:
            raise PermissionError("invalid_token")
        return r.json()

    def list_items(self, table: str, token: str, filters: dict[str, str] | None = None) -> list[dict[str, Any]]:
        params: list[tuple[str, str]] = [("select", "*"), ("order", "created_at.desc")]
        if filters:
            for k, v in filters.items():
                params.append((k, f"eq.{v}"))
        r = requests.get(self._rest_url(table), headers=self._headers(token), params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        return data if isinstance(data, list) else []

    def get_item(self, table: str, token: str, item_id: str) -> dict[str, Any] | None:
        params = [("select", "*"), ("id", f"eq.{item_id}")]
        r = requests.get(self._rest_url(table), headers=self._headers(token), params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list) and data:
            return data[0]
        return None

    def create_item(self, table: str, token: str, payload: dict[str, Any]) -> dict[str, Any]:
        r = requests.post(
            self._rest_url(table),
            headers={**self._headers(token), "Prefer": "return=representation"},
            json=payload,
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list) and data:
            return data[0]
        if isinstance(data, dict):
            return data
        return payload

    def update_item(self, table: str, token: str, item_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        r = requests.patch(
            self._rest_url(table),
            headers={**self._headers(token), "Prefer": "return=representation"},
            params=[("id", f"eq.{item_id}")],
            json=payload,
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list) and data:
            return data[0]
        return None

    def delete_item(self, table: str, token: str, item_id: str) -> bool:
        r = requests.delete(
            self._rest_url(table),
            headers=self._headers(token),
            params=[("id", f"eq.{item_id}")],
            timeout=15,
        )
        if r.status_code in (200, 204):
            return True
        if r.status_code == 404:
            return False
        r.raise_for_status()
        return False

    def count_items(self, table: str, token: str) -> int:
        r = requests.get(
            self._rest_url(table),
            headers={**self._headers(token), "Prefer": "count=exact"},
            params=[("select", "id")],
            timeout=15,
        )
        r.raise_for_status()
        count_hdr = r.headers.get("content-range")
        if count_hdr and "/" in count_hdr:
            try:
                return int(count_hdr.split("/")[-1])
            except Exception:
                return 0
        return 0

    def _headers(self, token: str) -> dict[str, str]:
        return {"apikey": self.anon_key, "Authorization": f"Bearer {token}"}

    def _rest_url(self, table: str) -> str:
        return f"{self.url}/rest/v1/{table}"


_STORE: SupabaseStore | None = None


def init_supabase_store() -> SupabaseStore:
    global _STORE
    if _STORE:
        return _STORE
    url = os.environ.get("SUPABASE_URL", "").strip()
    anon_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    if not url or not anon_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY are required")
    _STORE = SupabaseStore(url=url, anon_key=anon_key)
    return _STORE

