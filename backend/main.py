from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import json
import asyncio
import models
import schemas
import graph_engine
import os
import auth_service
from database import get_db
from ai_service import analyze_task_ai
from project_service import calculate_critical_path
from sprint_service import auto_assign_tasks, get_sprint_burndown, get_sprint_stats, check_sprint_deadlines
from notification_service import (
    log_activity, notify_task_assigned, notify_status_changed,
    get_unread_notifications, mark_notification_read, mark_all_read
)
from report_service import generate_sprint_pdf
from jose import JWTError, jwt
from celery_app import analyze_task_background
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AutoSprint API",
    description="Backend for the Autonomous Execution Intelligence System",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:3009")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login/form")


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth_service.SECRET_KEY, algorithms=[auth_service.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user

async def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to administrators only."
        )
    return current_user

async def require_developer_or_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in (models.UserRole.ADMIN, models.UserRole.DEVELOPER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to developers and administrators."
        )
    return current_user


@app.post("/auth/register", response_model=schemas.User)
def register_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = auth_service.get_password_hash(user.password)
    new_user = models.User(
        username=user.username,
        hashed_password=hashed_password,
        role=user.role or models.UserRole.DEVELOPER
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/auth/login", response_model=schemas.Token)
def login_json(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if not db_user or not auth_service.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = auth_service.create_access_token(data={"sub": db_user.username})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": db_user.role,
        "username": db_user.username
    }

@app.post("/auth/login/form", response_model=schemas.Token)
def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not db_user or not auth_service.verify_password(form_data.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = auth_service.create_access_token(data={"sub": db_user.username})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": db_user.role,
        "username": db_user.username
    }


@app.on_event("startup")
def create_initial_admin():
    from database import SessionLocal
    db = SessionLocal()
    try:
        db.query(models.User).filter(models.User.role == "admin").update({"role": "scrum_master"})
        db.query(models.User).filter(models.User.role == "viewer").update({"role": "stakeholder"})
        db.commit()

        admin = db.query(models.User).filter(models.User.username == "admin").first()
        if not admin:
            print("Creating initial admin user...")
            admin_password = os.getenv("ADMIN_PASSWORD")
            if not admin_password:
                print("⚠️ WARNING: ADMIN_PASSWORD environment variable is not set. Defaulting to unsafe password 'REDACTED_PASSWORD'.")
                admin_password = "REDACTED_PASSWORD"
            admin_user = models.User(
                username="admin",
                hashed_password=auth_service.get_password_hash(admin_password),
                role=models.UserRole.ADMIN
            )
            db.add(admin_user)
            db.commit()
    finally:
        db.close()

class HealthResponse(BaseModel):
    status: str
    message: str

@app.get("/", response_model=HealthResponse)
def health_check():
    return {"status": "success", "message": "AutoSprint backend is operational."}


def check_project_access(db: Session, user: models.User, project_id: int):
    if user.role == models.UserRole.ADMIN:
        return True
    access = db.query(models.ProjectAccess).filter(
        models.ProjectAccess.project_id == project_id,
        models.ProjectAccess.user_id == user.id
    ).first()
    if not access:
        raise HTTPException(status_code=403, detail="Not enough permissions for this project")
    return True

@app.post("/projects/", response_model=schemas.Project)
def create_project(
    project: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    db_project = models.Project(**project.model_dump(), created_by_id=admin.id)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@app.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")

    tasks = db.query(models.Task).filter(models.Task.project_id == project_id).all()
    task_ids = [t.id for t in tasks]
    if task_ids:
        db.query(models.TaskDependency).filter(
            (models.TaskDependency.task_id.in_(task_ids)) | 
            (models.TaskDependency.depends_on_id.in_(task_ids))
        ).delete(synchronize_session=False)

        db.query(models.ActivityLog).filter(
            models.ActivityLog.task_id.in_(task_ids)
        ).delete(synchronize_session=False)

    db.query(models.Task).filter(models.Task.project_id == project_id).delete(synchronize_session=False)

    db.query(models.Sprint).filter(models.Sprint.project_id == project_id).delete(synchronize_session=False)

    db.query(models.ProjectAccess).filter(models.ProjectAccess.project_id == project_id).delete(synchronize_session=False)

    db.delete(db_project)
    db.commit()

    return {"status": "success", "message": f"Project {project_id} deleted."}

@app.get("/projects/", response_model=List[schemas.Project])
def read_projects(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if user.role == models.UserRole.ADMIN:
        return db.query(models.Project).all()
    
    accesses = db.query(models.ProjectAccess).filter(models.ProjectAccess.user_id == user.id).all()
    project_ids = [a.project_id for a in accesses]
    return db.query(models.Project).filter(models.Project.id.in_(project_ids)).all()

@app.get("/users/", response_model=List[schemas.User])
def read_users(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    return db.query(models.User).all()

@app.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    """Delete a user and clean up project accesses and assignments."""
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
        
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    db.query(models.ProjectAccess).filter(models.ProjectAccess.user_id == user_id).delete()
    
    db.query(models.Notification).filter(models.Notification.user_id == user_id).delete()
    
    db.query(models.Task).filter(models.Task.assigned_to_id == user_id).update(
        {"assigned_to_id": None}, synchronize_session=False
    )

    db.delete(db_user)
    db.commit()
    return {"status": "success", "message": "User deleted successfully."}

@app.post("/projects/{project_id}/access")
def grant_project_access(
    project_id: int,
    access: schemas.ProjectAccessCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")

    existing = db.query(models.ProjectAccess).filter(
        models.ProjectAccess.project_id == project_id,
        models.ProjectAccess.user_id == access.user_id
    ).first()
    if existing:
        return {"status": "success", "message": "Access already granted"}

    db_access = models.ProjectAccess(project_id=project_id, user_id=access.user_id)
    db.add(db_access)
    db.commit()
    return {"status": "success", "message": "Access granted"}

@app.delete("/projects/{project_id}/access/{user_id}")
def revoke_project_access(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    access = db.query(models.ProjectAccess).filter(
        models.ProjectAccess.project_id == project_id,
        models.ProjectAccess.user_id == user_id
    ).first()
    if not access:
        raise HTTPException(status_code=404, detail="Access rule not found")
    db.delete(access)
    db.commit()
    return {"status": "success", "message": "Access revoked"}

@app.get("/projects/{project_id}/users")
def get_project_users(
    project_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    accesses = db.query(models.ProjectAccess).filter(models.ProjectAccess.project_id == project_id).all()
    user_ids = [a.user_id for a in accesses]
    users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()
    return [{"id": u.id, "username": u.username, "role": u.role} for u in users]


@app.post("/tasks/", response_model=schemas.Task)
async def create_task(
    task: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_developer_or_admin)
):
    check_project_access(db, current_user, task.project_id)

    if task.sprint_id is not None:
        sprint = db.query(models.Sprint).filter(
            models.Sprint.id == task.sprint_id,
            models.Sprint.project_id == task.project_id
        ).first()
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found in this project")

    if task.assigned_to_id is not None:
        if not db.query(models.User).filter(models.User.id == task.assigned_to_id).first():
            raise HTTPException(status_code=404, detail="Assigned user not found")

    task_data = task.model_dump()
    if not task_data.get("estimated_hours"):
        task_data["estimated_hours"] = 4
    # Placeholders until the background AI analysis overwrites them
    task_data["category"] = "General"
    task_data["priority"] = 3

    db_task = models.Task(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    log_activity(db, db_task.id, current_user.id, "created", f"Created task '{db_task.title}'")

    if db_task.assigned_to_id:
        notify_task_assigned(db, db_task, db_task.assigned_to_id, current_user.username)

    # Offload AI analysis to Celery worker asynchronously. The task is already
    # saved, so a broker outage must not turn into a 500 for the client.
    try:
        analyze_task_background.delay(db_task.id)
    except Exception as exc:
        logger.warning("Could not enqueue AI analysis for task %d: %s", db_task.id, exc)

    return db_task

@app.post("/tasks/batch-analyze", status_code=status.HTTP_202_ACCEPTED)
async def batch_analyze_tasks(
    task_ids: List[int],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_developer_or_admin)
):
    """Enqueues 500+ tasks for asynchronous background AI analysis, returning 202 Accepted immediately."""
    tasks = db.query(models.Task).filter(models.Task.id.in_(task_ids)).all()
    if not tasks:
        raise HTTPException(status_code=404, detail="No valid tasks found for batch analysis")

    for task in tasks:
        check_project_access(db, current_user, task.project_id)

    try:
        for task in tasks:
            analyze_task_background.delay(task.id)
    except Exception as exc:
        logger.error("Could not enqueue batch AI analysis: %s", exc)
        raise HTTPException(status_code=503, detail="Task queue unavailable, try again later")

    return {
        "status": "accepted",
        "message": f"Enqueued {len(tasks)} tasks for asynchronous AI background analysis.",
        "enqueued_task_ids": [t.id for t in tasks]
    }

@app.get("/tasks/", response_model=List[schemas.Task])
def read_tasks(
    project_id: int,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    check_project_access(db, user, project_id)
    return db.query(models.Task).filter(models.Task.project_id == project_id).offset(skip).limit(limit).all()

@app.delete("/tasks/{task_id}")
def delete_task(
    task_id: int, 
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(db, admin, db_task.project_id)
    db.query(models.TaskDependency).filter(
        (models.TaskDependency.task_id == task_id) | 
        (models.TaskDependency.depends_on_id == task_id)
    ).delete()
    db.query(models.ActivityLog).filter(models.ActivityLog.task_id == task_id).delete()
    sprint_id = db_task.sprint_id
    db.delete(db_task)
    db.commit()

    if sprint_id:
        sprint = db.query(models.Sprint).filter(models.Sprint.id == sprint_id).first()
        if sprint and sprint.status == "active":
            unfinished_count = db.query(models.Task).filter(
                models.Task.sprint_id == sprint.id,
                models.Task.status != "Done"
            ).count()
            if unfinished_count == 0:
                sprint.status = "completed"
                db.commit()

    return {"status": "success", "message": f"Task {task_id} deleted."}

@app.patch("/tasks/{task_id}/complete", response_model=schemas.Task)
def complete_task(
    task_id: int, 
    db: Session = Depends(get_db),
    user: models.User = Depends(require_developer_or_admin)
):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(db, user, db_task.project_id)
    unfinished = [t.title for t in db_task.dependencies if t.status != "Done"]
    if unfinished:
        raise HTTPException(
            status_code=400, 
            detail=f"Blocked! Prerequisite tasks not finished: {', '.join(unfinished)}"
        )
    
    old_status = db_task.status
    db_task.status = "Done"
    
    if db_task.sprint_id:
        sprint = db.query(models.Sprint).filter(models.Sprint.id == db_task.sprint_id).first()
        if sprint and sprint.status == "active":
            unfinished_count = db.query(models.Task).filter(
                models.Task.sprint_id == sprint.id,
                models.Task.status != "Done",
                models.Task.id != db_task.id
            ).count()
            if unfinished_count == 0:
                sprint.status = "completed"

    db.commit()
    db.refresh(db_task)

    log_activity(db, db_task.id, user.id, "status_changed", f"Status changed: {old_status} → Done")
    notify_status_changed(db, db_task, old_status, "Done", user.id)

    return db_task

@app.patch("/tasks/{task_id}/status", response_model=schemas.Task)
def update_task_status(
    task_id: int,
    status_update: schemas.TaskStatusUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_developer_or_admin)
):
    """Update task status (used by Kanban drag-and-drop)."""
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(db, user, db_task.project_id)

    valid_statuses = ["Todo", "In Progress", "Review", "Done"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    if status_update.status == "Done":
        unfinished = [t.title for t in db_task.dependencies if t.status != "Done"]
        if unfinished:
            raise HTTPException(
                status_code=400,
                detail=f"Blocked! Prerequisite tasks not finished: {', '.join(unfinished)}"
            )

    old_status = db_task.status
    db_task.status = status_update.status
    
    if status_update.status == "Done" and db_task.sprint_id:
        sprint = db.query(models.Sprint).filter(models.Sprint.id == db_task.sprint_id).first()
        if sprint and sprint.status == "active":
            unfinished_count = db.query(models.Task).filter(
                models.Task.sprint_id == sprint.id,
                models.Task.status != "Done",
                models.Task.id != db_task.id
            ).count()
            if unfinished_count == 0:
                sprint.status = "completed"

    db.commit()
    db.refresh(db_task)

    log_activity(db, db_task.id, user.id, "status_changed", f"Status changed: {old_status} → {status_update.status}")
    notify_status_changed(db, db_task, old_status, status_update.status, user.id)

    return db_task

@app.patch("/tasks/{task_id}/assign", response_model=schemas.Task)
def assign_task(
    task_id: int,
    assignment: schemas.TaskAssign,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_developer_or_admin)
):
    """Assign a task to one or more users."""
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(db, current_user, db_task.project_id)

    if assignment.user_ids is not None:
        # Many-to-many assignment
        users = db.query(models.User).filter(models.User.id.in_(assignment.user_ids)).all()
        db_task.assignees = users
        # Also sync single assigned_to_id for backward compatibility
        db_task.assigned_to_id = assignment.user_ids[0] if assignment.user_ids else None
    elif assignment.user_id is not None:
        assignee = db.query(models.User).filter(models.User.id == assignment.user_id).first()
        if not assignee:
            raise HTTPException(status_code=404, detail="User not found")
        db_task.assignees = [assignee]
        db_task.assigned_to_id = assignment.user_id
    else:
        db_task.assignees = []
        db_task.assigned_to_id = None

    db.commit()
    db.refresh(db_task)

    if db_task.assignees:
        assignee_names = ", ".join([u.username for u in db_task.assignees])
        log_activity(db, db_task.id, current_user.id, "assigned", f"Assigned to {assignee_names}")
        for assignee in db_task.assignees:
            notify_task_assigned(db, db_task, assignee.id, current_user.username)
    else:
        log_activity(db, db_task.id, current_user.id, "unassigned", "Task unassigned")

    return db_task

@app.patch("/tasks/{task_id}/sprint", response_model=schemas.Task)
def update_task_sprint(
    task_id: int,
    sprint_update: schemas.TaskSprintUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_developer_or_admin)
):
    """Assign or remove a task to/from a sprint manually."""
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(db, current_user, db_task.project_id)

    if sprint_update.sprint_id:
        sprint = db.query(models.Sprint).filter(models.Sprint.id == sprint_update.sprint_id).first()
        if not sprint:
            raise HTTPException(status_code=404, detail="Sprint not found")
        if sprint.project_id != db_task.project_id:
            raise HTTPException(status_code=400, detail="Sprint does not belong to this project")

    old_sprint_id = db_task.sprint_id
    db_task.sprint_id = sprint_update.sprint_id
    db.commit()
    db.refresh(db_task)

    if old_sprint_id:
        sprint = db.query(models.Sprint).filter(models.Sprint.id == old_sprint_id).first()
        if sprint and sprint.status == "active":
            unfinished_count = db.query(models.Task).filter(
                models.Task.sprint_id == sprint.id,
                models.Task.status != "Done"
            ).count()
            if unfinished_count == 0:
                sprint.status = "completed"
                db.commit()

    sprint_name = "Backlog"
    if db_task.sprint_id:
        sprint = db.query(models.Sprint).filter(models.Sprint.id == db_task.sprint_id).first()
        sprint_name = sprint.name if sprint else "Sprint"

    log_activity(db, db_task.id, current_user.id, "sprint_assigned", f"Moved to {sprint_name}")

    return db_task

@app.get("/tasks/{task_id}/activity", response_model=List[schemas.ActivityLogResponse])
def get_task_activity(
    task_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """Get activity log for a task."""
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(db, user, db_task.project_id)

    return db.query(models.ActivityLog).filter(
        models.ActivityLog.task_id == task_id
    ).order_by(models.ActivityLog.timestamp.desc()).all()


@app.get("/project/critical-path", response_model=List[schemas.Task])
def get_critical_path(
    project_id: int,
    sprint_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """Calculates the sequence of tasks determining the project duration using graph engine"""
    check_project_access(db, user, project_id)
    try:
        query = db.query(models.Task).filter(models.Task.project_id == project_id)
        if sprint_id:
            query = query.filter(models.Task.sprint_id == sprint_id)
        
        tasks = query.filter(models.Task.status != "Done").all()
        if not tasks:
            return []
        
        cp_data = graph_engine.calculate_critical_path(tasks)
        cp_ids = cp_data.get("critical_path_ids", [])
        
        task_map = {t.id: t for t in tasks}
        path = [task_map[tid] for tid in cp_ids if tid in task_map]
        return path
    except Exception as e:
        print(f"Graph Engine Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Error calculating project bottleneck.")

@app.get("/project/priorities", response_model=List[schemas.Task])
def get_prioritized_tasks(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """Returns tasks sorted by AI-generated risk priority"""
    check_project_access(db, user, project_id)
    try:
        return db.query(models.Task).filter(models.Task.project_id == project_id).order_by(models.Task.priority.desc()).all()
    except Exception as e:
        print(f"Priority Route Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Database sync error while fetching priorities.")

@app.post("/dependencies/", response_model=schemas.TaskDependency)
def create_dependency(
    dep: schemas.TaskDependencyCreate, 
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    """Establishes relationship links between tasks"""
    if dep.task_id == dep.depends_on_id:
        raise HTTPException(status_code=400, detail="A task cannot block itself.")
    
    task = db.query(models.Task).filter(models.Task.id == dep.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(db, admin, task.project_id)

    db_dep = models.TaskDependency(**dep.model_dump())
    db.add(db_dep)
    db.commit()
    db.refresh(db_dep)
    return db_dep


@app.post("/sprints/", response_model=schemas.Sprint)
def create_sprint(
    sprint: schemas.SprintCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    check_project_access(db, admin, sprint.project_id)
    db_sprint = models.Sprint(**sprint.model_dump())
    db.add(db_sprint)
    db.commit()
    db.refresh(db_sprint)
    return db_sprint

@app.get("/sprints/")
def list_sprints(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    check_project_access(db, user, project_id)
    sprints = db.query(models.Sprint).filter(models.Sprint.project_id == project_id).all()
    return [get_sprint_stats(db, s) for s in sprints]

@app.get("/sprints/{sprint_id}")
def get_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    sprint = db.query(models.Sprint).filter(models.Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    check_project_access(db, user, sprint.project_id)
    return get_sprint_stats(db, sprint)

@app.patch("/sprints/{sprint_id}")
def update_sprint(
    sprint_id: int,
    update: schemas.SprintUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    sprint = db.query(models.Sprint).filter(models.Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    check_project_access(db, admin, sprint.project_id)

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(sprint, field, value)
    
    db.commit()
    db.refresh(sprint)
    return get_sprint_stats(db, sprint)

@app.delete("/sprints/{sprint_id}")
def delete_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    sprint = db.query(models.Sprint).filter(models.Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    check_project_access(db, admin, sprint.project_id)

    if sprint.status == "active":
        raise HTTPException(
            status_code=400,
            detail="Cannot delete an active sprint. Please pause or complete the sprint first."
        )

    db.query(models.Task).filter(models.Task.sprint_id == sprint_id).update(
        {"sprint_id": None}, synchronize_session=False
    )
    db.delete(sprint)
    db.commit()
    return {"status": "success", "message": f"Sprint {sprint_id} deleted."}

@app.post("/sprints/{sprint_id}/auto-assign")
def auto_assign_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    sprint = db.query(models.Sprint).filter(models.Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    check_project_access(db, admin, sprint.project_id)
    return auto_assign_tasks(db, sprint_id)

@app.get("/sprints/{sprint_id}/tasks", response_model=List[schemas.Task])
def get_sprint_tasks(
    sprint_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    sprint = db.query(models.Sprint).filter(models.Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    check_project_access(db, user, sprint.project_id)
    return db.query(models.Task).filter(models.Task.sprint_id == sprint_id).all()

@app.get("/sprints/{sprint_id}/burndown")
def get_burndown(
    sprint_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    sprint = db.query(models.Sprint).filter(models.Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    check_project_access(db, user, sprint.project_id)
    return get_sprint_burndown(db, sprint_id)


@app.get("/notifications/stream")
async def notification_stream(
    token: str,
    db: Session = Depends(get_db)
):
    """Server-Sent Events endpoint for real-time notifications."""
    try:
        payload = jwt.decode(token, auth_service.SECRET_KEY, algorithms=[auth_service.ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    async def event_generator():
        last_id = 0
        while True:
            from database import SessionLocal
            check_db = SessionLocal()
            try:
                notifications = check_db.query(models.Notification).filter(
                    models.Notification.user_id == user.id,
                    models.Notification.id > last_id,
                    models.Notification.is_read == False
                ).order_by(models.Notification.id.asc()).all()

                for notif in notifications:
                    data = json.dumps({
                        "id": notif.id,
                        "type": notif.type,
                        "message": notif.message,
                        "created_at": notif.created_at.isoformat() if notif.created_at else None
                    })
                    yield f"data: {data}\n\n"
                    last_id = notif.id
            finally:
                check_db.close()

            await asyncio.sleep(3)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

@app.get("/notifications/", response_model=List[schemas.NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    return get_unread_notifications(db, user.id)

@app.patch("/notifications/{notification_id}/read")
def read_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    success = mark_notification_read(db, notification_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "success"}

@app.patch("/notifications/read-all")
def read_all_notifications(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    count = mark_all_read(db, user.id)
    return {"status": "success", "count": count}


@app.get("/reports/sprint/{sprint_id}/export")
def export_sprint_report(
    sprint_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """Generate and download a PDF sprint report."""
    sprint = db.query(models.Sprint).filter(models.Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    check_project_access(db, user, sprint.project_id)

    try:
        pdf_buffer = generate_sprint_pdf(db, sprint_id)
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=sprint_{sprint_id}_report.pdf"}
        )
    except Exception as e:
        print(f"Report generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report.")
