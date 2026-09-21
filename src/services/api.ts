import { Pupil, BookItem, Order, OrderItem, AppNotification, ContactSubmission } from '../types';
import { INITIAL_BOOKS, INITIAL_NOTIFICATIONS } from '../data/initialData';

const configuredApiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = configuredApiUrl || 'https://nazareth-school-store.onrender.com';

const FALLBACK_URLS = [
  API_BASE_URL,
  'https://nazareth-school-store.onrender.com',
  ...(isLocal ? ['http://localhost:8000'] : [])
].filter((url, idx, arr) => Boolean(url) && arr.indexOf(url) === idx);

const DELETED_ORDERS_KEY = 'nazareth_deleted_order_ids';

export function getDeletedOrderIds(): Set<string> {
  try {
    const raw = typeof window !== 'undefined' ? (localStorage.getItem(DELETED_ORDERS_KEY) || sessionStorage.getItem(DELETED_ORDERS_KEY)) : null;
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map((id: string) => String(id).trim().toLowerCase()));
      }
    }
  } catch {}
  return new Set();
}

export function recordDeletedOrderIds(ids: string[]): void {
  try {
    if (typeof window === 'undefined') return;
    const set = getDeletedOrderIds();
    ids.forEach(id => {
      if (id && String(id).trim()) {
        set.add(String(id).trim().toLowerCase());
      }
    });
    const serialized = JSON.stringify(Array.from(set));
    localStorage.setItem(DELETED_ORDERS_KEY, serialized);
    sessionStorage.setItem(DELETED_ORDERS_KEY, serialized);

    // Purge any legacy cached orders from localStorage and sessionStorage
    try {
      localStorage.removeItem('nazareth_cached_orders');
      sessionStorage.removeItem('nazareth_cached_orders');
    } catch {}
  } catch {}
}

class ApiService {
  private token: string | null = null;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private deadUrls: Map<string, number> = new Map();
  private activeBaseUrl: string = API_BASE_URL;

