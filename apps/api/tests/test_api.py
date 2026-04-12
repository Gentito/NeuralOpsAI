import os
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _make_client(tmp_path):
    os.environ["DATABASE_PATH"] = str(tmp_path / "test.sqlite3")
    os.environ["CORS_ALLOW_ORIGINS"] = "http://localhost:3000"

    from app import create_app

    app = create_app()
    app.testing = True
    return app.test_client()


def test_health(tmp_path):
    client = _make_client(tmp_path)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.get_json() == {"ok": True}


def test_agents_seeded(tmp_path):
    client = _make_client(tmp_path)
    res = client.get("/agents")
    assert res.status_code == 200
    agents = res.get_json()
    assert isinstance(agents, list)
    assert len(agents) >= 10


def test_create_and_get_project(tmp_path):
    client = _make_client(tmp_path)
    res = client.post("/projects", json={"name": "Demo", "status": "active"})
    assert res.status_code == 201
    created = res.get_json()
    assert created["name"] == "Demo"
    assert "id" in created

    res2 = client.get(f"/projects/{created['id']}")
    assert res2.status_code == 200
    fetched = res2.get_json()
    assert fetched["id"] == created["id"]
    assert fetched["name"] == "Demo"


def test_update_task(tmp_path):
    client = _make_client(tmp_path)
    res = client.post("/tasks", json={"title": "Ship MVP", "status": "todo"})
    assert res.status_code == 201
    task = res.get_json()

    res2 = client.patch(f"/tasks/{task['id']}", json={"status": "doing"})
    assert res2.status_code == 200
    updated = res2.get_json()
    assert updated["status"] == "doing"


def test_chat(tmp_path):
    client = _make_client(tmp_path)
    res = client.post("/chat", json={"agent": "Chief of Staff Agent", "message": "Build MVP"})
    assert res.status_code == 200
    payload = res.get_json()
    assert payload["agent"] == "Chief of Staff Agent"
    assert payload["message"] == "Build MVP"
    assert "response" in payload
