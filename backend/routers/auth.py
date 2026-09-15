from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.models import Pupil

router = APIRouter(prefix="/auth", tags=["Authentication"])

class PupilLoginRequest(BaseModel):
    surname: str
    regNo: str
    role: str = "pupil"  # 'pupil' or 'parent'

class AdminLoginRequest(BaseModel):
    username: str
    password: str

@router.post("/pupil-login")
async def pupil_login(request: PupilLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a pupil (or parent) using their Surname (username)
    and Registration Number (password) against the PostgreSQL/SQL database.
    """
    cleaned_surname = request.surname.strip()
    cleaned_reg_no = request.regNo.strip()

    if not cleaned_surname or not cleaned_reg_no:
        raise HTTPException(
            status_code=400,
            detail="Both Surname and Registration Number are required."
        )

    # Ultra-fast indexed SQL query with case-insensitive matching
    pupil = db.query(Pupil).filter(
        func.lower(Pupil.regNo) == cleaned_reg_no.lower(),
        func.lower(Pupil.surname) == cleaned_surname.lower()
    ).first()

    if not pupil:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please check spelling (e.g. Okon, Smith) and Registration Number (e.g. NS/2026/001)."
        )

    return {
        "status": "success",
        "role": request.role,
        "user": pupil.to_dict()
    }

@router.post("/admin-login")
async def admin_login(request: AdminLoginRequest):
    """
    Authenticates the School Registrar / Faculty Admin.
    """
    if request.username.strip() == "admin" and request.password == "Nazareth@2026ST":
        return {
            "status": "success",
            "role": "admin",
            "user": {
                "username": "admin",
                "displayName": "School Registrar",
                "role": "admin"
            }
        }
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Registrar credentials."
    )
