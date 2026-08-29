# Storage Architecture of Nazareth School Bookshop App

This application uses a hybrid storage architecture combining a cloud-hosted database for persistent global state and browser-based LocalStorage for client-side ephemeral state.

## 1. Cloud Storage (Firebase Firestore)
The primary data store for the application is **Firebase Firestore**.

- **Configuration:** Initialized in `src/firebase.ts`. The bucket is `nazareth-e739f.firebasestorage.app`.
- **Collections:** Uses Firestore collections to store core entities (Books/Materials, Pupils, Orders/Invoices, Notifications, Contacts).
- **Usage:** In `src/App.tsx`, Firestore listeners (`onSnapshot`) are established upon startup to subscribe to real-time updates for:
  - `materials` (Inventory)
  - `pupils` (Registered Students/Parents)
  - `orders` (Bookshop Ledger/Invoices)
  - `notifications` (System Alerts)
  - `contacts` (Support/Queries)

## 2. API Endpoints (`src/services/api.ts`)
While Firebase handles real-time sync, the application also contains an API layer configured to communicate with a remote server (via `fetch` to `API_BASE_URL`). This layer handles:
- Authentication & Registration
- Pupil & Attendance Operations
- Parent-Child Linking
- Store Checkout & Status adjusting

## 3. Local Storage (Browser Storage)
The application utilizes the browser's `localStorage` for storing non-critical, user-specific UI states. This ensures a faster experience and preserves state across sessions without burdening the backend.

- **GDPR Consent:**
  - Key: `nazareth_gdpr_consent`
  - Purpose: Tracks whether the user has agreed to the privacy and cookie policy.
- **Wishlist:**
  - Key: `nazareth_wishlist_{pupil_id}`
  - Purpose: Caches the list of book IDs the pupil has added to their wishlist.
- **Recently Viewed:**
  - Key: `nazareth_recent_viewed_{pupil_id}`
  - Purpose: Caches the history of items the pupil recently interacted with on the dashboard.

*Note: The Admin Dashboard includes a "GDPR Data Wipe" feature that explicitly calls `localStorage.clear()` to flush all local records.*
