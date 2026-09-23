import asyncio
import pytest
import celery_app
from tests.conftest import make_sprint, make_task


@pytest.mark.xfail(strict=True, reason="D1: dependency cycles are accepted (Tier 1)")
def test_dependency_cycle_rejected(api, project):
    h = api.login("admin")
    a = make_task(api, h, project, title="A")["id"]
    b = make_task(api, h, project, title="B")["id"]
    api.c.post("/dependencies/", json={"task_id": a, "depends_on_id": b}, headers=h)
    assert api.c.post("/dependencies/", json={"task_id": b, "depends_on_id": a}, headers=h).status_code == 400


@pytest.mark.xfail(strict=True, reason="D4: burndown rewrites past days (Tier 1)")
def test_burndown_past_days_unchanged_by_today(api, project):
    h = api.login("admin")
    sid = make_sprint(api, h, project, start_offset=-3, length=6)
    tid = make_task(api, h, project)["id"]
    api.c.patch(f"/tasks/{tid}/sprint", json={"sprint_id": sid}, headers=h)
    first_before = api.c.get(f"/sprints/{sid}/burndown", headers=h).json()[0]["actual"]
    api.c.patch(f"/tasks/{tid}/status", json={"status": "Done"}, headers=h)
    first_after = api.c.get(f"/sprints/{sid}/burndown", headers=h).json()[0]["actual"]
    assert first_after == first_before


@pytest.mark.xfail(strict=True, reason="D3: AI overwrites the human estimate (Tier 1)")
def test_ai_keeps_human_estimate(api, project, monkeypatch):
    h = api.login("admin")
    tid = make_task(api, h, project, estimated_hours=13)["id"]

    async def fake_ai(title, description=""):
        return {"category": "Backend", "priority": 3, "estimated_hours": 5, "confidence_score": 0.9,
                "risk_flags": "[]", "suggested_subtasks": "[]", "rationale": "x"}
    monkeypatch.setattr(celery_app, "analyze_task_ai", fake_ai)
    celery_app.analyze_task_background(tid)
    t = [x for x in api.c.get(f"/tasks/?project_id={project}", headers=h).json() if x["id"] == tid][0]
    assert t["estimated_hours"] == 13
