import time
from jose import jwt
import auth_service


def test_login_returns_identity(api, users):
    r = api.c.post("/auth/login", json={"username": "dev", "password": "pw-dev"})
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == users["dev"]  # regression: ISSUE-005
    assert body["role"] == "developer"
    assert body["username"] == "dev"


def test_token_lifetime_is_24h(api, users):
    token = api.c.post("/auth/login", json={"username": "dev", "password": "pw-dev"}).json()["access_token"]
    exp = jwt.decode(token, auth_service.SECRET_KEY, algorithms=[auth_service.ALGORITHM])["exp"]
    assert abs((exp - time.time()) - 24 * 3600) < 120


def test_wrong_password_401(api, users):
    r = api.c.post("/auth/login", json={"username": "dev", "password": "nope"})
    assert r.status_code == 401


def test_register_requires_admin(api, users):
    body = {"username": "new", "password": "x12345678", "role": "developer"}
    assert api.c.post("/auth/register", json=body).status_code == 401
    assert api.c.post("/auth/register", json=body, headers=api.login("dev")).status_code == 403
    r = api.c.post("/auth/register", json=body, headers=api.login("admin"))  # regression: ISSUE-001
    assert r.status_code == 200 and r.json()["username"] == "new"
