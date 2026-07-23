from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import auth, students, parent, store, notifications

app = FastAPI(
    title="Nazareth School Store & Student Portal API",
    description="Enterprise-grade FastAPI backend integrated with Google Cloud Firestore and Firebase Auth.",
    version="4.0.0"
)

# CORS configuration to allow cross-origin requests from the web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production to match your specific hosting domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wire in all functional routers
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(parent.router)
app.include_router(store.router)
app.include_router(notifications.router)

@app.get("/")
async def root():
    return {
        "status": "healthy",
        "service": "Nazareth School Enterprise Portal Backend API",
        "version": "4.0.0"
    }

@app.get("/health")
async def health_check():
    return {"status": "ok"}
