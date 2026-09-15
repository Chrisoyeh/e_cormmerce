import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
load_dotenv(dotenv_path=env_path)

from backend.database import engine, Base, SessionLocal
from backend.models import Pupil, BookItem, Order, ContactSubmission, AppNotification

def restore_backup_bulk(backup_file_path):
    t0 = time.time()
    print(f"Reading backup file: {backup_file_path}", flush=True)
    if not os.path.exists(backup_file_path):
        print(f"Error: File not found at {backup_file_path}", flush=True)
        return

    with open(backup_file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    Order.__table__.drop(engine, checkfirst=True)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        pupils_data = data.get("pupilRegistry", [])
        books_data = data.get("bookCatalog", [])
        orders_data = data.get("orderHistory", [])
        contacts_data = data.get("contactSubmissions", [])

        print(f"Loaded from backup file:\n - {len(pupils_data)} Pupils\n - {len(books_data)} Books\n - {len(orders_data)} Orders\n - {len(contacts_data)} Contacts", flush=True)

        # 1. Clean & Upsert Books
        db.query(BookItem).delete()
        books_to_insert = []
        for idx, b in enumerate(books_data):
            book_id = b.get("id") or f"bk-{idx + 1}"
            books_to_insert.append({
                "id": book_id,
                "title": b.get("title", "Untitled Book"),
                "author": b.get("author", "Nazareth Press"),
                "price": float(b.get("price", 0)),
                "classLevel": b.get("classLevel", "Primary 1"),
                "category": b.get("category", "Textbook"),
                "stock": int(b.get("stock", 0)),
                "imageUrl": b.get("imageUrl"),
                "description": b.get("description", ""),
                "shoeSize": b.get("shoeSize"),
                "uniformSize": b.get("uniformSize")
            })
        if books_to_insert:
            db.bulk_insert_mappings(BookItem, books_to_insert)
        db.commit()
        print(f"[1/4] Inserted {len(books_to_insert)} books to Neon PostgreSQL.", flush=True)

        # 2. Extract unique pupils from both pupilRegistry AND orderHistory
        pupil_map = {}
        for p in pupils_data:
            reg = (p.get("regNo") or "").strip()
            if reg:
                pupil_map[reg.lower()] = {
                    "id": p.get("id") or f"std-{reg.replace('/', '_')}",
                    "surname": p.get("surname", "Surname").strip(),
                    "firstName": p.get("firstName", "Firstname").strip(),
                    "regNo": reg,
                    "classLevel": p.get("classLevel", "Primary 1").strip(),
                    "parentName": p.get("parentName", "Guardian"),
                    "parentEmail": p.get("parentEmail", "parent@example.com"),
                    "parentPhone": p.get("parentPhone", "+23400000000")
                }

        for o in orders_data:
            reg = (o.get("pupilRegNo") or "").strip()
            name = (o.get("pupilName") or "").strip()
            if reg and reg.lower() not in pupil_map:
                parts = name.split()
                if len(parts) >= 2:
                    surname = parts[-1]
                    firstName = " ".join(parts[:-1])
                elif len(parts) == 1:
                    surname = parts[0]
                    firstName = parts[0]
                else:
                    surname = "Student"
                    firstName = "Student"

                pupil_map[reg.lower()] = {
                    "id": o.get("pupilId") or f"std-{reg.replace('/', '_')}",
                    "surname": surname,
                    "firstName": firstName,
                    "regNo": reg,
                    "classLevel": o.get("classLevel", "Primary 1").strip(),
                    "parentName": f"Parent of {name}",
                    "parentEmail": "parent@example.com",
                    "parentPhone": "+23400000000"
                }

        db.query(Pupil).delete()
        pupils_to_insert = list(pupil_map.values())
        if pupils_to_insert:
            db.bulk_insert_mappings(Pupil, pupils_to_insert)
        db.commit()
        print(f"[2/4] Inserted {len(pupils_to_insert)} unique pupils to Neon PostgreSQL.", flush=True)

        # 3. Fast Orders Bulk Insert in chunks of 500
        db.query(Order).delete()
        orders_to_insert = []
        seen_order_ids = set()

        for idx, o in enumerate(orders_data):
            order_id = o.get("id") or f"ord-{idx + 1}"
            if order_id in seen_order_ids:
                order_id = f"{order_id}-{idx}"
            seen_order_ids.add(order_id)

            invoice_no = o.get("invoiceNo") or f"INV-2026-{idx + 1}"

            orders_to_insert.append({
                "id": order_id,
                "pupilId": o.get("pupilId", ""),
                "pupilName": o.get("pupilName", "Student"),
                "pupilRegNo": o.get("pupilRegNo", ""),
                "classLevel": o.get("classLevel", "Primary 1"),
                "items": o.get("items", []),
                "totalAmount": float(o.get("totalAmount", 0)),
                "amountPaid": float(o["amountPaid"]) if o.get("amountPaid") is not None else None,
                "status": o.get("status", "Completed" if o.get("paymentVerificationStatus") == "Verified" else "Pending Approved"),
                "date": o.get("date", "2026-09-01T00:00:00Z"),
                "invoiceNo": invoice_no,
                "paymentMethod": o.get("paymentMethod", "desk"),
                "paymentReceiptUrl": o.get("paymentReceiptUrl"),
                "balanceReceiptUrl": o.get("balanceReceiptUrl"),
                "paymentVerificationStatus": o.get("paymentVerificationStatus", "Verified" if o.get("status") == "Completed" else "Pending Audit"),
                "submittedToLedger": bool(o.get("submittedToLedger", True)),
                "notes": o.get("notes")
            })

        # Insert orders in chunks of 500
        chunk_size = 500
        for i in range(0, len(orders_to_insert), chunk_size):
            chunk = orders_to_insert[i:i + chunk_size]
            db.bulk_insert_mappings(Order, chunk)
            db.commit()
            print(f"   - Inserted orders {i + 1} to {min(i + len(chunk), len(orders_to_insert))}...", flush=True)

        print(f"[3/4] Inserted {len(orders_to_insert)} order invoices to Neon PostgreSQL.", flush=True)

        # 4. Contacts
        db.query(ContactSubmission).delete()
        contacts_to_insert = []
        for idx, c in enumerate(contacts_data):
            contacts_to_insert.append({
                "id": c.get("id") or f"cnt-{idx + 1}",
                "name": c.get("name", "Contact"),
                "email": c.get("email", "contact@example.com"),
                "phone": c.get("phone", ""),
                "message": c.get("message", ""),
                "timestamp": c.get("timestamp", "2026-09-01T00:00:00Z"),
                "status": c.get("status", "Pending")
            })
        if contacts_to_insert:
            db.bulk_insert_mappings(ContactSubmission, contacts_to_insert)
        db.commit()
        print(f"[4/4] Inserted {len(contacts_to_insert)} contact messages to Neon PostgreSQL.", flush=True)

        # System Notification
        notif = AppNotification(
            id=f"not-restore-{int(time.time())}",
            title="Institutional GDPR Backup Restored",
            message=f"Restored {len(pupils_to_insert)} pupils, {len(books_to_insert)} store catalog items, and {len(orders_to_insert)} invoice orders into Neon Cloud PostgreSQL.",
            type="success",
            read=False,
            role="admin"
        )
        db.add(notif)
        db.commit()

        elapsed = time.time() - t0
        print(f"\n==========================================", flush=True)
        print(f"🎉 RESTORATION COMPLETED IN {elapsed:.2f} SECONDS!", flush=True)
        print(f" - Pupils in Neon DB:   {db.query(Pupil).count()}", flush=True)
        print(f" - Books in Neon DB:    {db.query(BookItem).count()}", flush=True)
        print(f" - Orders in Neon DB:   {db.query(Order).count()}", flush=True)
        print(f" - Contacts in Neon DB: {db.query(ContactSubmission).count()}", flush=True)
        print(f"==========================================", flush=True)

    except Exception as e:
        db.rollback()
        print(f"Error during bulk restore: {e}", flush=True)
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    backup_path = r"C:\Users\ch4oy\Desktop\nazareth_institutional_gdpr_backup (4).json"
    if len(sys.argv) > 1:
        backup_path = sys.argv[1]
    restore_backup_bulk(backup_path)
