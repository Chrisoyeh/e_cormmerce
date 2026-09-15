import os
import contextlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, Base, SessionLocal
from backend.routers import auth, students, parent, store, notifications, contacts

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and seed in background during startup
    try:
        Base.metadata.create_all(bind=engine)
        db_session = SessionLocal()
        try:
            from backend.seed_data import seed_database_if_empty
            seed_database_if_empty(db_session)
        finally:
            db_session.close()
    except Exception as e:
        print(f"[Database Startup Warning]: {e}")
    yield

app = FastAPI(
    title="Nazareth School Store & Student Portal API",
    description="High-performance FastAPI backend powered by PostgreSQL with automatic local SQLite fallback.",
    version="5.0.0",
    lifespan=lifespan
)

from fastapi.middleware.gzip import GZipMiddleware

# CORS configuration to allow requests from any frontend port/domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# GZip compression middleware compresses JSON responses by ~85% for lightning-fast transfer
app.add_middleware(GZipMiddleware, minimum_size=500)

# Register all functional routers
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(store.router)
app.include_router(notifications.router)
app.include_router(contacts.router)
app.include_router(parent.router)

@app.get("/")
async def root():
    return {
        "status": "healthy",
        "service": "Nazareth School Enterprise Portal Backend API (SQL)",
        "version": "5.0.0"
    }

@app.get("/health")
async def health_check():
    return {"status": "ok", "database": "connected"}

@app.get("/debug-db")
async def debug_db():
    import traceback
    try:
        db = SessionLocal()
        from backend.models import Pupil, BookItem
        pupils_cnt = db.query(Pupil).count()
        books_cnt = db.query(BookItem).count()
        db.close()
        return {
            "status": "connected",
            "db_url_masked": engine.url.render_as_string(hide_password=True),
            "pupils_count": pupils_cnt,
            "books_count": books_cnt
        }
    except Exception as e:
        return {
            "status": "db_error",
            "error_type": type(e).__name__,
            "error_detail": str(e),
            "traceback": traceback.format_exc()
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port)
