from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, Date, DateTime, Text, Table
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base

class UserRole(str, enum.Enum):
    ADMIN = "scrum_master"
    DEVELOPER = "developer"
    VIEWER = "stakeholder"

# Association table for task assignees (many-to-many)
task_assignees = Table(
    "task_assignees",
    Base.metadata,
    Column("task_id", Integer, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
)

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"))

    tasks = relationship("Task", back_populates="project")
    accesses = relationship("ProjectAccess", back_populates="project")
    sprints = relationship("Sprint", back_populates="project", cascade="all, delete-orphan")

class ProjectAccess(Base):
    __tablename__ = "project_access"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    project = relationship("Project", back_populates="accesses")
    user = relationship("User")

class Sprint(Base):
    __tablename__ = "sprints"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    velocity = Column(Integer, nullable=False, default=40)
    status = Column(String, default="planning")

    project = relationship("Project", back_populates="sprints")
    tasks = relationship("Task", back_populates="sprint")
    retrospectives = relationship("Retrospective", back_populates="sprint")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    estimated_hours = Column(Integer, default=1)
    status = Column(String, default="Todo")
    is_ready = Column(Boolean, default=True)
    category = Column(String, nullable=True, default="General")
    priority = Column(Integer, default=1)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    confidence_score = Column(Float, nullable=True, default=None)
    risk_flags = Column(Text, nullable=True, default=None)
    ai_rationale = Column(Text, nullable=True, default=None)
    suggested_subtasks = Column(Text, nullable=True, default=None)
    ai_provider = Column(String, nullable=True, default=None)
    ai_model = Column(String, nullable=True, default=None)
    ai_is_fallback = Column(Boolean, nullable=False, default=False, server_default="false")
    ai_needs_review = Column(Boolean, nullable=False, default=False, server_default="false")
    ai_analyzed_at = Column(DateTime, nullable=True, default=None)

    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id"), nullable=True)

    project = relationship("Project", back_populates="tasks")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    assignees = relationship("User", secondary=task_assignees, back_populates="tasks")
    sprint = relationship("Sprint", back_populates="tasks")
    activity_logs = relationship("ActivityLog", back_populates="task", cascade="all, delete-orphan")

    dependencies = relationship(
        "Task",
        secondary="task_dependencies",
        primaryjoin="Task.id==TaskDependency.task_id",
        secondaryjoin="Task.id==TaskDependency.depends_on_id",
        backref="blocked_tasks"
    )

    @property
    def prerequisites(self):
        return self.dependencies

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default=UserRole.DEVELOPER)

    tasks = relationship("Task", secondary=task_assignees, back_populates="assignees")


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    depends_on_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)

class ActivityLog(Base):
    __tablename__ = "activity_log"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)
    detail = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="activity_logs")
    user = relationship("User")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class Retrospective(Base):
    """Sprint Retrospective — the final Scrum ceremony of a sprint.

    The team reflects on the sprint and captures feedback as items in three
    categories: what went well, what needs improvement, and concrete action
    items the team commits to. One retrospective per sprint."""
    __tablename__ = "retrospectives"
    id = Column(Integer, primary_key=True, index=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id"), nullable=False, unique=True)
    title = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    status = Column(String, default="open")
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sprint = relationship("Sprint")
    created_by = relationship("User")
    items = relationship(
        "RetroItem",
        back_populates="retrospective",
        cascade="all, delete-orphan",
        order_by="RetroItem.created_at.asc()"
    )


class RetroItem(Base):
    """A single reflection entry in a Sprint Retrospective."""
    __tablename__ = "retro_items"
    id = Column(Integer, primary_key=True, index=True)
    retrospective_id = Column(Integer, ForeignKey("retrospectives.id"), nullable=False)
    category = Column(String, nullable=False)  # went_well | to_improve | action_item
    content = Column(Text, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    priority = Column(Integer, default=1)
    is_done = Column(Boolean, default=False)
    votes = Column(Integer, default=0)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    retrospective = relationship("Retrospective", back_populates="items")
    owner = relationship("User", foreign_keys=[owner_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
