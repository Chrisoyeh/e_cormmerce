"""
One-Time Bulk Synchronization & Migration Script:
Exports all existing records from PostgreSQL database to Google Cloud Firestore.
"""

import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from dotenv import load_dotenv
load_dotenv()

from backend.database import SessionLocal
from backend.models import Pupil, BookItem, Order, AppNotification, ContactSubmission
from backend.utils.firestore_sync import (
    firestore_batch_commit,
    to_firestore_fields,
    FIREBASE_PROJECT_ID,
    firestore_upsert
)

def build_batch_writes(collection: str, items: list) -> list:
    writes = []
    for item in items:
        data = item.to_dict() if hasattr(item, "to_dict") else item
        doc_id = data.get("id") or str(item.id)
        name = f"projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/{collection}/{doc_id}"
        fields_payload = to_firestore_fields(data)["fields"]
        writes.append({
            "update": {
                "name": name,
                "fields": fields_payload
            }
        })
    return writes

def sync_collection_in_batches(collection: str, items: list, batch_size: int = 100, max_workers: int = 6):
    total = len(items)
    if total == 0:
        print(f"[{collection}] No records to sync.")
        return 0

    print(f"[{collection}] Starting sync of {total} records in batches of {batch_size}...")
    all_writes = build_batch_writes(collection, items)
    success_count = 0

    chunks = [all_writes[i:i + batch_size] for i in range(0, len(all_writes), batch_size)]

    def commit_chunk(chunk_idx, chunk):
        success = firestore_batch_commit(chunk, timeout=45)
        return chunk_idx, len(chunk), success

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(commit_chunk, idx, c) for idx, c in enumerate(chunks)]
        for fut in as_completed(futures):
            idx, count, ok = fut.result()
            if ok:
                success_count += count
                print(f"  [{collection}] Batch {idx + 1}/{len(chunks)} committed ({count} records)")
            else:
                print(f"  [{collection}] Batch {idx + 1}/{len(chunks)} failed, retrying items individually...")
                # Retry individual upserts for this chunk
                for item in items[idx * batch_size : (idx + 1) * batch_size]:
                    data = item.to_dict() if hasattr(item, "to_dict") else item
                    doc_id = data.get("id") or str(item.id)
                    if firestore_upsert(collection, doc_id, data, timeout=20):
                        success_count += 1
                    else:
                        print(f"    Failed to upsert {collection}/{doc_id}")

    print(f"[{collection}] Finished syncing {success_count}/{total} records to Firestore.")
    return success_count

def sync_orders_chunked(db, batch_size: int = 20, chunk_db_limit: int = 250):
    total_orders = db.query(Order).count()
    print(f"[orders] Starting chunked sync of {total_orders} orders from DB...")
    
    success_count = 0
    offset = 0
    
    while offset < total_orders:
        orders = db.query(Order).offset(offset).limit(chunk_db_limit).all()
        if not orders:
            break
        print(f"  [orders] Fetched rows {offset} -> {offset + len(orders)} from DB. Pushing to Firestore...")
        
        writes = build_batch_writes("orders", orders)
        sub_batches = [writes[i:i + batch_size] for i in range(0, len(writes), batch_size)]
        
        def commit_order_chunk(batch_idx, batch_writes, batch_items):
            ok = firestore_batch_commit(batch_writes, timeout=45)
            if ok:
                return len(batch_writes)
            else:
                # Retry individually
                sub_success = 0
                for item in batch_items:
                    data = item.to_dict()
                    if firestore_upsert("orders", data["id"], data, timeout=25):
                        sub_success += 1
                return sub_success

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            for b_idx, s_batch in enumerate(sub_batches):
                b_items = orders[b_idx * batch_size : (b_idx + 1) * batch_size]
                futures.append(executor.submit(commit_order_chunk, b_idx, s_batch, b_items))
            for f in as_completed(futures):
                success_count += f.result()
        
        print(f"  [orders] Progress: {success_count}/{total_orders} orders synced.")
        offset += chunk_db_limit

    print(f"[orders] Finished syncing {success_count}/{total_orders} orders to Firestore.")
    return success_count

def run_full_migration():
    start_time = time.time()
    print("=" * 60)
    print("STARTING FULL POSTGRESQL -> FIRESTORE BULK MIGRATION")
    print(f"Target Project: {FIREBASE_PROJECT_ID}")
    print("=" * 60)

    db = SessionLocal()
    try:
        # 1. Sync Books
        books = db.query(BookItem).all()
        sync_collection_in_batches("books", books, batch_size=50, max_workers=4)

        # 2. Sync Pupils
        pupils = db.query(Pupil).all()
        sync_collection_in_batches("pupils", pupils, batch_size=100, max_workers=6)

        # 3. Sync Notifications
        notifs = db.query(AppNotification).all()
        sync_collection_in_batches("notifications", notifs, batch_size=50, max_workers=4)

        # 4. Sync Contacts
        contacts = db.query(ContactSubmission).all()
        sync_collection_in_batches("contacts", contacts, batch_size=50, max_workers=4)

        # 5. Sync Orders (Chunked to handle large receipts smoothly)
        sync_orders_chunked(db, batch_size=20, chunk_db_limit=250)

        duration = time.time() - start_time
        print("=" * 60)
        print(f"ALL COLLECTIONS MIGRATED IN {duration:.2f}s!")
        print("=" * 60)
    finally:
        db.close()

if __name__ == "__main__":
    run_full_migration()