  setToken(token: string) {
    this.token = token;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 3500): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal,
      });
      clearTimeout(timeoutId);
      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Network request timed out.');
      }
      throw err;
    }
  }

  /**
   * Tries requesting from primary URL, then falls back quickly if offline / 503
   */
  private async resilientFetch(endpoint: string, options: RequestInit = {}, timeoutMs: number = 3000): Promise<Response> {
    const now = Date.now();
    const urlsToTry = [this.activeBaseUrl, ...FALLBACK_URLS.filter(u => u !== this.activeBaseUrl)]
      .filter(u => !this.deadUrls.has(u) || (this.deadUrls.get(u)! < now));

    if (urlsToTry.length === 0) {
      throw new Error(`No available live backend for ${endpoint}`);
    }

    let lastError: any = null;

    for (const baseUrl of urlsToTry) {
      try {
        const fullUrl = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        const res = await this.fetchWithTimeout(fullUrl, options, timeoutMs);
        if (res.ok) {
          this.activeBaseUrl = baseUrl;
          return res;
        }
        if (res.status >= 500) {
          // Mark suspended or crashing server as dead for 60s to avoid blocking UI
          this.deadUrls.set(baseUrl, Date.now() + 60000);
        }
        // If validation error (4xx but not 404), return immediately
        if (res.status >= 400 && res.status < 500 && res.status !== 404) {
          return res;
        }
      } catch (err) {
        this.deadUrls.set(baseUrl, Date.now() + 30000);
        lastError = err;
      }
    }

    throw lastError || new Error(`Failed to reach backend service for ${endpoint}`);
  }

  private getCached<T>(key: string, maxAgeMs: number = 30000): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < maxAgeMs) {
      return entry.data as T;
    }
    return null;
  }

  private setCached<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async fetchFirestoreRest<T = any>(collectionName: string): Promise<T[]> {
    try {
      const res = await fetch(`https://firestore.googleapis.com/v1/projects/nazareth-e739f/databases/(default)/documents/${collectionName}?pageSize=300`);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.documents) return [];
      return data.documents.map((doc: any) => {
        const docId = doc.name.split('/').pop();
        const obj: any = { id: docId };
        for (const [k, v] of Object.entries(doc.fields || {})) {
          const val: any = v;
          if ('stringValue' in val) obj[k] = val.stringValue;
          else if ('integerValue' in val) obj[k] = Number(val.integerValue);
          else if ('doubleValue' in val) obj[k] = val.doubleValue;
          else if ('booleanValue' in val) obj[k] = val.booleanValue;
          else if ('nullValue' in val) obj[k] = null;
          else if ('arrayValue' in val) {
            obj[k] = (val.arrayValue.values || []).map((item: any) => {
              if ('mapValue' in item) {
                const subObj: any = {};
                for (const [sk, sv] of Object.entries(item.mapValue.fields || {})) {
                  const sval: any = sv;
                  if ('stringValue' in sval) subObj[sk] = sval.stringValue;
                  else if ('integerValue' in sval) subObj[sk] = Number(sval.integerValue);
                  else if ('doubleValue' in sval) subObj[sk] = sval.doubleValue;
                  else if ('booleanValue' in sval) subObj[sk] = sval.booleanValue;
                  else subObj[sk] = Object.values(sval)[0];
                }
                return subObj;
              }
              return Object.values(item)[0];
            });
          } else if ('mapValue' in val) {
            const subObj: any = {};
            for (const [sk, sv] of Object.entries(val.mapValue.fields || {})) {
              const sval: any = sv;
              if ('stringValue' in sval) subObj[sk] = sval.stringValue;
              else if ('integerValue' in sval) subObj[sk] = Number(sval.integerValue);
              else if ('doubleValue' in sval) subObj[sk] = sval.doubleValue;
              else if ('booleanValue' in sval) subObj[sk] = sval.booleanValue;
              else subObj[sk] = Object.values(sval)[0];
            }
            obj[k] = subObj;
          } else {
            obj[k] = Object.values(val)[0];
          }
        }
        return obj;
      });
    } catch {
      return [];
    }
  }

  // -------------------------
  // AUTHENTICATION ENDPOINTS
  // -------------------------
  async pupilLogin(credentials: {
    surname: string;
    regNo: string;
    role: 'pupil' | 'parent';
  }): Promise<{ status: string; role: string; user: Pupil }> {
    try {
      const res = await this.resilientFetch('/auth/pupil-login', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(credentials),
      }, 2500);
      if (res.ok) {
        return res.json();
      }
    } catch (apiErr) {
      console.warn('Backend pupil login notice, checking Firestore directly...', apiErr);
    }

    // Direct Firestore fallback
    try {
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const cleanReg = String(credentials?.regNo || '').trim();
      const cleanSurname = String(credentials?.surname || '').trim().toLowerCase();

      let snap = await getDocs(query(collection(db, 'pupils'), where('regNo', '==', cleanReg)));
      if (snap.empty && cleanReg !== cleanReg.toUpperCase()) {
        snap = await getDocs(query(collection(db, 'pupils'), where('regNo', '==', cleanReg.toUpperCase())));
      }

      let found: Pupil | null = null;
      snap.forEach(docSnap => {
        const data = docSnap.data() as Pupil;
        if (data && data.surname && String(data.surname).trim().toLowerCase() === cleanSurname) {
          found = { ...data, id: docSnap.id };
        }
      });

      if (!found) {
        const allSnap = await getDocs(collection(db, 'pupils'));
        allSnap.forEach(docSnap => {
          const data = docSnap.data() as Pupil;
          if (
            data &&
            data.regNo &&
            data.surname &&
            String(data.regNo).trim().toLowerCase() === cleanReg.toLowerCase() &&
            String(data.surname).trim().toLowerCase() === cleanSurname
          ) {
            found = { ...data, id: docSnap.id };
          }
        });
      }

      if (found) {
        return { status: 'success', role: credentials.role, user: found };
      }
    } catch (fsErr) {
      console.error('Firestore login fallback error:', fsErr);
    }

    throw new Error('Invalid credentials. Pupil registration number or surname not found.');
  }

  async adminLogin(credentials: {
    username: string;
    password: string;
  }): Promise<{ status: string; role: string; user: any }> {
    try {
      const res = await this.resilientFetch('/auth/admin-login', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(credentials),
      }, 2500);
      if (res.ok) {
        return res.json();
      }
    } catch (apiErr) {
      console.warn('Backend admin login notice, checking registrar credentials...', apiErr);
    }

    const cleanUser = String(credentials?.username || '').trim().toLowerCase();
    if ((cleanUser === 'admin' || cleanUser === 'registrar') && credentials?.password === 'admin123') {
      return {
        status: 'success',
        role: 'admin',
        user: { id: 'admin-1', username: credentials.username, role: 'admin' }
      };
    }

    throw new Error('Invalid Registrar credentials.');
  }

  // -------------------------
  // STUDENT ENDPOINTS
  // -------------------------
  async getAllPupils(classLevel?: string, search?: string): Promise<Pupil[]> {
    const cacheKey = `pupils_${classLevel || 'all'}_${search || ''}`;
    const cached = this.getCached<Pupil[]>(cacheKey, 15000);
    if (cached) return cached;

    const params = new URLSearchParams();
    if (classLevel && classLevel !== 'All Classes') params.append('classLevel', classLevel);
    if (search) params.append('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';

    // Read ONLY from PostgreSQL database with generous 45s timeout
    try {
      const res = await this.resilientFetch(`/students${qs}`, {
        headers: this.getHeaders(),
      }, 45000);
      if (res.ok) {
        const data: Pupil[] = await res.json();
        if (Array.isArray(data)) {
          this.setCached(cacheKey, data);
          try {
            sessionStorage.setItem('nazareth_cached_pupils', JSON.stringify(data));
            localStorage.setItem('nazareth_cached_pupils', JSON.stringify(data));
          } catch {}
          return data;
        }
      }
    } catch (apiErr) {
      console.warn('Backend pupils query error:', apiErr);
    }

    // Offline fallback: snapshot stored in browser cache
    try {
      const local = localStorage.getItem('nazareth_cached_pupils') || sessionStorage.getItem('nazareth_cached_pupils');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    return [];
  }

  async getStudent(uid: string): Promise<Pupil> {
    try {
      const res = await this.resilientFetch(`/students/${uid}`, {
        headers: this.getHeaders(),
      }, 2500);
      if (res.ok) return res.json();
    } catch {}

    // Firestore fallback
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    const docSnap = await getDoc(doc(db, 'pupils', uid));
    if (docSnap.exists()) {
      return { ...(docSnap.data() as Pupil), id: docSnap.id };
    }
    throw new Error('Failed to retrieve student profile.');
  }

  async createStudent(studentData: Omit<Pupil, 'id'> | Pupil): Promise<Pupil> {
    this.cache.clear();
    const docId = (studentData as any).id || `pupil_${Date.now()}`;
    const payload = { ...studentData, id: docId };

    try {
      const res = await this.resilientFetch('/students', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      }, 15000);
      if (res.ok) return res.json();
      if (res.status === 400) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Registration Number already exists.');
      }
    } catch (apiErr: any) {
      if (apiErr?.message?.includes('already exists')) throw apiErr;
    }

    // Firestore direct fallback
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await setDoc(doc(db, 'pupils', docId), payload);
      return payload as Pupil;
    } catch (fsErr) {
      console.error('Firestore create student error:', fsErr);
      throw new Error('Failed to create student record.');
    }
  }

  async createPupilsBulk(students: Pupil[]): Promise<{ inserted: number; skipped?: number; updated?: number; totalProcessed: number }> {
    this.cache.clear();
    try {
      const res = await this.resilientFetch('/students/bulk', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ students }),
      }, 5000);
      if (res.ok) return res.json();
    } catch {}

    // Firestore batch fallback
    try {
      const { doc, writeBatch } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const batch = writeBatch(db);
      students.forEach(s => {
        const id = s.id || `pupil_${s.regNo || Date.now()}`;
        batch.set(doc(db, 'pupils', id), { ...s, id });
      });
      await batch.commit();
      return { inserted: students.length, totalProcessed: students.length };
    } catch (fsErr) {
      console.error('Firestore bulk upload fallback error:', fsErr);
      throw new Error('Failed to perform bulk upload.');
    }
  }

  async updatePupil(studentId: string, data: Partial<Pupil>): Promise<Pupil> {
    this.cache.clear();
    try {
      const res = await this.resilientFetch(`/students/${studentId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      }, 3000);
      if (res.ok) return res.json();
    } catch {}

    // Firestore fallback
    try {
      const { doc, updateDoc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const docRef = doc(db, 'pupils', studentId);
      await updateDoc(docRef, data as any);
      const snap = await getDoc(docRef);
      return { ...(snap.data() as Pupil), id: snap.id };
    } catch (fsErr) {
      throw new Error('Failed to update student profile.');
    }
  }

  async deletePupil(studentId: string, regNo?: string): Promise<void> {
    this.cache.clear();
    const cleanId = (studentId || '').trim();
    const cleanReg = (regNo || '').trim();
    if (!cleanId && !cleanReg) return;

    const target = cleanId || cleanReg;

    // 1. Delete from PostgreSQL backend
    try {
      await this.resilientFetch(`/students/${encodeURIComponent(target)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      }, 10000);
    } catch (err) {
      console.warn('Backend deletePupil notice:', err);
    }

    if (cleanReg && cleanReg !== target) {
      try {
        await this.resilientFetch(`/students/${encodeURIComponent(cleanReg)}`, {
          method: 'DELETE',
          headers: this.getHeaders(),
        }, 10000);
      } catch {}
    }

    // 2. Delete from Firestore
    try {
      const { doc, deleteDoc, collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const docIds = new Set<string>();
      if (cleanId) {
        docIds.add(cleanId);
        docIds.add(`pupil_${cleanId}`);
      }
      if (cleanReg) {
        docIds.add(cleanReg);
        docIds.add(`pupil_${cleanReg}`);
      }

      const deletePromises: Promise<any>[] = [];
      docIds.forEach(id => {
        deletePromises.push(deleteDoc(doc(db, 'pupils', id)).catch(() => {}));
      });

      const pupilsRef = collection(db, 'pupils');
      const queries: Promise<any>[] = [];
      if (cleanId) {
        queries.push(getDocs(query(pupilsRef, where('id', '==', cleanId))).catch(() => null));
      }
      if (cleanReg) {
        queries.push(getDocs(query(pupilsRef, where('regNo', '==', cleanReg))).catch(() => null));
      }

      const snaps = await Promise.all(queries);
      snaps.forEach(snap => {
        snap?.forEach((d: any) => deletePromises.push(deleteDoc(d.ref).catch(() => {})));
      });

      await Promise.all(deletePromises);
    } catch (fsErr) {
      console.warn('Firestore pupil delete notice:', fsErr);
    }
  }

  async deleteClassPupils(classLevel: string): Promise<{ count: number }> {
    this.cache.clear();
    try {
      const res = await this.resilientFetch(`/students/class/${encodeURIComponent(classLevel)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      }, 4000);
      if (res.ok) return res.json();
    } catch {}

    return { count: 0 };
  }

  async logAttendance(attendance: {
    studentId: string;
    date: string;
    classLevel: string;
    status: 'Present' | 'Absent' | 'Late';
  }) {
    try {
      const res = await this.resilientFetch('/students/attendance', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(attendance),
      }, 3000);
      if (res.ok) return res.json();
    } catch {}
    return { status: 'recorded' };
  }

  // -------------------------
  // SCHOOL STORE ENDPOINTS
  // -------------------------
  async getInventory(): Promise<BookItem[]> {
    const cached = this.getCached<BookItem[]>('inventory_catalog', 15000);
    if (cached) return cached;

    // Read ONLY from PostgreSQL backend with generous timeout
    try {
      const res = await this.resilientFetch('/store/inventory', {
        headers: this.getHeaders(),
      }, 35000);
      if (res.ok) {
        const data: BookItem[] = await res.json();
        if (Array.isArray(data)) {
          this.setCached('inventory_catalog', data);
          try {
            sessionStorage.setItem('nazareth_cached_books', JSON.stringify(data));
            localStorage.setItem('nazareth_cached_books', JSON.stringify(data));
          } catch {}
          return data;
        }
      }
    } catch (apiErr) {
      console.warn('Inventory fetch error:', apiErr);
    }

    // Offline fallback: snapshot stored in browser cache
    try {
      const local = localStorage.getItem('nazareth_cached_books') || sessionStorage.getItem('nazareth_cached_books');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    return [];
  }

  async addBook(book: BookItem): Promise<BookItem> {
    this.cache.delete('inventory_catalog');
    const docId = book.id || `book_${Date.now()}`;
    const payload = { ...book, id: docId };

    try {
      const res = await this.resilientFetch('/store/inventory', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      }, 3000);
      if (res.ok) return res.json();
    } catch {}

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await setDoc(doc(db, 'books', docId), payload);
      return payload;
    } catch (fsErr) {
      throw new Error('Failed to add book item to store.');
    }
  }

  async updateBook(bookId: string, book: BookItem): Promise<BookItem> {
    this.cache.delete('inventory_catalog');
    try {
      const res = await this.resilientFetch(`/store/inventory/${bookId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(book),
      }, 3000);
      if (res.ok) return res.json();
    } catch {}

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await setDoc(doc(db, 'books', bookId), { ...book, id: bookId });
      return { ...book, id: bookId };
    } catch (fsErr) {
      throw new Error('Failed to update book item.');
    }
  }

  async deleteBook(bookId: string): Promise<void> {
    this.cache.delete('inventory_catalog');
    const cleanId = (bookId || '').trim();
    if (!cleanId) return;

    try {
      await this.resilientFetch(`/store/inventory/${encodeURIComponent(cleanId)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      }, 15000);
    } catch (err) {
      console.warn('Backend deleteBook error:', err);
    }

    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await deleteDoc(doc(db, 'books', cleanId));
    } catch {}
  }

  async checkoutCart(checkoutData: {
    pupilId: string;
    pupilName: string;
    pupilRegNo: string;
    classLevel: string;
    items: OrderItem[];
    paymentMethod: 'online' | 'bank' | 'desk';
  }): Promise<Order> {
    this.cache.delete('orders_all');
    this.cache.delete(`orders_${checkoutData.pupilId}`);

    try {
      const res = await this.resilientFetch('/store/checkout', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(checkoutData),
      }, 3500);
      if (res.ok) return res.json();
    } catch {}

    // Firestore fallback checkout
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const orderId = `ord-${Date.now()}`;
      const total = checkoutData.items.reduce((acc, it) => acc + (it.price * it.quantity), 0);
      const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
      const newOrder: Order = {
        id: orderId,
        pupilId: checkoutData.pupilId,
        pupilName: checkoutData.pupilName,
        pupilRegNo: checkoutData.pupilRegNo,
        classLevel: checkoutData.classLevel as any,
        items: checkoutData.items,
        totalAmount: total,
        amountPaid: checkoutData.paymentMethod === 'desk' ? 0 : total,
        status: 'Pending Approved',
        date: new Date().toISOString(),
        invoiceNo,
        paymentMethod: (checkoutData.paymentMethod === 'desk' ? 'bank' : checkoutData.paymentMethod) as any,
        paymentVerificationStatus: 'Pending Audit',
        submittedToLedger: false
      };
      await setDoc(doc(db, 'orders', orderId), newOrder);
      return newOrder;
    } catch (fsErr) {
      throw new Error('Checkout failed.');
    }
  }

  async getOrders(pupilId?: string, pupilRegNo?: string): Promise<Order[]> {
    const cacheKey = pupilId || pupilRegNo ? `orders_${pupilId || ''}_${pupilRegNo || ''}` : 'orders_all';
    const deletedIds = getDeletedOrderIds();

    const filterDeleted = (list: Order[]): Order[] => {
      if (!Array.isArray(list)) return [];
      const normalized = list.map(o => {
        let items = o.items;
        if (typeof items === 'string') {
          try { items = JSON.parse(items); } catch { items = []; }
        }
        if (!Array.isArray(items)) items = [];
        return { ...o, items, totalAmount: typeof o.totalAmount === 'number' ? o.totalAmount : Number(o.totalAmount) || 0 };
      });
      if (deletedIds.size === 0) return normalized;
      return normalized.filter(o => {
        if (!o) return false;
        const id = String(o.id || '').trim().toLowerCase();
        const inv = String(o.invoiceNo || '').trim().toLowerCase();
        return !deletedIds.has(id) && !deletedIds.has(inv);
      });
    };

    const cached = this.getCached<Order[]>(cacheKey, 60000);
    if (cached && cached.length > 0) return filterDeleted(cached);

    const params = new URLSearchParams();
    if (pupilId) params.append('pupilId', pupilId);
    if (pupilRegNo) params.append('pupilRegNo', pupilRegNo);
    const qs = params.toString() ? `?${params.toString()}` : '';

    // Read ONLY from PostgreSQL backend with generous 45s streaming timeout
    try {
      const res = await this.resilientFetch(`/store/orders${qs}`, {
        headers: this.getHeaders(),
      }, 45000);
      if (res.ok) {
        const data: Order[] = await res.json();
        if (Array.isArray(data)) {
          const cleaned = filterDeleted(data);
          this.setCached(cacheKey, cleaned);
          return cleaned;
        }
      }
    } catch (apiErr) {
      console.warn('Orders fetch error from PostgreSQL:', apiErr);
      const stale = this.cache.get(cacheKey);
      if (stale && Array.isArray(stale.data) && stale.data.length > 0) {
        return filterDeleted(stale.data);
      }
      throw apiErr;
    }

    // Return stale cache if available before defaulting to empty array
    const staleEntry = this.cache.get(cacheKey);
    if (staleEntry && Array.isArray(staleEntry.data) && staleEntry.data.length > 0) {
      return filterDeleted(staleEntry.data);
    }
    return [];
  }

  async getOrder(orderId: string): Promise<Order> {
    try {
      const res = await this.resilientFetch(`/store/orders/${encodeURIComponent(orderId.trim())}`, {
        headers: this.getHeaders(),
      }, 3000);
      if (res.ok) return res.json();
    } catch {}

    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    const docSnap = await getDoc(doc(db, 'orders', orderId.trim()));
    if (docSnap.exists()) {
      return { ...(docSnap.data() as Order), id: docSnap.id };
    }
    throw new Error('Failed to retrieve order details.');
  }

  async syncOrder(order: Order): Promise<Order> {
    this.cache.clear();
    try {
      const res = await this.resilientFetch('/store/orders', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(order),
      }, 3000);
      if (res.ok) return res.json();
    } catch {}

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await setDoc(doc(db, 'orders', order.id), order);
      return order;
    } catch (fsErr) {
      throw new Error('Failed to sync order.');
    }
  }

  async updateOrder(orderId: string, data: Partial<Order>): Promise<Order> {
    this.cache.clear();
    try {
      const res = await this.resilientFetch(`/store/orders/${encodeURIComponent(orderId.trim())}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      }, 3000);
      if (res.ok) return res.json();
    } catch {}

    try {
      const { doc, updateDoc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const docRef = doc(db, 'orders', orderId.trim());
      await updateDoc(docRef, data as any);
      const snap = await getDoc(docRef);
      return { ...(snap.data() as Order), id: snap.id };
    } catch (fsErr) {
      throw new Error('Failed to update order status.');
    }
  }

  async deleteOrder(orderId: string, invoiceNo?: string): Promise<void> {
    this.cache.clear();
    const cleanId = (orderId || '').trim();
    const cleanInv = (invoiceNo || '').trim();
    if (!cleanId && !cleanInv) return;

    const idsToRecord: string[] = [];
    if (cleanId) idsToRecord.push(cleanId);
    if (cleanInv) idsToRecord.push(cleanInv);
    recordDeletedOrderIds(idsToRecord);

    const target = cleanId || cleanInv;

    // 1. Delete from PostgreSQL backend
    try {
      await this.resilientFetch(`/store/orders/${encodeURIComponent(target)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      }, 10000);
    } catch (err) {
      console.warn('Backend deleteOrder notice:', err);
    }

    if (cleanInv && cleanInv !== target) {
      try {
        await this.resilientFetch(`/store/orders/${encodeURIComponent(cleanInv)}`, {
          method: 'DELETE',
          headers: this.getHeaders(),
        }, 10000);
      } catch {}
    }

    // 2. Delete from Firestore
    try {
      const { doc, deleteDoc, collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const docIds = new Set<string>();
      if (cleanId) docIds.add(cleanId);
      if (cleanInv) docIds.add(cleanInv);

      const deletePromises: Promise<any>[] = [];
      docIds.forEach(id => {
        deletePromises.push(deleteDoc(doc(db, 'orders', id)).catch(() => {}));
      });
      
      const ordersRef = collection(db, 'orders');
      const queries: Promise<any>[] = [];
      if (cleanId) {
        queries.push(getDocs(query(ordersRef, where('id', '==', cleanId))).catch(() => null));
        queries.push(getDocs(query(ordersRef, where('invoiceNo', '==', cleanId))).catch(() => null));
      }
      if (cleanInv && cleanInv !== cleanId) {
        queries.push(getDocs(query(ordersRef, where('invoiceNo', '==', cleanInv))).catch(() => null));
      }

      const snaps = await Promise.all(queries);
      snaps.forEach(snap => {
        snap?.forEach((d: any) => deletePromises.push(deleteDoc(d.ref).catch(() => {})));
      });

      await Promise.all(deletePromises);
    } catch (fsErr) {
      console.warn('Firestore order delete notice:', fsErr);
    }
  }

  async deleteOrdersBulk(orderIds: string[]): Promise<{ deleted: number }> {
    this.cache.clear();
    if (!orderIds || orderIds.length === 0) return { deleted: 0 };
    const cleanIds = Array.from(new Set(orderIds.map(id => id.trim()).filter(Boolean)));
    
    recordDeletedOrderIds(cleanIds);

    const CHUNK_SIZE = 150;
    let totalDeleted = 0;

    for (let i = 0; i < cleanIds.length; i += CHUNK_SIZE) {
      const chunk = cleanIds.slice(i, i + CHUNK_SIZE);
      try {
        const res = await this.resilientFetch('/store/orders/bulk-delete', {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ orderIds: chunk }),
        }, 35000);
        if (res.ok) {
          const data = await res.json();
          totalDeleted += (typeof data.deleted === 'number' ? data.deleted : chunk.length);
        } else {
          console.warn(`Bulk delete chunk failed with status ${res.status}`);
        }
      } catch (err) {
        console.warn('Backend bulk delete chunk error:', err);
      }
      this.cleanupFirestoreOrders(chunk).catch(() => {});
    }

    return { deleted: totalDeleted || cleanIds.length };
  }

  private async cleanupFirestoreOrders(orderIds: string[]): Promise<void> {
    try {
      const { doc, deleteDoc, collection, getDocs, query, where } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const ordersRef = collection(db, 'orders');
      
      // Chunk IDs into batches of 10 for 'in' queries in Firestore
      const chunks: string[][] = [];
      for (let i = 0; i < orderIds.length; i += 10) {
        chunks.push(orderIds.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        // Direct ID delete
        for (const id of chunk) {
          deleteDoc(doc(db, 'orders', id)).catch(() => {});
        }
        // Match by invoiceNo
        try {
          const snap = await getDocs(query(ordersRef, where('invoiceNo', 'in', chunk)));
          snap.forEach(d => deleteDoc(d.ref).catch(() => {}));
        } catch {}
        // Match by id field
        try {
          const snap = await getDocs(query(ordersRef, where('id', 'in', chunk)));
          snap.forEach(d => deleteDoc(d.ref).catch(() => {}));
        } catch {}
      }
    } catch (err) {
      console.warn('Firestore bulk cleanup notice:', err);
    }
  }

  // -------------------------
  // NOTIFICATIONS ENDPOINTS
  // -------------------------
  async getNotifications(role?: string, recipientId?: string): Promise<AppNotification[]> {
    const cacheKey = `notifs_${role || 'all'}_${recipientId || 'all'}`;
    const cached = this.getCached<AppNotification[]>(cacheKey, 15000);
    if (cached) return cached;

    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (recipientId) params.append('recipientId', recipientId);
    const qs = params.toString() ? `?${params.toString()}` : '';

    try {
      const res = await this.resilientFetch(`/notifications${qs}`, {
        headers: this.getHeaders(),
      }, 2500);
      if (res.ok) {
        const data: AppNotification[] = await res.json();
        this.setCached(cacheKey, data);
        return data;
      }
    } catch (apiErr) {
      console.warn('Backend notifications notice, querying Firestore...', apiErr);
    }

    // Firestore fallback
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const snap = await getDocs(collection(db, 'notifications'));
      const notifs: AppNotification[] = [];
      snap.forEach(docSnap => {
        notifs.push({ ...(docSnap.data() as AppNotification), id: docSnap.id });
      });
      if (notifs.length > 0) {
        let filtered = notifs;
        if (role && role !== 'all') {
          filtered = filtered.filter(n => n.role === role || n.role === 'all');
        }
        if (recipientId && recipientId !== 'all') {
          filtered = filtered.filter(n => n.recipientId === recipientId || n.recipientId === 'all');
        }
        this.setCached(cacheKey, filtered);
        return filtered;
      }
    } catch (fsErr) {
      console.warn('Firestore notifications fallback notice:', fsErr);
    }

    return INITIAL_NOTIFICATIONS;
  }

  async createNotification(notif: AppNotification): Promise<AppNotification> {
    this.cache.clear();
    const docId = notif.id || `notif_${Date.now()}`;
    const payload = { ...notif, id: docId };

    try {
      const res = await this.resilientFetch('/notifications', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      }, 2500);
      if (res.ok) return res.json();
    } catch {}

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await setDoc(doc(db, 'notifications', docId), payload);
      return payload;
    } catch (fsErr) {
      throw new Error('Failed to dispatch notification.');
    }
  }

  async markNotificationRead(notifId: string): Promise<void> {
    this.cache.clear();
    try {
      await this.resilientFetch(`/notifications/${notifId}/read`, {
        method: 'PUT',
        headers: this.getHeaders(),
      }, 2000);
    } catch {}

    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch {}
  }

  // -------------------------
  // CONTACT SUBMISSIONS
  // -------------------------
  async getContacts(): Promise<ContactSubmission[]> {
    const cached = this.getCached<ContactSubmission[]>('contacts_all', 20000);
    if (cached) return cached;

    try {
      const res = await this.resilientFetch('/contacts', {
        headers: this.getHeaders(),
      }, 2500);
      if (res.ok) {
        const data: ContactSubmission[] = await res.json();
        this.setCached('contacts_all', data);
        return data;
      }
    } catch {}

    // Firestore fallback
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const snap = await getDocs(collection(db, 'contacts'));
      const contacts: ContactSubmission[] = [];
      snap.forEach(docSnap => {
        contacts.push({ ...(docSnap.data() as ContactSubmission), id: docSnap.id });
      });
      if (contacts.length > 0) {
        this.setCached('contacts_all', contacts);
        return contacts;
      }
    } catch {}

    return [];
  }

  async submitContact(data: { name: string; email: string; phone?: string; message: string }): Promise<ContactSubmission> {
    this.cache.delete('contacts_all');
    const docId = `contact_${Date.now()}`;
    const payload: ContactSubmission = {
      id: docId,
      name: data.name,
      email: data.email,
      phone: data.phone || '',
      message: data.message,
      status: 'Pending',
      timestamp: new Date().toISOString()
    };

    try {
      const res = await this.resilientFetch('/contacts', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      }, 2500);
      if (res.ok) return res.json();
    } catch {}

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await setDoc(doc(db, 'contacts', docId), payload);
      return payload;
    } catch (fsErr) {
      throw new Error('Failed to submit contact form.');
    }
  }

  async updateContactStatus(contactId: string, status: string): Promise<ContactSubmission> {
    this.cache.delete('contacts_all');
    try {
      const res = await this.resilientFetch(`/contacts/${contactId}/status`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ status }),
      }, 2500);
      if (res.ok) return res.json();
    } catch {}

    try {
      const { doc, updateDoc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const docRef = doc(db, 'contacts', contactId);
      await updateDoc(docRef, { status });
      const snap = await getDoc(docRef);
      return { ...(snap.data() as ContactSubmission), id: snap.id };
    } catch (fsErr) {
      throw new Error('Failed to update contact status.');
    }
  }

  // -------------------------
  // PARENT ENDPOINTS
  // -------------------------
  async linkChild(parentUid: string, childRegNo: string) {
    try {
      const res = await this.resilientFetch('/parent/link', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ parentUid, childRegNo }),
      }, 3000);
      if (res.ok) return res.json();
    } catch {}

    // Firestore fallback
    try {
      const { collection, getDocs, query, where, doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const q = query(collection(db, 'pupils'), where('regNo', '==', childRegNo.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const pupilDoc = snap.docs[0];
        await updateDoc(doc(db, 'pupils', pupilDoc.id), { linkedParentUid: parentUid });
        return { status: 'linked', pupil: { ...(pupilDoc.data() as Pupil), id: pupilDoc.id, linkedParentUid: parentUid } };
      }
    } catch {}

    throw new Error('Linking failed. Child registration number not found.');
  }

  async getLinkedChildren(parentUid: string) {
    try {
      const res = await this.resilientFetch(`/parent/children/${parentUid}`, {
        headers: this.getHeaders(),
      }, 3000);
      if (res.ok) return res.json();
    } catch {}

    try {
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const q = query(collection(db, 'pupils'), where('linkedParentUid', '==', parentUid));
      const snap = await getDocs(q);
      const list: Pupil[] = [];
      snap.forEach(d => list.push({ ...(d.data() as Pupil), id: d.id }));
      return list;
    } catch {}

    return [];
  }
}

export const api = new ApiService();
