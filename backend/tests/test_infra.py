import os
from tests.conftest import BACKEND_DIR


def test_uvicorn_reload_has_graceful_timeout():  # regression: ISSUE-003
    with open(os.path.join(BACKEND_DIR, "Dockerfile")) as f:
        assert "--timeout-graceful-shutdown" in f.read()
