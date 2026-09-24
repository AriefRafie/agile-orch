import json
import ai_service


def res(**kw):
    base = {"category": "Backend", "priority": 3, "confidence_score": 0.9,
            "risk_flags": "[]", "ai_is_fallback": False}
    base.update(kw)
    return base


def test_keyword_scores_use_word_boundaries():
    s = ai_service.keyword_scores("build the auth token flow")
    assert s["Security"] == 2          # auth, token
    assert s["Frontend"] == 0          # "ui" inside "build" must not count


def test_clear_task_keeps_confidence():
    conf, review = ai_service.adjust_confidence(res(category="Security", risk_flags='["security"]', priority=5),
                                                "Fix SQL injection in login endpoint", "raw SQL string")
    assert conf == 0.9 and review is False


def test_fallback_capped_and_flagged():
    conf, review = ai_service.adjust_confidence(res(ai_is_fallback=True, confidence_score=0.3), "x", "")
    assert conf <= 0.3 and review is True


def test_vague_title_capped_at_half_and_flagged():
    conf, review = ai_service.adjust_confidence(res(confidence_score=0.7), "Refactor stuff", "")
    assert conf == 0.5 and review is True


def test_category_contradicting_strong_keywords_flagged():
    conf, review = ai_service.adjust_confidence(res(category="Frontend", confidence_score=0.9),
                                                "Add auth token refresh", "rotate jwt")
    assert conf == round(0.9 * 0.6, 2) and review is True


def test_p5_without_risk_on_docs_task_flagged():
    conf, review = ai_service.adjust_confidence(res(category="Documentation", priority=5, confidence_score=0.9),
                                                "Update README guide", "markdown docs")
    assert review is True and conf < 0.9


def test_low_final_confidence_flagged():
    conf, review = ai_service.adjust_confidence(res(confidence_score=0.55), "Implement sprint export endpoint", "csv")
    assert review is True


async def test_analyze_applies_adjustment(monkeypatch):
    async def fake(system, user):
        return json.dumps({"category": "Backend", "priority": 3, "estimated_hours": 4, "confidence_score": 0.7,
                           "risk_flags": [], "suggested_subtasks": ["a", "b"], "rationale": "r"})
    monkeypatch.setattr(ai_service, "AI_PROVIDER", "ollama")
    monkeypatch.setitem(ai_service.PROVIDERS, "ollama", fake)
    r = await ai_service.analyze_task_ai("Refactor stuff", "")
    assert r["confidence_score"] == 0.5 and r["ai_needs_review"] is True
