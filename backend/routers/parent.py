from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Pupil, Order

router = APIRouter(prefix="/parent", tags=["Parent Portal"])

class LinkChildRequest(BaseModel):
    parentUid: str
    childRegNo: str

@router.post("/link")
async def link_child(request: LinkChildRequest, db: Session = Depends(get_db)):
    """
    Links a parent profile to a pupil using their unique Registration Number.
    """
    pupil = db.query(Pupil).filter(Pupil.regNo.ilike(request.childRegNo.strip())).first()
    if not pupil:
        raise HTTPException(status_code=404, detail="Child registration number not found.")

    pupil.linkedParentUid = request.parentUid
    db.commit()
    return {"message": f"Successfully linked {pupil.firstName} {pupil.surname} to parent.", "pupil": pupil.to_dict()}

@router.get("/children/{parent_uid}")
async def list_linked_children(parent_uid: str, db: Session = Depends(get_db)):
    """
    Returns all children profiles linked to this parent.
    """
    pupils = db.query(Pupil).filter(Pupil.linkedParentUid == parent_uid).all()
    return [p.to_dict() for p in pupils]

@router.get("/billing/{student_id}")
async def get_student_billing(student_id: str, db: Session = Depends(get_db)):
    """
    Fetches invoice order ledger for a student.
    """
    orders = db.query(Order).filter(
        (Order.pupilId == student_id) | (Order.pupilRegNo == student_id)
    ).order_by(Order.date.desc()).all()
    return [o.to_dict() for o in orders]
