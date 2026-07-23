from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from backend.config import db
from backend.utils.auth_middleware import require_admin, require_student
from google.cloud import firestore
import uuid
import datetime

router = APIRouter(prefix="/store", tags=["School Store Ledger"])

class StoreItem(BaseModel):
    title: str
    author: str
    price: float
    classLevel: str
    category: str  # 'Textbook', 'Notebook', 'Stationery', 'Uniform', 'Utility'
    stock: int
    description: str

class CartItem(BaseModel):
    bookId: str
    title: str
    price: float
    quantity: int

class CheckoutRequest(BaseModel):
    pupilId: str
    pupilName: str
    pupilRegNo: str
    classLevel: str
    items: list[CartItem]
    paymentMethod: str  # 'desk' | 'bank'

class OrderStatusUpdate(BaseModel):
    status: str # 'Pending Approved', 'Processing', 'Ready for Pickup', 'Completed', 'Cancelled'

@router.get("/inventory")
async def get_inventory():
    """
    Fetch cataloged items available in the school store.
    """
    try:
        col_ref = db.collection("books") # Using 'books' collection to stay consistent with client Firestore calls
        docs = col_ref.stream()
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/inventory", status_code=status.HTTP_201_CREATED)
async def add_inventory(item: StoreItem, current_admin: dict = Depends(require_admin)):
    """
    Add a new item to the store catalog.
    """
    try:
        doc_id = "bk-" + str(int(datetime.datetime.now().timestamp() * 1000))
        doc_ref = db.collection("books").document(doc_id)
        
        item_data = item.model_dump()
        item_data["id"] = doc_id
        doc_ref.set(item_data)
        
        # Add system notification
        notif_id = "not-" + str(uuid.uuid4())
        db.collection("notifications").document(notif_id).set({
            "id": notif_id,
            "title": "New Stock Catalogued",
            "message": f"'{item.title}' is now available for {item.classLevel}.",
            "type": "info",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "read": False,
            "role": "admin"
        })
        
        return {"id": doc_id, "message": "Store item added successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/inventory/{item_id}")
async def update_inventory(item_id: str, item: StoreItem, current_admin: dict = Depends(require_admin)):
    """
    Update details/stock of an existing store item.
    """
    try:
        doc_ref = db.collection("books").document(item_id)
        if not doc_ref.get().exists:
            raise HTTPException(status_code=404, detail="Store item not found.")
            
        doc_ref.update(item.model_dump())
        return {"message": "Store item details updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/inventory/{item_id}")
async def delete_inventory(item_id: str, current_admin: dict = Depends(require_admin)):
    """
    Remove an item from the catalog.
    """
    try:
        doc_ref = db.collection("books").document(item_id)
        if not doc_ref.get().exists:
            raise HTTPException(status_code=404, detail="Store item not found.")
            
        doc_ref.delete()
        return {"message": "Store item removed from catalog."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/checkout")
async def checkout_cart(request: CheckoutRequest, current_user: dict = Depends(require_student)):
    """
    Places an order, decreases item stock, generates an invoice,
    and logs the transaction.
    """
    try:
        # 1. Verify stock and calculate total amount
        total_amount = 0.0
        batch = db.batch()
        
        for item in request.items:
            book_ref = db.collection("books").document(item.bookId)
            book_snap = book_ref.get()
            if not book_snap.exists:
                raise HTTPException(status_code=404, detail=f"Item {item.title} not found in inventory.")
            
            book_data = book_snap.to_dict() or {}
            current_stock = book_data.get("stock", 0)
            if current_stock < item.quantity:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Insufficient stock for '{item.title}'. Available: {current_stock}, Requested: {item.quantity}"
                )
            
            # Decrease stock
            batch.update(book_ref, {"stock": current_stock - item.quantity})
            total_amount += item.price * item.quantity

        # 2. Generate unique order ID and invoice number
        order_id = "ord-" + str(uuid.uuid4())
        invoice_no = "INV-" + datetime.datetime.now().strftime("%Y%m%d") + "-" + str(uuid.uuid4())[:4].upper()
        
        # 3. Create the order
        order_data = {
            "id": order_id,
            "pupilId": request.pupilId,
            "pupilName": request.pupilName,
            "pupilRegNo": request.pupilRegNo,
            "classLevel": request.classLevel,
            "items": [it.model_dump() for it in request.items],
            "totalAmount": total_amount,
            "status": "Pending Approved",
            "date": datetime.datetime.utcnow().isoformat() + "Z",
            "invoiceNo": invoice_no,
            "paymentMethod": request.paymentMethod
        }
        
        order_ref = db.collection("orders").document(order_id)
        batch.set(order_ref, order_data)
        
        # Commit inventory update and order creation
        batch.commit()
        
        # 4. Generate system-wide notification for admin
        notif_id = "not-" + str(uuid.uuid4())
        db.collection("notifications").document(notif_id).set({
            "id": notif_id,
            "title": "New Store Order",
            "message": f"Invoice [{invoice_no}] created for {request.pupilName}. Total: ₦{total_amount:.2f}.",
            "type": "info",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "read": False,
            "role": "admin"
        })
        
        return {"orderId": order_id, "invoiceNo": invoice_no, "totalAmount": total_amount}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/orders")
async def list_orders(current_admin: dict = Depends(require_admin)):
    """
    List all active and historical invoices in the ledger.
    """
    try:
        col_ref = db.collection("orders")
        docs = col_ref.stream()
        orders = [doc.to_dict() for doc in docs]
        # Sort by date descending
        orders.sort(key=lambda x: x.get("date", ""), reverse=True)
        return orders
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/orders/{order_id}")
async def update_order_status(order_id: str, update: OrderStatusUpdate, current_admin: dict = Depends(require_admin)):
    """
    Update order dispatch/approval status.
    """
    try:
        doc_ref = db.collection("orders").document(order_id)
        doc_snap = doc_ref.get()
        if not doc_snap.exists:
            raise HTTPException(status_code=404, detail="Order invoice record not found.")
            
        doc_ref.update({"status": update.status})
        order_data = doc_snap.to_dict() or {}
        
        # Notify pupil of status update
        notif_id = "not-" + str(uuid.uuid4())
        db.collection("notifications").document(notif_id).set({
            "id": notif_id,
            "title": f"Order Status: {update.status}",
            "message": f"Your order [{order_data.get('invoiceNo')}] status updated to '{update.status}'.",
            "type": "success" if update.status == "Completed" else "info",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "read": False,
            "role": "pupil",
            "recipientId": order_data.get("pupilRegNo")
        })
        
        return {"message": f"Order status updated successfully to '{update.status}'."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
