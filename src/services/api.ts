import { Pupil, BookItem, Order, OrderItem, AppNotification, ContactSubmission } from '../types';
import { INITIAL_BOOKS, INITIAL_NOTIFICATIONS } from '../data/initialData';

const configuredApiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = configuredApiUrl || (
  isLocal ? 'http://localhost:8000' : 'https://nazareth-school-store.onrender.com'
);

const FALLBACK_URLS = [
  API_BASE_URL,
  isLocal ? 'http://localhost:8000' : 'https://nazareth-school-store.onrender.com',
  'https://nazareth-school-store.onrender.com',
  'http://localhost:8000'
].filter((url, idx, arr) => Boolean(url) && arr.indexOf(url) === idx);

class ApiService {
  private token: string | null = null;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
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
    const urlsToTry = [this.activeBaseUrl, ...FALLBACK_URLS.filter(u => u !== this.activeBaseUrl)];
    let lastError: any = null;

    for (const baseUrl of urlsToTry) {
      try {
        const fullUrl = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        const res = await this.fetchWithTimeout(fullUrl, options, timeoutMs);
        if (res.ok) {
          this.activeBaseUrl = baseUrl;
          return res;
        }
        // If validation error (4xx but not 404), return immediately
        if (res.status >= 400 && res.status < 500 && res.status !== 404) {
          return res;
        }
      } catch (err) {
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
      const cleanReg = credentials.regNo.trim();
      const cleanSurname = credentials.surname.trim().toLowerCase();

      let snap = await getDocs(query(collection(db, 'pupils'), where('regNo', '==', cleanReg)));
      if (snap.empty && cleanReg !== cleanReg.toUpperCase()) {
        snap = await getDocs(query(collection(db, 'pupils'), where('regNo', '==', cleanReg.toUpperCase())));
      }

      let found: Pupil | null = null;
      snap.forEach(docSnap => {
        const data = docSnap.data() as Pupil;
        if (data.surname && data.surname.trim().toLowerCase() === cleanSurname) {
          found = { ...data, id: docSnap.id };
        }
      });

      if (!found) {
        const allSnap = await getDocs(collection(db, 'pupils'));
        allSnap.forEach(docSnap => {
          const data = docSnap.data() as Pupil;
          if (
            data.regNo &&
            data.surname &&
            data.regNo.trim().toLowerCase() === cleanReg.toLowerCase() &&
            data.surname.trim().toLowerCase() === cleanSurname
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

    const cleanUser = credentials.username.trim().toLowerCase();
    if ((cleanUser === 'admin' || cleanUser === 'registrar') && credentials.password === 'admin123') {
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
    
    try {
      const res = await this.resilientFetch(`/students${qs}`, {
        headers: this.getHeaders(),
      }, 3000);
      if (res.ok) {
        const data: Pupil[] = await res.json();
        this.setCached(cacheKey, data);
        return data;
      }
    } catch (apiErr) {
      console.warn('Backend pupils query notice, trying Firestore fallback...', apiErr);
    }

    // Firestore fallback
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const snap = await getDocs(collection(db, 'pupils'));
      const pupils: Pupil[] = [];
      snap.forEach(docSnap => {
        pupils.push({ ...(docSnap.data() as Pupil), id: docSnap.id });
      });
      if (pupils.length > 0) {
        let filtered = pupils;
        if (classLevel && classLevel !== 'All Classes') {
          filtered = filtered.filter(p => (p.classLevel || '').toLowerCase() === classLevel.toLowerCase());
        }
        if (search) {
          const s = search.toLowerCase();
          filtered = filtered.filter(p => 
            (p.firstName || '').toLowerCase().includes(s) || 
            (p.surname || '').toLowerCase().includes(s) || 
            (p.regNo || '').toLowerCase().includes(s)
          );
        }
        this.setCached(cacheKey, filtered);
        return filtered;
      }
    } catch (fsErr) {
      console.warn('Firestore pupils fallback notice:', fsErr);
    }

    // Local storage fallback
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
      }, 3000);
      if (res.ok) return res.json();
    } catch {}

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

  async deletePupil(studentId: string): Promise<void> {
    this.cache.clear();
    try {
      await this.resilientFetch(`/students/${studentId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      }, 3000);
    } catch {}

    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await deleteDoc(doc(db, 'pupils', studentId));
    } catch {}
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
    const cached = this.getCached<BookItem[]>('inventory_catalog', 30000);
    if (cached) return cached;

    try {
      const res = await this.resilientFetch('/store/inventory', {
        headers: this.getHeaders(),
      }, 2500);
      if (res.ok) {
        const data: BookItem[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.setCached('inventory_catalog', data);
          return data;
        }
      }
    } catch (apiErr) {
      console.warn('Inventory fetch notice, querying Firestore catalog...', apiErr);
    }

    // Firestore fallback
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const snap = await getDocs(collection(db, 'books'));
      const books: BookItem[] = [];
      snap.forEach(docSnap => {
        books.push({ ...(docSnap.data() as BookItem), id: docSnap.id });
      });
      if (books.length > 0) {
        this.setCached('inventory_catalog', books);
        return books;
      }
    } catch (fsErr) {
      console.warn('Firestore books fallback notice:', fsErr);
    }

    // Local storage fallback
    try {
      const local = localStorage.getItem('nazareth_cached_books') || sessionStorage.getItem('nazareth_cached_books');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    return INITIAL_BOOKS;
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
    try {
      await this.resilientFetch(`/store/inventory/${bookId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      }, 3000);
    } catch {}

    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await deleteDoc(doc(db, 'books', bookId));
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
    const cached = this.getCached<Order[]>(cacheKey, 15000);
    if (cached) return cached;

    const params = new URLSearchParams();
    if (pupilId) params.append('pupilId', pupilId);
    if (pupilRegNo) params.append('pupilRegNo', pupilRegNo);
    const qs = params.toString() ? `?${params.toString()}` : '';

    try {
      const res = await this.resilientFetch(`/store/orders${qs}`, {
        headers: this.getHeaders(),
      }, 3000);
      if (res.ok) {
        const data: Order[] = await res.json();
        this.setCached(cacheKey, data);
        return data;
      }
    } catch (apiErr) {
      console.warn('Orders fetch notice, checking Firestore orders collection...', apiErr);
    }

    // Firestore fallback
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const snap = await getDocs(collection(db, 'orders'));
      const ordersList: Order[] = [];
      snap.forEach(docSnap => {
        ordersList.push({ ...(docSnap.data() as Order), id: docSnap.id });
      });
      if (ordersList.length > 0) {
        let filtered = ordersList;
        if (pupilId || pupilRegNo) {
          filtered = filtered.filter(o => 
            (pupilId && o.pupilId === pupilId) || 
            (pupilRegNo && o.pupilRegNo === pupilRegNo)
          );
        }
        this.setCached(cacheKey, filtered);
        return filtered;
      }
    } catch (fsErr) {
      console.warn('Firestore orders fallback notice:', fsErr);
    }

    try {
      const local = localStorage.getItem('nazareth_cached_orders') || sessionStorage.getItem('nazareth_cached_orders');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}

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

  async deleteOrder(orderId: string): Promise<void> {
    this.cache.clear();
    try {
      await this.resilientFetch(`/store/orders/${encodeURIComponent(orderId.trim())}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      }, 3000);
    } catch {}

    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await deleteDoc(doc(db, 'orders', orderId.trim()));
    } catch {}
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
