import os
import time
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import OperationalError


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


SQLALCHEMY_DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5},
)

def wait_for_db(engine, retries=10, interval=3):
    if "alembic" in sys.argv[0]:
        return
    print("⏳ Connecting to PostgreSQL...")
    while retries > 0:
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
                print("✅ Database connection established!")
                return
        except OperationalError as e:
            retries -= 1
            print(f"⚠️ Database not ready ({retries} retries left). Waiting {interval}s...")
            time.sleep(interval)
    
    raise Exception("❌ Could not connect to the database. Check docker-compose logs.")
wait_for_db(engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()