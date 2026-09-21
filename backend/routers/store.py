import datetime
import uuid
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from backend.database import get_db
from backend.models import BookItem, Order, AppNotification
from backend.utils.firestore_sync import async_firestore_upsert, async_firestore_delete

router = APIRouter(prefix="/store", tags=["School Store & Orders"])

class StoreItemCreate(BaseModel):
    id: str | None = None
    title: str
    author: str | None = "Nazareth Press"
    price: float
    classLevel: str
    category: str
    stock: int = 0
    imageUrl: str | None = None
    description: str | None = ""
    shoeSize: str | None = None
    uniformSize: str | None = None

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
    paymentMethod: str  # 'online' | 'bank' | 'desk'

class OrderStatusUpdate(BaseModel):
    status: str | None = None
    amountPaid: float | None = None
    paymentVerificationStatus: str | None = None
    paymentReceiptUrl: str | None = None
    balanceReceiptUrl: str | None = None
    submittedToLedger: bool | None = None

@router.get("/inventory")
def get_inventory(db: Session = Depends(get_db)):
    """
    Get all catalog items in the school store.
    """
    books = db.query(BookItem).all()
    return [b.to_dict() for b in books]

@router.post("/inventory", status_code=status.HTTP_201_CREATED)
def add_inventory(item: StoreItemCreate, db: Session = Depends(get_db)):
    """
    Add a new item to store catalog.
    """
    item_id = item.id or f"bk-{int(datetime.datetime.now().timestamp() * 1000)}"
    new_book = BookItem(
        id=item_id,
        title=item.title.strip(),
        author=item.author or "Nazareth Press",
        price=item.price,
        classLevel=item.classLevel.strip(),
        category=item.category.strip(),
        stock=item.stock,
        imageUrl=item.imageUrl,
        description=item.description or "",
        shoeSize=item.shoeSize,
        uniformSize=item.uniformSize
    )
    db.add(new_book)
    db.commit()
    db.refresh(new_book)
    book_dict = new_book.to_dict()
    async_firestore_upsert("books", new_book.id, book_dict)
    return book_dict

