import datetime
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import AppNotification

router = APIRouter(prefix="/notifications", tags=["Notifications"])

class NotificationCreate(BaseModel):
    id: str | None = None
    title: str
    message: str
    type: str = "info"
    role: str = "all"
    recipientId: str | None = "all"
    link: str | None = None

@router.get("")
def list_notifications(
    role: str | None = None,
    recipientId: str | None = None,
    db: Session = Depends(get_db)
):
    """
    Get notifications filtered by role and recipient ID.
    """
    query = db.query(AppNotification)
    if role and role != "all":
        query = query.filter((AppNotification.role == role) | (AppNotification.role == "all"))
    if recipientId and recipientId != "all":
        query = query.filter((AppNotification.recipientId == recipientId) | (AppNotification.recipientId == "all"))

    notifs = query.order_by(AppNotification.timestamp.desc()).all()
    return [n.to_dict() for n in notifs]

@router.post("", status_code=status.HTTP_201_CREATED)
def dispatch_notification(notification: NotificationCreate, db: Session = Depends(get_db)):
    """
    Dispatch a system or administrative notification.
    """
    notif_id = notification.id or f"not-{int(datetime.datetime.now().timestamp() * 1000)}"
    new_notif = AppNotification(
        id=notif_id,
        title=notification.title,
        message=notification.message,
        type=notification.type,
        timestamp=datetime.datetime.utcnow().isoformat() + "Z",
        read=False,
        role=notification.role,
        recipientId=notification.recipientId or "all",
        link=notification.link
    )
    db.add(new_notif)
    db.commit()
    db.refresh(new_notif)
    return new_notif.to_dict()

@router.put("/{notif_id}/read")
def mark_as_read(notif_id: str, db: Session = Depends(get_db)):
    """
    Mark a notification as read.
    """
    notif = db.query(AppNotification).filter(AppNotification.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.read = True
    db.commit()
    return {"message": "Marked as read."}
