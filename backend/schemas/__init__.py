from pydantic import BaseModel, ConfigDict, model_validator
from typing import Optional, List
from datetime import date, datetime

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int
    created_by_id: int

    class Config:
        from_attributes = True

class ProjectAccessCreate(BaseModel):
    user_id: int
    project_id: int

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    estimated_hours: int = 1
    status: str = "Todo"
    is_ready: bool = True
    category: Optional[str] = "General"
    priority: int = 1
    project_id: int

class TaskCreate(TaskBase):
    assigned_to_id: Optional[int] = None
    sprint_id: Optional[int] = None

class TaskStatusUpdate(BaseModel):
    status: str

class TaskAssign(BaseModel):
    user_id: Optional[int] = None
    user_ids: Optional[List[int]] = None

class TaskSprintUpdate(BaseModel):
    sprint_id: Optional[int] = None

class Task(TaskBase):
    id: int
    dependencies: List['Task'] = []
    confidence_score: Optional[float] = None
    risk_flags: Optional[str] = None
    ai_rationale: Optional[str] = None
    suggested_subtasks: Optional[str] = None
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    ai_is_fallback: bool = False
    ai_needs_review: bool = False
    ai_analyzed_at: Optional[datetime] = None
    assigned_to_id: Optional[int] = None
    sprint_id: Optional[int] = None
    assignees: List['User'] = []

    class Config:
        from_attributes = True

class TaskDependencyBase(BaseModel):
    task_id: int
    depends_on_id: int

class TaskDependencyCreate(TaskDependencyBase):
    pass

class TaskDependency(TaskDependencyBase):
    id: int

    class Config:
        from_attributes = True

class SprintBase(BaseModel):
    name: str
    project_id: int
    start_date: date
    end_date: date
    velocity: int = 40

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self

class SprintCreate(SprintBase):
    pass

class SprintUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    velocity: Optional[int] = None
    status: Optional[str] = None

class Sprint(SprintBase):
    id: int
    status: str = "planning"

    class Config:
        from_attributes = True

class SprintDetail(Sprint):
    task_count: int = 0
    hours_used: int = 0
    hours_remaining: int = 0
    completion_pct: float = 0.0

class ActivityLogResponse(BaseModel):
    id: int
    task_id: int
    user_id: int
    action: str
    detail: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str
    role: Optional[str] = "developer"

class User(UserBase):
    id: int
    role: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    id: int

class TokenData(BaseModel):
    username: Optional[str] = None

class BurndownPoint(BaseModel):
    date: str
    ideal: float
    actual: float


class RetrospectiveCreate(BaseModel):
    title: Optional[str] = None


class RetrospectiveUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    status: Optional[str] = None


class RetroItemCreate(BaseModel):
    category: str
    content: str
    owner_id: Optional[int] = None
    priority: int = 1


class RetroItemUpdate(BaseModel):
    content: Optional[str] = None
    category: Optional[str] = None
    owner_id: Optional[int] = None
    priority: Optional[int] = None
    is_done: Optional[bool] = None


class RetroItemBase(BaseModel):
    id: int
    retrospective_id: int
    category: str
    content: str
    priority: int = 1
    is_done: bool = False
    votes: int = 0
    created_by_id: int
    created_at: datetime


class RetroItem(RetroItemBase):
    owner_id: Optional[int] = None
    owner: Optional['User'] = None
    created_by: Optional['User'] = None

    class Config:
        from_attributes = True


class RetrospectiveBase(BaseModel):
    id: int
    sprint_id: int
    title: Optional[str] = None
    summary: Optional[str] = None
    status: str = "open"
    created_by_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class Retrospective(RetrospectiveBase):
    items: List[RetroItem] = []

    class Config:
        from_attributes = True


class RetrospectiveDetail(Retrospective):
    items_grouped: dict = {}
    stats: dict = {}
