import os
import firebase_admin
from firebase_admin import credentials, firestore, auth

def initialize_firebase():
    """
    Initializes the Firebase Admin SDK.
    Looks for a service account key JSON file path in the environment,
    or falls back to default credentials (ADC).
    """
    # Check if already initialized to avoid duplicate initialization errors
    if not firebase_admin._apps:
        cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
        
        if cred_path and os.path.exists(cred_path):
            print(f"Initializing Firebase Admin SDK using credentials file at: {cred_path}")
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            print("Initializing Firebase Admin SDK using default credentials.")
            try:
                # This works automatically when deployed to Google Cloud Run / App Engine
                firebase_admin.initialize_app()
            except Exception as e:
                # For local development where default credentials aren't set,
                # we can initialize with a dummy project ID or print a warning
                print(f"Warning: Default Firebase initialization failed: {e}")
                print("Make sure GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_KEY is set.")
                # Force fallback initialization (mostly for local development mock behavior)
                try:
                    firebase_admin.initialize_app(options={'projectId': os.getenv("FIREBASE_PROJECT_ID", "nazareth-e739f")})
                except Exception as ex:
                    print(f"Failed fallback initialization: {ex}")

# Trigger initialization
initialize_firebase()

# Export firestore client
db = firestore.client()
