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
    res = client.post(
        "/chat",
        json={"agent": "Chief of Staff Agent", "message": "Build MVP", "projectId": "p1"},
    )
    assert res.status_code == 200
    payload = res.get_json()
    assert payload["agent"] == "Chief of Staff Agent"
    assert payload["message"] == "Build MVP"
    assert "response" in payload

    res2 = client.get("/chat/messages?projectId=p1")
    assert res2.status_code == 200
    messages = res2.get_json()
    assert isinstance(messages, list)
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "agent"


def test_task_filters(tmp_path):
    client = _make_client(tmp_path)
    client.post("/tasks", json={"title": "A", "status": "todo", "projectId": "p1"})
    client.post("/tasks", json={"title": "B", "status": "done", "projectId": "p1"})
    client.post("/tasks", json={"title": "C", "status": "todo", "projectId": "p2"})

    res = client.get("/tasks?status=todo")
    assert res.status_code == 200
    items = res.get_json()
    assert all(i["status"] == "todo" for i in items)

    res2 = client.get("/tasks?status=todo&projectId=p1")
    assert res2.status_code == 200
    items2 = res2.get_json()
    assert all(i["status"] == "todo" and i.get("projectId") == "p1" for i in items2)


def test_orchestrate_creates_tasks(tmp_path):
    client = _make_client(tmp_path)
    res = client.post("/orchestrate", json={"objective": "AI Company Dashboard", "projectId": "p1"})
    assert res.status_code == 201
    payload = res.get_json()
    assert payload["objective"] == "AI Company Dashboard"
    tasks = payload["tasks"]
    assert isinstance(tasks, list)
    assert len(tasks) == 6
    assert all(t.get("projectId") == "p1" for t in tasks)


def test_invoice_generate(tmp_path):
    client = _make_client(tmp_path)
    res = client.post(
        "/invoices/generate",
        json={
            "clientId": "c1",
            "currency": "USD",
            "taxRate": 0.1,
            "paymentTerms": "Net 7",
            "lineItems": [
                {"description": "Build MVP", "qty": 2, "unitPrice": 1000},
                {"description": "Support", "qty": 1, "unitPrice": 250},
            ],
        },
    )
    assert res.status_code == 201
    inv = res.get_json()
    assert inv["status"] == "issued"
    assert inv["clientId"] == "c1"
    assert inv["currency"] == "USD"
    assert inv["paymentTerms"] == "Net 7"
    assert inv["invoiceNumber"].startswith("INV-")
    assert inv["subtotal"] == 2250.0
    assert inv["taxAmount"] == 225.0
    assert inv["total"] == 2475.0
