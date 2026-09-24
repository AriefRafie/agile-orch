from celery import Celery
import os
import asyncio
import logging
from datetime import datetime
from database import SessionLocal
import models
from ai_service import analyze_task_ai

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "autosprint_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)


@celery_app.task(name="tasks.analyze_task_background", bind=True, max_retries=3)
def analyze_task_background(self, task_id: int):
    """Celery background task to analyze task details via AI and update PostgreSQL DB."""
    logger.info("Starting background AI analysis for Task ID: %d", task_id)
    db = SessionLocal()
    try:
        task = db.query(models.Task).filter(models.Task.id == task_id).first()
        if not task:
            logger.error("Task ID %d not found for background analysis.", task_id)
            return {"status": "failed", "reason": "Task not found"}

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        ai_suggestions = loop.run_until_complete(analyze_task_ai(task.title, task.description or ""))
        loop.close()

        task.category = ai_suggestions.get("category", task.category or "General")
        task.priority = ai_suggestions.get("priority", task.priority or 1)
        task.estimated_hours = ai_suggestions.get("estimated_hours", task.estimated_hours or 4)
        task.confidence_score = ai_suggestions.get("confidence_score")
        task.risk_flags = ai_suggestions.get("risk_flags")
        task.ai_rationale = ai_suggestions.get("rationale", "")
        task.suggested_subtasks = ai_suggestions.get("suggested_subtasks")
        task.ai_provider = ai_suggestions.get("ai_provider")
        task.ai_model = ai_suggestions.get("ai_model")
        task.ai_is_fallback = bool(ai_suggestions.get("ai_is_fallback", False))
        task.ai_needs_review = bool(ai_suggestions.get("ai_needs_review", False))
        task.ai_analyzed_at = datetime.utcnow()

        db.commit()
        logger.info("Successfully updated Task ID %d with AI analysis.", task_id)
        return {"status": "success", "task_id": task_id}
    except Exception as exc:
        db.rollback()
        logger.error("Error analyzing task ID %d: %s", task_id, exc)
        raise self.retry(exc=exc, countdown=10)
    finally:
        db.close()
