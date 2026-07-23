from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from backend.config import db
from backend.utils.auth_middleware import require_parent, require_admin

router = APIRouter(prefix="/parent", tags=["Parent Management"])

class LinkChildRequest(BaseModel):
    parentUid: str
    childRegNo: str

@router.post("/link")
async def link_child(request: LinkChildRequest, current_admin: dict = Depends(require_admin)):
    """
    Links a parent profile to a student using their Registration Number.
    Creates or updates the association array in Firestore.
    """
    try:
        # 1. Verify child exists
        student_docs = db.collection("pupils").where("regNo", "==", request.childRegNo).limit(1).stream()
        students = [d.to_dict() for d in student_docs]
        if not students:
            raise HTTPException(status_code=404, detail="Child registration number not found.")
        
        student = students[0]
        
        # 2. Update Parent Document
        parent_ref = db.collection("parents").document(request.parentUid)
        parent_doc = parent_ref.get()
        
        if not parent_doc.exists:
            # Create a basic parent profile if not exists
            parent_ref.set({
                "uid": request.parentUid,
                "linkedChildren": [student["id"]],
                "displayName": f"Parent of {student['firstName']}"
            })
        else:
            parent_data = parent_doc.to_dict() or {}
            linked = parent_data.get("linkedChildren", [])
            if student["id"] not in linked:
                linked.append(student["id"])
                parent_ref.update({"linkedChildren": linked})
                
        # 3. Update Student document with parent link details
        student_ref = db.collection("pupils").document(student["id"])
        student_ref.update({
            "parentName": parent_doc.to_dict().get("displayName") if parent_doc.exists else f"Parent of {student['firstName']}",
            "linkedParentUid": request.parentUid
        })
        
        return {"message": "Child successfully linked to parent profile."}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/children/{parent_uid}")
async def list_children(parent_uid: str, current_user: dict = Depends(require_parent)):
    """
    Returns lists of all children linked to this parent profile.
    """
    try:
        parent_ref = db.collection("parents").document(parent_uid)
        parent_doc = parent_ref.get()
        if not parent_doc.exists:
            raise HTTPException(status_code=404, detail="Parent profile not found.")
            
        parent_data = parent_doc.to_dict() or {}
        linked_ids = parent_data.get("linkedChildren", [])
        
        children = []
        for std_id in linked_ids:
            std_doc = db.collection("pupils").document(std_id).get()
            if std_doc.exists:
                children.append(std_doc.to_dict())
                
        return children
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/billing/{student_id}")
async def get_student_billing(student_id: str, current_user: dict = Depends(require_parent)):
    """
    Fetches invoices, transaction ledgers and fees outstanding for a child.
    """
    try:
        # Search orders in Firestore for this child
        orders_ref = db.collection("orders").where("pupilId", "==", student_id).stream()
        orders = [doc.to_dict() for doc in orders_ref]
        return orders
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
