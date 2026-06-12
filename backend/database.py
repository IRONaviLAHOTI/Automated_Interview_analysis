"""
database.py — PostgreSQL Connection and Session Management
==========================================================
Python 3.11 compatible. Uses standard synchronous SQLAlchemy 2.x.

PURPOSE : Sets up the SQLAlchemy engine, session factory, and Base.
          All other modules import get_db and Base from here.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = os.getenv("DB_PORT", "5432")
DB_NAME     = os.getenv("DB_NAME", "interviewlens")
DB_USER     = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

DATABASE_URL = (
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# pool_pre_ping=True — validates connection before use, handles stale connections
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# SQLAlchemy 2.x style — DeclarativeBase replaces declarative_base()
class Base(DeclarativeBase):
    pass


def get_db():
    """
    FastAPI dependency — yields a DB session per request, closes after.
    Usage: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
