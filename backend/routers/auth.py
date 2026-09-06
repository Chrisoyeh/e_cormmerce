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

class PupilLoginRequest(BaseModel):
    surname: str
    regNo: str
    role: str = "pupil"  # 'pupil' or 'parent'

@router.post("/pupil-login")
async def pupil_login(request: PupilLoginRequest):
    """
    Authenticates a pupil (or parent) using their Surname (as username)
    and Registration Number (as password) against the pupils Firestore collection.
    """
    cleaned_surname = request.surname.strip().lower()
    cleaned_reg_no = request.regNo.strip()

    if not cleaned_surname or not cleaned_reg_no:
        raise HTTPException(
            status_code=400,
            detail="Both Surname and Registration Number are required."
        )

    try:
        # Search the pupils collection by registration number
        pupils_ref = db.collection("pupils")
        query_stream = pupils_ref.where("regNo", "==", cleaned_reg_no).stream()
        
        matched_pupil = None
        for doc in query_stream:
            data = doc.to_dict()
            data["id"] = doc.id
            if data.get("surname", "").strip().lower() == cleaned_surname:
                matched_pupil = data
                break

        # Fallback: check case-insensitive regNo matching
        if not matched_pupil:
            all_docs = pupils_ref.stream()
            for doc in all_docs:
                data = doc.to_dict()
                data["id"] = doc.id
                if (
                    data.get("regNo", "").strip().lower() == cleaned_reg_no.lower()
                    and data.get("surname", "").strip().lower() == cleaned_surname
                ):
                    matched_pupil = data
                    break

        if not matched_pupil:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials. Check spelling (e.g. Okon, Adamu, Smith) and Registration Number format (e.g. NS/2026/001)."
            )

        return {
            "status": "success",
            "role": request.role,
            "user": matched_pupil
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication check failed: {str(e)}")

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
