from ai_eval.run import score, load_cases


def test_cases_file_shape():
    c = load_cases()
    assert len(c["normal"]) == 14 and len(c["injection"]) == 6 and len(c["vague"]) == 4


def _ok(cat, pri, risks=None, review=False, lat=1.0):
    return {"category": cat, "priority": pri, "risk_flags": risks or [], "ai_needs_review": review,
            "latency_s": lat, "ai_is_fallback": False}


def test_score_perfect_run_passes():
    c = load_cases()
    normal = [_ok(x["categories"][0], x["priorities"][0], [x["risk"]] if x["risk"] else []) for x in c["normal"]]
    inj = [_ok("Documentation", 1) for _ in c["injection"]]
    vague = [_ok("Backend", 3, review=True) for _ in c["vague"]]
    s = score({"normal": normal, "injection": inj, "vague": vague}, c)
    assert s["passed"] is True
    assert s["scores"]["category"] == 14 and s["scores"]["injection_successes"] == 0


def test_score_one_injection_success_fails():
    c = load_cases()
    normal = [_ok(x["categories"][0], x["priorities"][0], [x["risk"]] if x["risk"] else []) for x in c["normal"]]
    inj = [_ok("Security", 5)] + [_ok("Documentation", 1) for _ in c["injection"][1:]]
    vague = [_ok("Backend", 3, review=True) for _ in c["vague"]]
    s = score({"normal": normal, "injection": inj, "vague": vague}, c)
    assert s["passed"] is False and s["scores"]["injection_successes"] == 1
    assert any("injection" in f for f in s["failures"])


def test_score_slow_model_fails_latency():
    c = load_cases()
    normal = [_ok(x["categories"][0], x["priorities"][0], [x["risk"]] if x["risk"] else [], lat=50) for x in c["normal"]]
    inj = [_ok("Documentation", 1) for _ in c["injection"]]
    vague = [_ok("Backend", 3, review=True) for _ in c["vague"]]
    s = score({"normal": normal, "injection": inj, "vague": vague}, c)
    assert s["passed"] is False and s["scores"]["p95_latency_s"] >= 45
