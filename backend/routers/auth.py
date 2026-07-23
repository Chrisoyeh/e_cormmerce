from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from firebase_admin import auth
from backend.config import db
from backend.utils.auth_middleware import require_admin

router = APIRouter(prefix="/auth", tags=["Authentication"])

class RegisterUserRequest(BaseModel):
    email: EmailStr
    password: str
    displayName: str
    role: str  # 'admin', 'student', 'parent'
    associatedId: str | None = None # pupil regNo or student ID if parent/student

class ClaimsRequest(BaseModel):
    uid: str
    role: str

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(request: RegisterUserRequest):
    """
    Registers a user in Firebase Auth, creates their corresponding profile
    in Firestore, and configures their custom role claims.
    """
    if request.role not in ["admin", "student", "parent"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'admin', 'student', or 'parent'.")

    try:
        # 1. Create user in Firebase Auth
        user = auth.create_user(
            email=request.email,
            password=request.password,
            display_name=request.displayName
        )
        
        # 2. Set custom user claims for role-based security
        auth.set_custom_user_claims(user.uid, {"role": request.role})
        
        # 3. Create document in Firestore based on role
        collection_name = "pupils" if request.role == "student" else f"{request.role}s" # admins, pupils, parents
        profile_data = {
            "uid": user.uid,
            "email": request.email,
            "displayName": request.displayName,
            "role": request.role,
            "createdAt": firestore_timestamp()
        }
        
        if request.associatedId:
            profile_data["associatedId"] = request.associatedId

        db.collection(collection_name).document(user.uid).set(profile_data)
        
        return {"uid": user.uid, "message": f"Successfully registered user as {request.role}."}
        
    except auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post("/set-claims")
async def set_claims(request: ClaimsRequest, current_admin: dict = Depends(require_admin)):
    """
    Admin-only endpoint to set or modify user custom claims.
    """
    try:
        auth.set_custom_user_claims(request.uid, {"role": request.role})
        # Sync with Firestore profile
        for col in ["admins", "pupils", "parents"]:
            doc_ref = db.collection(col).document(request.uid)
            if doc_ref.get().exists:
                doc_ref.update({"role": request.role})
                break
                
        return {"message": f"Custom claims updated successfully for user {request.uid}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def firestore_timestamp():
    from google.cloud import firestore
    # Return server-side timestamp representation
    return firestore.SERVER_TIMESTAMP
