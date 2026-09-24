from datetime import date, timedelta
from tests.conftest import make_sprint, make_task


def _body(project, start, end):
    return {"name": "S", "project_id": project, "start_date": str(start), "end_date": str(end), "velocity": 20}


def test_end_before_start_rejected(api, project):  # regression: ISSUE-002
    t = date.today()
    r = api.c.post("/sprints/", json=_body(project, t, t - timedelta(days=1)), headers=api.login("admin"))
    assert r.status_code == 422


def test_same_day_sprint_allowed(api, project):
    t = date.today()
    assert api.c.post("/sprints/", json=_body(project, t, t), headers=api.login("admin")).status_code == 200


def test_patch_end_before_start_rejected(api, project):
    h = api.login("admin")
    sid = make_sprint(api, h, project)
    r = api.c.patch(f"/sprints/{sid}", json={"end_date": str(date.today() - timedelta(days=5))}, headers=h)
    assert r.status_code == 422


def test_sprint_auto_completes_when_all_done(api, project):
    h = api.login("admin")
    sid = make_sprint(api, h, project)
    tid = make_task(api, h, project)["id"]
    api.c.patch(f"/tasks/{tid}/sprint", json={"sprint_id": sid}, headers=h)
    api.c.patch(f"/sprints/{sid}", json={"status": "active"}, headers=h)
    assert api.c.patch(f"/tasks/{tid}/status", json={"status": "Done"}, headers=h).status_code == 200
    assert api.c.get(f"/sprints/{sid}", headers=h).json()["status"] == "completed"
