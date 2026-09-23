import json
import httpx
import respx
import ai_service


@respx.mock
def test_status_reports_ollama_model_and_reachability(api, users, monkeypatch, tmp_path):
    monkeypatch.setattr(ai_service, "AI_PROVIDER", "ollama")
    monkeypatch.setattr(ai_service, "OLLAMA_URL", "http://ollama.test/api/generate")
    monkeypatch.setitem(ai_service.MODEL_BY_PROVIDER, "ollama", "qwen3:14b")
    monkeypatch.setattr(ai_service, "EVAL_RESULTS_DIR", str(tmp_path))
    respx.get("http://ollama.test/api/tags").mock(
        return_value=httpx.Response(200, json={"models": [{"name": "qwen3:14b"}]}))
    (tmp_path / "ollama__qwen3_14b.json").write_text(json.dumps({"passed": True, "summary": "ok"}))
    r = api.c.get("/ai/status", headers=api.login("admin"))
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "ollama" and body["model"] == "qwen3:14b"
    assert body["reachable"] is True
    assert body["evaluation"] == {"passed": True, "summary": "ok"}


@respx.mock
def test_status_unreachable_when_model_missing(api, users, monkeypatch, tmp_path):
    monkeypatch.setattr(ai_service, "AI_PROVIDER", "ollama")
    monkeypatch.setattr(ai_service, "OLLAMA_URL", "http://ollama.test/api/generate")
    monkeypatch.setitem(ai_service.MODEL_BY_PROVIDER, "ollama", "qwen3:32b")
    monkeypatch.setattr(ai_service, "EVAL_RESULTS_DIR", str(tmp_path))
    respx.get("http://ollama.test/api/tags").mock(
        return_value=httpx.Response(200, json={"models": [{"name": "llama3.1:8b"}]}))
    body = api.c.get("/ai/status", headers=api.login("admin")).json()
    assert body["reachable"] is False and body["evaluation"] is None


def test_status_openai_without_key_unreachable(api, users, monkeypatch, tmp_path):
    monkeypatch.setattr(ai_service, "AI_PROVIDER", "openai")
    monkeypatch.setattr(ai_service, "OPENAI_API_KEY", "")
    monkeypatch.setattr(ai_service, "EVAL_RESULTS_DIR", str(tmp_path))
    assert api.c.get("/ai/status", headers=api.login("admin")).json()["reachable"] is False


def test_status_is_admin_only(api, users):
    assert api.c.get("/ai/status", headers=api.login("dev")).status_code == 403
