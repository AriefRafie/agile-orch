import os
import database
from tests.conftest import BACKEND_DIR, TEST_DB


def test_uvicorn_reload_has_graceful_timeout():  # regression: ISSUE-003
    with open(os.path.join(BACKEND_DIR, "Dockerfile")) as f:
        assert "--timeout-graceful-shutdown" in f.read()


def test_engine_points_at_test_database():
    """Guards the truncate-the-wrong-database footgun: conftest asserts this at import
    time (collection fails loudly) before any test can call _truncate_all()."""
    assert database.engine.url.database == TEST_DB == "autosprint_test"
