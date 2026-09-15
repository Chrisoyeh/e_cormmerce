from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, Base, SessionLocal
from backend.models import Pupil, BookItem, Order, AppNotification, ContactSubmission, AttendanceRecord
from backend.seed_data import seed_database_if_empty
from backend.routers import auth, students, parent, store, notifications, contacts

# Initialize all database tables
Base.metadata.create_all(bind=engine)

# Seed initial database if empty
db_session = SessionLocal()
try:
    seed_database_if_empty(db_session)
finally:
    db_session.close()

app = FastAPI(
    title="Nazareth School Store & Student Portal API",
    description="High-performance FastAPI backend powered by PostgreSQL with automatic local SQLite fallback.",
    version="5.0.0"
)

# CORS configuration to allow requests from any frontend port/domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
