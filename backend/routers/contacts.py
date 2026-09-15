import datetime
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import ContactSubmission, AppNotification

router = APIRouter(prefix="/contacts", tags=["Contact Inquiries"])

class ContactCreate(BaseModel):
    name: str
    email: str
    phone: str | None = ""
    message: str

class ContactStatusUpdate(BaseModel):
    status: str  # 'Pending' | 'Read' | 'Resolved'

@router.get("")
def list_contacts(db: Session = Depends(get_db)):
    """
    List all contact form inquiries submitted from landing page.
    """
    contacts = db.query(ContactSubmission).order_by(ContactSubmission.timestamp.desc()).all()
    return [c.to_dict() for c in contacts]

@router.post("", status_code=status.HTTP_201_CREATED)
def submit_contact(payload: ContactCreate, db: Session = Depends(get_db)):
    """
    Submit a public contact form message from the landing page.
    """
    contact_id = f"cnt-{int(datetime.datetime.now().timestamp() * 1000)}"
    new_contact = ContactSubmission(
        id=contact_id,
        name=payload.name.strip(),
        email=payload.email.strip(),
        phone=payload.phone.strip() if payload.phone else "",
        message=payload.message.strip(),
        timestamp=datetime.datetime.utcnow().isoformat() + "Z",
        status="Pending"
    )
    db.add(new_contact)

    # Add admin notification
    notif = AppNotification(
        id=f"not-cnt-{int(datetime.datetime.now().timestamp() * 1000)}",
        title="New Contact Message",
        message=f"Inquiry received from {payload.name} ({payload.email}).",
        type="info",
        timestamp=datetime.datetime.utcnow().isoformat() + "Z",
        read=False,
        role="admin"
    )
    db.add(notif)
    db.commit()
    db.refresh(new_contact)
    return new_contact.to_dict()

@router.put("/{contact_id}/status")
def update_contact_status(contact_id: str, payload: ContactStatusUpdate, db: Session = Depends(get_db)):
    """
    Update contact message status.
    """
    contact = db.query(ContactSubmission).filter(ContactSubmission.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact message not found.")

    contact.status = payload.status
    db.commit()
    db.refresh(contact)
    return contact.to_dict()
