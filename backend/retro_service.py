from sqlalchemy.orm import Session
from models import Retrospective, RetroItem, Task, User
from notification_service import create_notification
import logging

logger = logging.getLogger(__name__)

CATEGORIES = ("went_well", "to_improve", "action_item")


def create_retrospective(db: Session, sprint, user_id: int, title: str = None) -> Retrospective:
    """Open a Sprint Retrospective for a sprint. One retro per sprint."""
    existing = db.query(Retrospective).filter(Retrospective.sprint_id == sprint.id).first()
    if existing:
        raise ValueError(f"A retrospective already exists for sprint '{sprint.name}'")

    retro = Retrospective(
        sprint_id=sprint.id,
        title=title or f"Retrospective — {sprint.name}",
        status="open",
        created_by_id=user_id
    )
    db.add(retro)
    db.commit()
    db.refresh(retro)

    assignee_ids = set()
    tasks = db.query(Task).filter(Task.sprint_id == sprint.id).all()
    for t in tasks:
        if t.assigned_to_id:
            assignee_ids.add(t.assigned_to_id)
        for a in t.assignees:
            assignee_ids.add(a.id)

    for uid in assignee_ids:
        if uid != user_id:
            create_notification(
                db, uid, "retrospective",
                f"Sprint retrospective '{retro.title}' is open — share your feedback."
            )

    return retro


def get_retrospective(db: Session, sprint_id: int):
    return db.query(Retrospective).filter(Retrospective.sprint_id == sprint_id).first()


def get_retrospective_detail(db: Session, retro: Retrospective) -> dict:
    """Return the retro with its items grouped by category plus summary stats."""
    grouped = {"went_well": [], "to_improve": [], "action_item": []}
    for item in retro.items:
        grouped.setdefault(item.category, []).append(item)

    action_items = grouped.get("action_item", [])
    stats = {
        "went_well": len(grouped.get("went_well", [])),
        "to_improve": len(grouped.get("to_improve", [])),
        "action_items": len(action_items),
        "action_items_done": sum(1 for i in action_items if i.is_done),
        "total_votes": sum(i.votes for i in retro.items),
    }

    return {
        "id": retro.id,
        "sprint_id": retro.sprint_id,
        "title": retro.title,
        "summary": retro.summary,
        "status": retro.status,
        "created_by_id": retro.created_by_id,
        "created_at": retro.created_at,
        "updated_at": retro.updated_at,
        "items_grouped": {
            k: [
                {
                    "id": i.id,
                    "category": i.category,
                    "content": i.content,
                    "priority": i.priority,
                    "is_done": i.is_done,
                    "votes": i.votes,
                    "owner_id": i.owner_id,
                    "owner": {"id": i.owner.id, "username": i.owner.username, "role": i.owner.role}
                    if i.owner else None,
                    "created_by_id": i.created_by_id,
                    "created_by": {"id": i.created_by.id, "username": i.created_by.username}
                    if i.created_by else None,
                    "created_at": i.created_at,
                }
                for i in grouped.get(k, [])
            ]
            for k in CATEGORIES
        },
        "stats": stats,
    }


def update_retrospective(db: Session, retro: Retrospective, changes: dict) -> Retrospective:
    if "status" in changes and changes["status"] not in ("open", "closed"):
        raise ValueError("status must be one of: open, closed")
    for field, value in changes.items():
        setattr(retro, field, value)
    db.commit()
    db.refresh(retro)
    return retro


def delete_retrospective(db: Session, retro: Retrospective) -> None:
    db.delete(retro)
    db.commit()


VALID_CATEGORIES = CATEGORIES


def add_retro_item(db: Session, retro: Retrospective, category: str, content: str,
                   created_by_id: int, owner_id: int = None, priority: int = 1) -> RetroItem:
    if category not in VALID_CATEGORIES:
        raise ValueError(f"category must be one of: {', '.join(VALID_CATEGORIES)}")
    if not content or not content.strip():
        raise ValueError("content must not be empty")
    if owner_id is not None and not db.query(User).filter(User.id == owner_id).first():
        raise ValueError("owner user not found")

    item = RetroItem(
        retrospective_id=retro.id,
        category=category,
        content=content.strip(),
        owner_id=owner_id,
        priority=max(1, min(priority, 5)),
        created_by_id=created_by_id
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_retro_item(db: Session, item: RetroItem, changes: dict) -> RetroItem:
    if "category" in changes and changes["category"] not in VALID_CATEGORIES:
        raise ValueError(f"category must be one of: {', '.join(VALID_CATEGORIES)}")
    if "content" in changes and (not changes["content"] or not str(changes["content"]).strip()):
        raise ValueError("content must not be empty")
    if "priority" in changes:
        changes["priority"] = max(1, min(changes["priority"], 5))
    if "owner_id" in changes and changes["owner_id"] is not None:
        if not db.query(User).filter(User.id == changes["owner_id"]).first():
            raise ValueError("owner user not found")

    for field, value in changes.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


def delete_retro_item(db: Session, item: RetroItem) -> None:
    db.delete(item)
    db.commit()


def vote_retro_item(db: Session, item: RetroItem) -> RetroItem:
    item.votes = (item.votes or 0) + 1
    db.commit()
    db.refresh(item)
    return item