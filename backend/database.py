import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from .env file explicitly
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
load_dotenv(dotenv_path=env_path)

# Database URL from environment (PostgreSQL in production/cloud, SQLite fallback for local development)
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Default to a local SQLite file database in the project directory
    DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "school_portal.db")
    DATABASE_URL = f"sqlite:///{DB_PATH}"

# For PostgreSQL connections on Render/Neon/Supabase, normalize prefix
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

# Connection pooling settings for Cloud PostgreSQL
engine_kwargs = {
    "connect_args": connect_args,
    "echo": False,
}

from sqlalchemy.pool import NullPool

if not DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update({
        "poolclass": NullPool,
    })

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """
    FastAPI dependency that provides a transactional database session per request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
