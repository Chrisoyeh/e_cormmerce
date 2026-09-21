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

# SSE broadcaster - push events to connected clients
_sse_subscribers: list = []

def broadcast_event(event_type: str):
    """Notify all SSE subscribers of a data change event."""
    dead = []
    for queue in _sse_subscribers:
        try:
            queue.put_nowait(event_type)
        except Exception:
            dead.append(queue)
    for q in dead:
        try:
            _sse_subscribers.remove(q)
        except ValueError:
            pass

def get_sse_subscribers():
    return _sse_subscribers

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
    """Get all catalog items in the school store."""
    books = db.query(BookItem).all()
    return [b.to_dict() for b in books]

@router.post("/inventory", status_code=status.HTTP_201_CREATED)
def add_inventory(item: StoreItemCreate, db: Session = Depends(get_db)):
    """Add a new item to store catalog."""
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
    """Update item details or stock count."""
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
    """Delete an item from inventory."""
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
    """Places an order, decrements stock atomically in SQL, and generates invoice."""
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
        order_dict = new_order.to_dict()
        async_firestore_upsert("orders", new_order.id, order_dict)
        async_firestore_upsert("notifications", notif.id, notif.to_dict())
        broadcast_event("orders_updated")
        return order_dict
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/orders")
def list_orders(
    pupilId: str | None = None,
    pupilRegNo: str | None = None,
    limit: int = 5000,
    page: int = 1,
    per_page: int = 200,
    db: Session = Depends(get_db)
):
    """
    Get order invoices with optional pagination.
    Pass per_page > 0 for paginated response, per_page=0 for full list (legacy).
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

    has_receipt = and_(Order.paymentReceiptUrl.isnot(None), Order.paymentReceiptUrl != "", Order.paymentReceiptUrl != "receipt-uploaded")
    has_bal_receipt = and_(Order.balanceReceiptUrl.isnot(None), Order.balanceReceiptUrl != "", Order.balanceReceiptUrl != "receipt-uploaded")

    base_query = db.query(
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
    ).order_by(Order.date.desc())

    total = db.query(func.count(Order.id)).scalar() or 0

    # Paginated mode
    if per_page > 0:
        offset = (page - 1) * per_page
        rows = base_query.offset(offset).limit(per_page).all()
        result = _rows_to_dicts(rows)
        return {
            "data": result,
            "total": total,
            "page": page,
            "pages": max(1, -(-total // per_page)),  # ceiling division
            "per_page": per_page
        }

    # Legacy full-list mode (per_page=0 or limit provided)
    rows = base_query.limit(limit).all()
    return _rows_to_dicts(rows)

def _rows_to_dicts(rows):
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
    return result

# ---------------------------------------------------------------
# IMPORTANT: Specific routes MUST come before parameterized routes
# ---------------------------------------------------------------

@router.post("/orders/bulk-delete")
def delete_orders_bulk(payload: dict, db: Session = Depends(get_db)):
    """
    Permanently delete multiple order invoices in a single batch safely.
    Uses batching to prevent database parameter overflow and thread starvation.
    """
    order_ids = payload.get("orderIds", [])
    if not order_ids:
        return {"deleted": 0}
    clean_ids = list(set(str(i).strip() for i in order_ids if str(i).strip()))

    total_deleted = 0
    BATCH_SIZE = 200

    for idx in range(0, len(clean_ids), BATCH_SIZE):
        chunk = clean_ids[idx:idx + BATCH_SIZE]
        chunk_lower = [i.lower() for i in chunk]

        matching = db.query(Order).filter(
            or_(
                Order.id.in_(chunk),
                Order.invoiceNo.in_(chunk),
                func.lower(Order.id).in_(chunk_lower),
                func.lower(Order.invoiceNo).in_(chunk_lower)
            )
        ).all()

        for o in matching:
            async_firestore_delete("orders", o.id)
            if o.invoiceNo:
                async_firestore_delete("orders", o.invoiceNo)
            db.delete(o)
            total_deleted += 1

        for cid in chunk:
            async_firestore_delete("orders", cid)

        db.commit()

    broadcast_event("orders_updated")
    return {"deleted": total_deleted}

@router.post("/orders", status_code=status.HTTP_201_CREATED)
def sync_order(order_data: dict, db: Session = Depends(get_db)):
    """Sync or create an order record directly into the central SQL ledger."""
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
        existing_dict = existing.to_dict()
        async_firestore_upsert("orders", existing.id, existing_dict)
        broadcast_event("orders_updated")
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
    new_order_dict = new_order.to_dict()
    async_firestore_upsert("orders", new_order.id, new_order_dict)
    broadcast_event("orders_updated")
    return new_order_dict

@router.delete("/orders/{order_id}")
def delete_single_order(order_id: str, db: Session = Depends(get_db)):
    """Permanently delete an order invoice by ID or Invoice Number."""
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
        broadcast_event("orders_updated")
        return {"deleted": 0, "status": "not_found"}

    count = len(matching)
    for o in matching:
        async_firestore_delete("orders", o.id)
        if o.invoiceNo:
            async_firestore_delete("orders", o.invoiceNo)
        db.delete(o)
    db.commit()
    broadcast_event("orders_updated")
    return {"deleted": count, "status": "deleted"}

@router.get("/orders/{order_id}")
def get_single_order(order_id: str, db: Session = Depends(get_db)):
    """Get single order invoice with full receipt and audit logs."""
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
    """Update order status, receipts, or financial audit details."""
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
    order_dict = order.to_dict()
    async_firestore_upsert("orders", order.id, order_dict)
    broadcast_event("orders_updated")
    return order_dict
