from tests.conftest import make_sprint, make_task
import celery_app


def test_create_task_sets_placeholders_and_queues(api, project, fake_queue):
    t = make_task(api, api.login("admin"), project, title="Add login page")
    assert t["category"] == "General" and t["priority"] == 3
    assert fake_queue == [t["id"]]


def test_developer_can_create_task(api, project):
    make_task(api, api.login("dev"), project)


def test_viewer_cannot_create_task(api, project):
    r = api.c.post("/tasks/", json={"title": "x", "project_id": project}, headers=api.login("viewer"))
    assert r.status_code == 403


def test_unknown_assignee_404(api, project):
    r = api.c.post("/tasks/", json={"title": "x", "project_id": project, "assigned_to_id": 9999},
                   headers=api.login("admin"))
    assert r.status_code == 404


def test_sprint_from_other_project_404(api, project):
    h = api.login("admin")
    other = api.c.post("/projects/", json={"name": "Other"}, headers=h).json()["id"]
    sid = make_sprint(api, h, other)
    r = api.c.post("/tasks/", json={"title": "x", "project_id": project, "sprint_id": sid}, headers=h)
    assert r.status_code == 404


def test_broker_down_still_saves_task(api, project, broken_queue):
    h = api.login("admin")
    r = api.c.post("/tasks/", json={"title": "x", "project_id": project}, headers=h)
    assert r.status_code == 200
    ids = [t["id"] for t in api.c.get(f"/tasks/?project_id={project}", headers=h).json()]
    assert r.json()["id"] in ids


def test_worker_persists_provenance(api, project, monkeypatch):
    h = api.login("admin")
    tid = make_task(api, h, project, title="Fix SQL injection")["id"]

    async def fake_ai(title, description=""):
        return {"category": "Security", "priority": 5, "estimated_hours": 6, "confidence_score": 0.9,
                "risk_flags": '["security"]', "suggested_subtasks": "[]", "rationale": "r",
                "ai_provider": "ollama", "ai_model": "llama3.1:8b", "ai_is_fallback": False,
                "ai_needs_review": False}
    monkeypatch.setattr(celery_app, "analyze_task_ai", fake_ai)
    celery_app.analyze_task_background(tid)
    t = [x for x in api.c.get(f"/tasks/?project_id={project}", headers=h).json() if x["id"] == tid][0]
    assert t["ai_provider"] == "ollama" and t["ai_model"] == "llama3.1:8b"
    assert t["ai_is_fallback"] is False and t["ai_needs_review"] is False
    assert t["ai_analyzed_at"] is not None


def test_new_task_has_no_provenance_yet(api, project):
    t = make_task(api, api.login("admin"), project)
    assert t["ai_provider"] is None and t["ai_analyzed_at"] is None and t["ai_is_fallback"] is False
