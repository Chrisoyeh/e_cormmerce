import os
import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry
import datetime
import threading
from typing import Any, Dict, List, Optional

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "nazareth-e739f")
BASE_FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents"

def create_session() -> requests.Session:
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504])
    adapter = HTTPAdapter(max_retries=retries, pool_connections=20, pool_maxsize=30)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session

_http_session = create_session()

def _to_firestore_value(val: Any) -> Dict[str, Any]:
    """Converts a standard Python value to Firestore REST API typed format."""
    if val is None:
        return {"nullValue": None}
    elif isinstance(val, bool):
        return {"booleanValue": val}
    elif isinstance(val, int):
        return {"integerValue": str(val)}
    elif isinstance(val, float):
        return {"doubleValue": val}
    elif isinstance(val, str):
        return {"stringValue": val}
    elif isinstance(val, (datetime.datetime, datetime.date)):
        return {"stringValue": val.isoformat()}
    elif isinstance(val, list):
        if not val:
            return {"arrayValue": {}}
        return {"arrayValue": {"values": [_to_firestore_value(item) for item in val]}}
    elif isinstance(val, dict):
        return {"mapValue": {"fields": {k: _to_firestore_value(v) for k, v in val.items() if v is not None}}}
    else:
        return {"stringValue": str(val)}

def to_firestore_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    """Converts a dictionary into Firestore document fields structure."""
    return {"fields": {k: _to_firestore_value(v) for k, v in data.items() if v is not None}}

def firestore_upsert(collection: str, doc_id: str, data: Dict[str, Any], timeout: int = 20) -> bool:
    """Synchronously upserts a document to Firestore using the REST API."""
    try:
        url = f"{BASE_FIRESTORE_URL}/{collection}/{doc_id}"
        payload = to_firestore_fields(data)
        res = _http_session.patch(url, json=payload, timeout=timeout)
        return res.status_code in (200, 201)
    except Exception as e:
        print(f"[Firestore Sync Error] Failed to upsert {collection}/{doc_id}: {e}")
        return False

def firestore_delete(collection: str, doc_id: str, timeout: int = 15) -> bool:
    """Synchronously deletes a document from Firestore."""
    try:
        url = f"{BASE_FIRESTORE_URL}/{collection}/{doc_id}"
        res = _http_session.delete(url, timeout=timeout)
        return res.status_code in (200, 204)
    except Exception as e:
        print(f"[Firestore Sync Error] Failed to delete {collection}/{doc_id}: {e}")
        return False

def firestore_batch_commit(writes: List[Dict[str, Any]], timeout: int = 45) -> bool:
    """Executes a batch commit of multiple writes against Firestore."""
    try:
        url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents:commit"
        payload = {"writes": writes}
        res = _http_session.post(url, json=payload, timeout=timeout)
        return res.status_code == 200
    except Exception as e:
        print(f"[Firestore Batch Commit Error]: {e}")
        return False

from concurrent.futures import ThreadPoolExecutor

_firestore_executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="firestore-worker")

def async_firestore_upsert(collection: str, doc_id: str, data: Dict[str, Any]):
    """Non-blocking bounded thread worker to mirror an upsert to Firestore."""
    try:
        _firestore_executor.submit(firestore_upsert, collection, doc_id, data)
    except Exception as e:
        print(f"[Firestore Pool Error] Could not queue upsert: {e}")

def async_firestore_delete(collection: str, doc_id: str):
    """Non-blocking bounded thread worker to mirror a deletion to Firestore."""
    try:
        _firestore_executor.submit(firestore_delete, collection, doc_id)
    except Exception as e:
        print(f"[Firestore Pool Error] Could not queue delete: {e}")

