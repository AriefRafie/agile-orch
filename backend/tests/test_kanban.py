from tests.conftest import make_task


def test_invalid_status_rejected(api, project):
    h = api.login("dev")
    tid = make_task(api, h, project)["id"]
    assert api.c.patch(f"/tasks/{tid}/status", json={"status": "Doing"}, headers=h).status_code == 400


def test_done_task_cannot_move_to_todo_or_review(api, project):
    h = api.login("admin")
    tid = make_task(api, h, project)["id"]
    assert api.c.patch(f"/tasks/{tid}/status", json={"status": "Done"}, headers=h).status_code == 200
    for status in ["Todo", "Review"]:
        r = api.c.patch(f"/tasks/{tid}/status", json={"status": status}, headers=h)
        assert r.status_code == 400, f"Expected 400 for Done -> {status}, got {r.status_code}"
        assert "completed" in r.json()["detail"].lower()
    # Done -> In Progress is allowed for rework
    r = api.c.patch(f"/tasks/{tid}/status", json={"status": "In Progress"}, headers=h)
    assert r.status_code == 200, f"Expected 200 for Done -> In Progress, got {r.status_code}"


def test_dependency_blocks_done_until_prerequisite_done(api, project):
    h = api.login("admin")
    a = make_task(api, h, project, title="A")["id"]
    b = make_task(api, h, project, title="B")["id"]
    assert api.c.post("/dependencies/", json={"task_id": a, "depends_on_id": b}, headers=h).status_code == 200
    r = api.c.patch(f"/tasks/{a}/status", json={"status": "Done"}, headers=h)
    assert r.status_code == 400 and "Blocked" in r.json()["detail"]
    api.c.patch(f"/tasks/{b}/status", json={"status": "Done"}, headers=h)
    assert api.c.patch(f"/tasks/{a}/status", json={"status": "Done"}, headers=h).status_code == 200


def test_task_cannot_depend_on_itself(api, project):
    h = api.login("admin")
    a = make_task(api, h, project)["id"]
    assert api.c.post("/dependencies/", json={"task_id": a, "depends_on_id": a}, headers=h).status_code == 400
