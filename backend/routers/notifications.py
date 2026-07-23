from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from backend.config import db
from backend.utils.auth_middleware import require_student
import datetime
import uuid

router = APIRouter(prefix="/notifications", tags=["Notification Center"])

class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str  # 'info' | 'success' | 'warning'
    role: str  # 'admin' | 'pupil' | 'parent'
    recipientId: str | None = "all"  # 'all' or registration number

@router.get("/")
async def list_notifications(role: str, recipientId: str | None = None, current_user: dict = Depends(require_student)):
    """
    Get notifications for a user based on their role and ID.
    """
    try:
        col_ref = db.collection("notifications")
        query = col_ref.where("role", "==", role)
        
        docs = query.stream()
        notifications = [doc.to_dict() for doc in docs]
        
        # Filter in python for recipientId
        filtered = []
        for notif in notifications:
            rec_id = notif.get("recipientId", "all")
            if rec_id == "all" or rec_id == recipientId:
                filtered.append(notif)
                
        # Sort by timestamp descending
        filtered.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return filtered
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", status_code=status.HTTP_201_CREATED)
async def dispatch_notification(notification: NotificationCreate, current_user: dict = Depends(require_student)):
    """
    Dispatch a notification to the system.
    """
    try:
        doc_id = "not-" + str(uuid.uuid4())
        doc_ref = db.collection("notifications").document(doc_id)
        
        notif_data = notification.model_dump()
        notif_data["id"] = doc_id
        notif_data["read"] = False
        notif_data["timestamp"] = datetime.datetime.utcnow().isoformat() + "Z"
        
        doc_ref.set(notif_data)
        return {"id": doc_id, "message": "Notification dispatched successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{notif_id}/read")
async def mark_as_read(notif_id: str, current_user: dict = Depends(require_student)):
    """
    Mark a notification as read.
    """
    try:
        doc_ref = db.collection("notifications").document(notif_id)
        if not doc_ref.get().exists:
            raise HTTPException(status_code=404, detail="Notification not found.")
            
        doc_ref.update({"read": True})
        return {"message": "Notification marked as read."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
