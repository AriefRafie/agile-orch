from tests.conftest import make_sprint, make_task


def _open_retro(api, project, admin_h):
    sid = make_sprint(api, admin_h, project)
    r = api.c.post(f"/sprints/{sid}/retrospective", json={"title": "Retro 1"}, headers=admin_h)
    assert r.status_code == 200, r.text
    return sid, r.json()


def test_only_scrum_master_can_open_retro(api, users, project):
    dev_h = api.login("dev")
    h = api.login("admin")
    sid = make_sprint(api, h, project)
    r = api.c.post(f"/sprints/{sid}/retrospective", json={}, headers=dev_h)
    assert r.status_code == 403


def test_one_retro_per_sprint(api, project):
    h = api.login("admin")
    sid, _ = _open_retro(api, project, h)
    r = api.c.post(f"/sprints/{sid}/retrospective", json={}, headers=h)
    assert r.status_code == 409


def test_get_retro_requires_existing(api, project):
    h = api.login("admin")
    sid = make_sprint(api, h, project)
    assert api.c.get(f"/sprints/{sid}/retrospective", headers=h).status_code == 404


def test_retro_detail_groups_items(api, project):
    h = api.login("admin")
    sid, retro = _open_retro(api, project, h)
    rid = retro["id"]

    api.c.post(f"/retrospectives/{rid}/items",
               json={"category": "went_well", "content": "Solid API design"}, headers=h)
    api.c.post(f"/retrospectives/{rid}/items",
               json={"category": "to_improve", "content": "Slow reviews"}, headers=h)
    api.c.post(f"/retrospectives/{rid}/items",
               json={"category": "action_item", "content": "Add more tests", "priority": 2}, headers=h)

    detail = api.c.get(f"/sprints/{sid}/retrospective", headers=h).json()
    assert detail["stats"]["went_well"] == 1
    assert detail["stats"]["to_improve"] == 1
    assert detail["stats"]["action_items"] == 1
    assert detail["items_grouped"]["went_well"][0]["content"] == "Solid API design"
    assert detail["items_grouped"]["action_item"][0]["priority"] == 2


def test_invalid_category_rejected(api, project):
    h = api.login("admin")
    _, retro = _open_retro(api, project, h)
    r = api.c.post(f"/retrospectives/{retro['id']}/items",
                   json={"category": "nope", "content": "x"}, headers=h)
    assert r.status_code == 400


def test_empty_content_rejected(api, project):
    h = api.login("admin")
    _, retro = _open_retro(api, project, h)
    r = api.c.post(f"/retrospectives/{retro['id']}/items",
                   json={"category": "went_well", "content": "  "}, headers=h)
    assert r.status_code == 400


def test_vote_increments(api, project):
    h = api.login("admin")
    dev_h = api.login("dev")
    _, retro = _open_retro(api, project, h)
    rid = retro["id"]
    item = api.c.post(f"/retrospectives/{rid}/items",
                      json={"category": "went_well", "content": "Great team"}, headers=h).json()

    voted = api.c.post(f"/retrospectives/{rid}/items/{item['id']}/vote", headers=dev_h)
    assert voted.status_code == 200
    assert voted.json()["votes"] == 1


def test_close_retro_blocks_new_items(api, project):
    h = api.login("admin")
    sid, retro = _open_retro(api, project, h)
    rid = retro["id"]

    closed = api.c.patch(f"/retrospectives/{rid}", json={"status": "closed", "summary": "Good sprint"}, headers=h)
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"

    r = api.c.post(f"/retrospectives/{rid}/items",
                   json={"category": "went_well", "content": "late"}, headers=h)
    assert r.status_code == 400

    assert api.c.get(f"/sprints/{sid}/retrospective", headers=h).json()["summary"] == "Good sprint"


def test_developer_can_add_item(api, users, project):
    admin_h = api.login("admin")
    dev_h = api.login("dev")
    _, retro = _open_retro(api, project, admin_h)
    rid = retro["id"]

    r = api.c.post(f"/retrospectives/{rid}/items",
                   json={"category": "to_improve", "content": "Better docs", "owner_id": users["dev"]},
                   headers=dev_h)
    assert r.status_code == 200
    assert r.json()["owner_id"] == users["dev"]


def test_action_item_can_be_marked_done(api, project):
    h = api.login("admin")
    _, retro = _open_retro(api, project, h)
    rid = retro["id"]
    item = api.c.post(f"/retrospectives/{rid}/items",
                      json={"category": "action_item", "content": "Deploy pipeline"}, headers=h).json()

    updated = api.c.patch(f"/retrospectives/{rid}/items/{item['id']}",
                          json={"is_done": True}, headers=h)
    assert updated.status_code == 200
    assert updated.json()["is_done"] is True


def test_non_author_cannot_delete_item(api, users, project):
    admin_h = api.login("admin")
    dev_h = api.login("dev")
    _, retro = _open_retro(api, project, admin_h)
    rid = retro["id"]
    item = api.c.post(f"/retrospectives/{rid}/items",
                      json={"category": "went_well", "content": "mine"}, headers=admin_h).json()

    r = api.c.delete(f"/retrospectives/{rid}/items/{item['id']}", headers=dev_h)
    assert r.status_code == 403

    assert api.c.delete(f"/retrospectives/{rid}/items/{item['id']}", headers=admin_h).status_code == 200


def test_delete_retro(api, project):
    h = api.login("admin")
    sid, retro = _open_retro(api, project, h)
    assert api.c.delete(f"/retrospectives/{retro['id']}", headers=h).status_code == 200
    assert api.c.get(f"/sprints/{sid}/retrospective", headers=h).status_code == 404