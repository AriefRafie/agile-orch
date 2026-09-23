"""Test harness: runs the real FastAPI app against a separate Postgres database.

The AI and the Celery queue are faked, so tests are fast and need no model.
"""
import os
from datetime import date, timedelta
from types import SimpleNamespace
from urllib.parse import urlparse, urlunparse

import psycopg2
import pytest
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_DB = "autosprint_test"

_prod_url = os.environ["DATABASE_URL"]
TEST_URL = urlunparse(urlparse(_prod_url)._replace(path=f"/{TEST_DB}"))


def _ensure_test_db():
    conn = psycopg2.connect(_prod_url)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB,))
        if not cur.fetchone():
            cur.execute(f'CREATE DATABASE "{TEST_DB}"')
    conn.close()


# Must happen before importing app modules: database.py builds its engine at import.
_ensure_test_db()
os.environ["DATABASE_URL"] = TEST_URL

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402

_cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
_cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "migrations"))
command.upgrade(_cfg, "heads")

import database  # noqa: E402
import models  # noqa: E402
import auth_service  # noqa: E402
import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402


def _truncate_all():
    tables = [t.name for t in database.Base.metadata.sorted_tables]
    with database.engine.begin() as conn:
        conn.execute(text("TRUNCATE " + ", ".join(f'"{t}"' for t in tables) + " RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True)
def clean_db():
    _truncate_all()
    yield
    _truncate_all()


@pytest.fixture(autouse=True)
def fake_queue(monkeypatch):
    """Replace the Celery task used by main.py; record queued task ids."""
    queued = []
    monkeypatch.setattr(main, "analyze_task_background", SimpleNamespace(delay=queued.append))
    return queued


@pytest.fixture
def broken_queue(monkeypatch):
    def _boom(_task_id):
        raise ConnectionError("redis down")
    monkeypatch.setattr(main, "analyze_task_background", SimpleNamespace(delay=_boom))


@pytest.fixture
def client():
    return TestClient(main.app)


class Api:
    def __init__(self, client):
        self.c = client

    def login(self, username):
        r = self.c.post("/auth/login", json={"username": username, "password": f"pw-{username}"})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def api(client):
    return Api(client)


@pytest.fixture
def users():
    db = database.SessionLocal()
    try:
        ids = {}
        for name, role in [("admin", models.UserRole.ADMIN),
                           ("dev", models.UserRole.DEVELOPER),
                           ("viewer", models.UserRole.VIEWER)]:
            u = models.User(username=name,
                            hashed_password=auth_service.get_password_hash(f"pw-{name}"),
                            role=role.value)
            db.add(u)
            db.flush()
            ids[name] = u.id
        db.commit()
        return ids
    finally:
        db.close()


@pytest.fixture
def project(api, users):
    h = api.login("admin")
    pid = api.c.post("/projects/", json={"name": "P"}, headers=h).json()["id"]
    for name in ("dev", "viewer"):
        r = api.c.post(f"/projects/{pid}/access", json={"user_id": users[name], "project_id": pid}, headers=h)
        assert r.status_code == 200, r.text
    return pid


def make_sprint(api, headers, project_id, start_offset=0, length=10, **extra):
    start = date.today() + timedelta(days=start_offset)
    body = {"name": "S", "project_id": project_id, "start_date": str(start),
            "end_date": str(start + timedelta(days=length)), "velocity": 40, **extra}
    r = api.c.post("/sprints/", json=body, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def make_task(api, headers, project_id, title="T", **extra):
    r = api.c.post("/tasks/", json={"title": title, "project_id": project_id, **extra}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()
