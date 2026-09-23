def test_user_without_access_cannot_read_project(api, users):
    h = api.login("admin")
    pid = api.c.post("/projects/", json={"name": "Private"}, headers=h).json()["id"]
    r = api.c.get(f"/tasks/?project_id={pid}", headers=api.login("dev"))
    assert r.status_code == 403


def test_viewer_cannot_change_status(api, project):
    h = api.login("admin")
    tid = api.c.post("/tasks/", json={"title": "x", "project_id": project}, headers=h).json()["id"]
    r = api.c.patch(f"/tasks/{tid}/status", json={"status": "Done"}, headers=api.login("viewer"))
    assert r.status_code == 403


def test_admin_only_endpoints(api, project):
    assert api.c.get("/users/", headers=api.login("dev")).status_code == 403