@router.put("/inventory/{item_id}")
def update_inventory(item_id: str, item: StoreItemCreate, db: Session = Depends(get_db)):
    """
    Update item details or stock count.
    """
    book = db.query(BookItem).filter(BookItem.id == item_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Item not found.")

    book.title = item.title.strip()
    book.author = item.author or "Nazareth Press"
    book.price = item.price
    book.classLevel = item.classLevel.strip()
    book.category = item.category.strip()
    book.stock = item.stock
    book.imageUrl = item.imageUrl
    book.description = item.description or ""
    book.shoeSize = item.shoeSize
    book.uniformSize = item.uniformSize

    db.commit()
    db.refresh(book)
    book_dict = book.to_dict()
    async_firestore_upsert("books", book.id, book_dict)
    return book_dict

@router.delete("/inventory/{item_id}")
def delete_inventory(item_id: str, db: Session = Depends(get_db)):
    """
    Delete an item from inventory.
    """
    book = db.query(BookItem).filter(BookItem.id == item_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Item not found.")
    b_id = book.id
    db.delete(book)
    db.commit()
    async_firestore_delete("books", b_id)
    return {"message": "Item deleted."}

@router.post("/checkout")
def checkout(request: CheckoutRequest, db: Session = Depends(get_db)):
    """
    Places an order, decrements stock atomically in SQL, and generates invoice.
    """
    try:
        total_amount = 0.0
        order_items_json = []

        for item in request.items:
            book = db.query(BookItem).filter(BookItem.id == item.bookId).with_for_update().first()
            if not book:
                raise HTTPException(status_code=404, detail=f"Book '{item.title}' not found.")
            if book.stock < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for '{item.title}'. Available: {book.stock}, requested: {item.quantity}."
                )
            book.stock -= item.quantity
            total_amount += item.price * item.quantity
            order_items_json.append(item.model_dump())
            # Mirror updated book stock
            async_firestore_upsert("books", book.id, book.to_dict())

        order_id = f"ord-{int(datetime.datetime.now().timestamp() * 1000)}"
        invoice_no = f"INV-{datetime.datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"

        new_order = Order(
            id=order_id,
            pupilId=request.pupilId,
            pupilName=request.pupilName,
            pupilRegNo=request.pupilRegNo,
            classLevel=request.classLevel,
            items=order_items_json,
            totalAmount=total_amount,
            amountPaid=total_amount if request.paymentMethod == "online" else None,
            status="Completed" if request.paymentMethod == "online" else "Pending Verification",
            date=datetime.datetime.utcnow().isoformat() + "Z",
            invoiceNo=invoice_no,
            paymentMethod=request.paymentMethod,
            paymentVerificationStatus="Verified" if request.paymentMethod == "online" else "Pending Audit",
            submittedToLedger=True if request.paymentMethod == "online" else False
        )
        db.add(new_order)

        # Notify admin of new order
        notif = AppNotification(
            id=f"not-{int(datetime.datetime.now().timestamp() * 1000)}",
            title="New Store Order",
            message=f"Invoice [{invoice_no}] created for {request.pupilName}. Total: ₦{total_amount:,.2f}.",
            type="info",
            timestamp=datetime.datetime.utcnow().isoformat() + "Z",
            read=False,
            role="admin"
        )
        db.add(notif)
        db.commit()
        db.refresh(new_order)
        invalidate_orders_cache()
        order_dict = new_order.to_dict()
        async_firestore_upsert("orders", new_order.id, order_dict)
        async_firestore_upsert("notifications", notif.id, notif.to_dict())
        return order_dict
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# In-memory orders cache
_orders_cache = {"data": None, "timestamp": 0}

def invalidate_orders_cache():
    _orders_cache["data"] = None
    _orders_cache["timestamp"] = 0

@router.get("/orders")
def list_orders(pupilId: str | None = None, pupilRegNo: str | None = None, limit: int = 5000, db: Session = Depends(get_db)):
    """
    Get lightweight list of order invoices.
    Optimized column selection and memory caching prevent memory exhaustion and long wait times.
    """
    identifiers = []
    if pupilId and pupilId.strip():
        identifiers.append(pupilId.strip().lower())
    if pupilRegNo and pupilRegNo.strip():
        identifiers.append(pupilRegNo.strip().lower())

    if identifiers:
        filters = []
        for ident in identifiers:
            filters.append(func.lower(Order.pupilId) == ident)
            filters.append(func.lower(Order.pupilRegNo) == ident)
        orders = db.query(Order).filter(or_(*filters)).order_by(Order.date.desc()).limit(limit).all()
        return [o.to_dict() for o in orders]

    now = datetime.datetime.now().timestamp()
    if _orders_cache["data"] is not None and (now - _orders_cache["timestamp"] < 60):
        return _orders_cache["data"]

    has_receipt = and_(Order.paymentReceiptUrl.isnot(None), Order.paymentReceiptUrl != "", Order.paymentReceiptUrl != "receipt-uploaded")
    has_bal_receipt = and_(Order.balanceReceiptUrl.isnot(None), Order.balanceReceiptUrl != "", Order.balanceReceiptUrl != "receipt-uploaded")

    rows = db.query(
        Order.id,
        Order.pupilId,
        Order.pupilName,
        Order.pupilRegNo,
        Order.classLevel,
        Order.items,
        Order.totalAmount,
        Order.amountPaid,
        Order.status,
        Order.date,
        Order.invoiceNo,
        Order.paymentMethod,
        Order.paymentVerificationStatus,
        Order.submittedToLedger,
        Order.notes,
        has_receipt.label("has_payment_receipt"),
        has_bal_receipt.label("has_balance_receipt")
    ).order_by(Order.date.desc()).limit(limit).all()

    result = []
    for r in rows:
        result.append({
            "id": r.id,
            "pupilId": r.pupilId,
            "pupilName": r.pupilName,
            "pupilRegNo": r.pupilRegNo,
            "classLevel": r.classLevel,
            "items": r.items or [],
            "totalAmount": r.totalAmount,
            "amountPaid": r.amountPaid,
            "status": r.status,
            "date": r.date,
            "invoiceNo": r.invoiceNo,
            "paymentMethod": r.paymentMethod,
            "paymentReceiptUrl": "receipt-uploaded" if r.has_payment_receipt else None,
            "balanceReceiptUrl": "receipt-uploaded" if r.has_balance_receipt else None,
            "paymentVerificationStatus": r.paymentVerificationStatus,
            "submittedToLedger": r.submittedToLedger,
            "notes": r.notes
        })
    _orders_cache["data"] = result
    _orders_cache["timestamp"] = now
    return result

@router.delete("/orders/{order_id}")
def delete_single_order(order_id: str, db: Session = Depends(get_db)):
    """
    Permanently delete an order invoice by ID or Invoice Number.
    """
    clean = order_id.strip()
    matching = db.query(Order).filter(
        or_(
            Order.id == clean,
            Order.invoiceNo == clean,
            func.lower(Order.id) == clean.lower(),
            func.lower(Order.invoiceNo) == clean.lower()
        )
    ).all()
    if not matching:
        async_firestore_delete("orders", clean)
        invalidate_orders_cache()
        return {"deleted": 0, "status": "not_found"}
    
    count = len(matching)
    for o in matching:
        async_firestore_delete("orders", o.id)
        if o.invoiceNo:
            async_firestore_delete("orders", o.invoiceNo)
        db.delete(o)
    db.commit()
    invalidate_orders_cache()
    return {"deleted": count, "status": "deleted"}

@router.post("/orders/bulk-delete")
def delete_orders_bulk(payload: dict, db: Session = Depends(get_db)):
    """
    Permanently delete multiple order invoices in a single batch.
    """
    order_ids = payload.get("orderIds", [])
    if not order_ids:
        return {"deleted": 0}
    clean_ids = [str(i).strip() for i in order_ids if str(i).strip()]
    clean_ids_lower = [i.lower() for i in clean_ids]
    matching = db.query(Order).filter(
        or_(
            Order.id.in_(clean_ids),
            Order.invoiceNo.in_(clean_ids),
            func.lower(Order.id).in_(clean_ids_lower),
            func.lower(Order.invoiceNo).in_(clean_ids_lower)
        )
    ).all()
    count = len(matching)
    for o in matching:
        async_firestore_delete("orders", o.id)
        if o.invoiceNo:
            async_firestore_delete("orders", o.invoiceNo)
        db.delete(o)
    # Also attempt cleanup for any direct Firestore IDs
    for cid in clean_ids:
        async_firestore_delete("orders", cid)
    db.commit()
    invalidate_orders_cache()
    return {"deleted": count}

@router.get("/orders/{order_id}")
def get_single_order(order_id: str, db: Session = Depends(get_db)):
    """
    Get single order invoice with full receipt and audit logs.
    """
    clean = order_id.strip()
    order = db.query(Order).filter(
        (Order.id == clean) |
        (Order.invoiceNo == clean) |
        (func.lower(Order.id) == clean.lower()) |
        (func.lower(Order.invoiceNo) == clean.lower())
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    return order.to_dict()

@router.put("/orders/{order_id}")
def update_order(order_id: str, payload: OrderStatusUpdate, db: Session = Depends(get_db)):
    """
    Update order status, receipts, or financial audit details.
    """
    clean = order_id.strip()
    order = db.query(Order).filter(
        (Order.id == clean) |
        (Order.invoiceNo == clean) |
        (func.lower(Order.id) == clean.lower()) |
        (func.lower(Order.invoiceNo) == clean.lower())
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if payload.status is not None:
        order.status = payload.status
    if payload.amountPaid is not None:
        order.amountPaid = payload.amountPaid
    if payload.paymentVerificationStatus is not None:
        order.paymentVerificationStatus = payload.paymentVerificationStatus
    if payload.paymentReceiptUrl is not None and payload.paymentReceiptUrl != "receipt-uploaded":
        order.paymentReceiptUrl = payload.paymentReceiptUrl
    if payload.balanceReceiptUrl is not None and payload.balanceReceiptUrl != "receipt-uploaded":
        order.balanceReceiptUrl = payload.balanceReceiptUrl
    if payload.submittedToLedger is not None:
        order.submittedToLedger = payload.submittedToLedger

    db.commit()
    db.refresh(order)
    invalidate_orders_cache()
    order_dict = order.to_dict()
    async_firestore_upsert("orders", order.id, order_dict)
    return order_dict

@router.post("/orders", status_code=status.HTTP_201_CREATED)
def sync_order(order_data: dict, db: Session = Depends(get_db)):
    """
    Sync or create an order record directly into the central SQL ledger.
    """
    order_id = order_data.get("id") or f"ord-{int(datetime.datetime.now().timestamp() * 1000)}"
    existing = db.query(Order).filter(Order.id == order_id).first()
    if existing:
        for k, v in order_data.items():
            if hasattr(existing, k) and k != "id" and v is not None:
                if k in ("paymentReceiptUrl", "balanceReceiptUrl") and v == "receipt-uploaded":
                    continue
                setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        invalidate_orders_cache()
        existing_dict = existing.to_dict()
        async_firestore_upsert("orders", existing.id, existing_dict)
        return existing_dict

    new_order = Order(
        id=order_id,
        pupilId=order_data.get("pupilId", ""),
        pupilName=order_data.get("pupilName", ""),
        pupilRegNo=order_data.get("pupilRegNo", ""),
        classLevel=order_data.get("classLevel", ""),
        items=order_data.get("items", []),
        totalAmount=float(order_data.get("totalAmount", 0.0)),
        amountPaid=float(order_data.get("amountPaid")) if order_data.get("amountPaid") is not None else None,
        status=order_data.get("status", "Pending Approved"),
        date=order_data.get("date") or (datetime.datetime.utcnow().isoformat() + "Z"),
        invoiceNo=order_data.get("invoiceNo") or f"INV-{datetime.datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}",
        paymentMethod=order_data.get("paymentMethod", "desk"),
        paymentReceiptUrl=order_data.get("paymentReceiptUrl"),
        balanceReceiptUrl=order_data.get("balanceReceiptUrl"),
        paymentVerificationStatus=order_data.get("paymentVerificationStatus", "Pending Audit"),
        submittedToLedger=bool(order_data.get("submittedToLedger", True)),
        notes=order_data.get("notes")
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    invalidate_orders_cache()
    new_order_dict = new_order.to_dict()
    async_firestore_upsert("orders", new_order.id, new_order_dict)
    return new_order_dict

@router.delete("/orders/{order_id}")
def delete_order(order_id: str, db: Session = Depends(get_db)):
    """
    Permanently delete an order invoice from the central SQL ledger and Firestore.
    """
    clean = order_id.strip()
    matching = db.query(Order).filter(
        (Order.id == clean) |
        (Order.invoiceNo == clean) |
        (func.lower(Order.id) == clean.lower()) |
        (func.lower(Order.invoiceNo) == clean.lower())
    ).all()
    if not matching:
        async_firestore_delete("orders", clean)
        return {"message": "Order not found in SQL ledger; dispatched Firestore deletion."}
    for o in matching:
        async_firestore_delete("orders", o.id)
        if o.invoiceNo:
            async_firestore_delete("orders", o.invoiceNo)
        db.delete(o)
    db.commit()
    invalidate_orders_cache()
    return {"message": f"Deleted {len(matching)} order record(s)."}


