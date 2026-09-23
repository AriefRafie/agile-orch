from tests.conftest import make_sprint, make_task


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
