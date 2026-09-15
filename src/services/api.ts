import { Pupil, BookItem, Order, OrderItem, AppNotification, ContactSubmission } from '../types';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://nazareth-school-store.onrender.com').replace(/\/$/, '');

class ApiService {
  private token: string | null = null;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

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

  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 25000): Promise<Response> {
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
        throw new Error('Network request timed out. Please check your connection.');
      }
      throw err;
    }
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
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/auth/pupil-login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(credentials),
    }, 6000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Authentication failed.' }));
      throw new Error(err.detail || 'Invalid credentials.');
    }
    return res.json();
  }

  async adminLogin(credentials: {
    username: string;
    password: string;
  }): Promise<{ status: string; role: string; user: any }> {
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/auth/admin-login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(credentials),
    }, 6000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Invalid credentials.' }));
      throw new Error(err.detail || 'Invalid Registrar credentials.');
    }
    return res.json();
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
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/students${qs}`, {
      headers: this.getHeaders(),
    }, 30000);
    if (!res.ok) throw new Error('Failed to fetch students list from SQL.');
    const data: Pupil[] = await res.json();
    this.setCached(cacheKey, data);
    return data;
  }

  async getStudent(uid: string): Promise<Pupil> {
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/students/${uid}`, {
      headers: this.getHeaders(),
    }, 6000);
    if (!res.ok) throw new Error('Failed to retrieve student profile.');
    return res.json();
  }

  async createStudent(studentData: Omit<Pupil, 'id'> | Pupil): Promise<Pupil> {
    this.cache.clear();
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/students`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(studentData),
    }, 10000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create student.' }));
      throw new Error(err.detail || 'Failed to create student record.');
    }
    return res.json();
  }

  async createPupilsBulk(students: Pupil[]): Promise<{ inserted: number; skipped?: number; updated?: number; totalProcessed: number }> {
    this.cache.clear();
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/students/bulk`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ students }),
    }, 15000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Bulk upload failed.' }));
      throw new Error(err.detail || 'Failed to perform bulk upload.');
    }
    return res.json();
  }

  async updatePupil(studentId: string, data: Partial<Pupil>): Promise<Pupil> {
    this.cache.clear();
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/students/${studentId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    }, 8000);
    if (!res.ok) throw new Error('Failed to update student profile.');
    return res.json();
  }

  async deletePupil(studentId: string): Promise<void> {
    this.cache.clear();
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/students/${studentId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    }, 8000);
    if (!res.ok) throw new Error('Failed to delete student profile.');
  }

  async deleteClassPupils(classLevel: string): Promise<{ count: number }> {
    this.cache.clear();
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/students/class/${encodeURIComponent(classLevel)}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    }, 10000);
    if (!res.ok) throw new Error(`Failed to delete class ${classLevel}.`);
    return res.json();
  }

  async logAttendance(attendance: {
    studentId: string;
    date: string;
    classLevel: string;
    status: 'Present' | 'Absent' | 'Late';
  }) {
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/students/attendance`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(attendance),
    }, 6000);
    if (!res.ok) throw new Error('Failed to log attendance checkmark.');
    return res.json();
  }

  // -------------------------
  // SCHOOL STORE ENDPOINTS
  // -------------------------
  async getInventory(): Promise<BookItem[]> {
    const cached = this.getCached<BookItem[]>('inventory_catalog', 30000);
    if (cached) return cached;

    const res = await this.fetchWithTimeout(`${API_BASE_URL}/store/inventory`, {
      headers: this.getHeaders(),
    }, 6000);
    if (!res.ok) throw new Error('Failed to fetch inventory catalog.');
    const data: BookItem[] = await res.json();
    this.setCached('inventory_catalog', data);
    return data;
  }

  async addBook(book: BookItem): Promise<BookItem> {
    this.cache.delete('inventory_catalog');
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/store/inventory`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(book),
    }, 8000);
    if (!res.ok) throw new Error('Failed to add book to store.');
    return res.json();
  }

  async updateBook(bookId: string, book: BookItem): Promise<BookItem> {
    this.cache.delete('inventory_catalog');
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/store/inventory/${bookId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(book),
    }, 8000);
    if (!res.ok) throw new Error('Failed to update book item.');
    return res.json();
  }

  async deleteBook(bookId: string): Promise<void> {
    this.cache.delete('inventory_catalog');
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/store/inventory/${bookId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    }, 8000);
    if (!res.ok) throw new Error('Failed to remove book item.');
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
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/store/checkout`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(checkoutData),
    }, 10000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Checkout failed.' }));
      throw new Error(err.detail || 'Checkout failed.');
    }
    return res.json();
  }

  async getOrders(pupilId?: string, pupilRegNo?: string): Promise<Order[]> {
    const cacheKey = pupilId || pupilRegNo ? `orders_${pupilId || ''}_${pupilRegNo || ''}` : 'orders_all';
    const cached = this.getCached<Order[]>(cacheKey, 15000);
    if (cached) return cached;

    const params = new URLSearchParams();
    if (pupilId) params.append('pupilId', pupilId);
    if (pupilRegNo) params.append('pupilRegNo', pupilRegNo);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const url = `${API_BASE_URL}/store/orders${qs}`;
    const res = await this.fetchWithTimeout(url, {
      headers: this.getHeaders(),
    }, 30000);
    if (!res.ok) throw new Error('Failed to fetch orders ledger.');
    const data: Order[] = await res.json();
    this.setCached(cacheKey, data);
    return data;
  }

  async getOrder(orderId: string): Promise<Order> {
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/store/orders/${orderId}`, {
      headers: this.getHeaders(),
    }, 25000);
    if (!res.ok) throw new Error('Failed to retrieve order details.');
    return res.json();
  }

  async syncOrder(order: Order): Promise<Order> {
    this.cache.clear();
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/store/orders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(order),
    }, 25000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to sync order.' }));
      throw new Error(err.detail || 'Failed to sync order.');
    }
    return res.json();
  }

  async updateOrder(orderId: string, data: Partial<Order>): Promise<Order> {
    this.cache.clear();
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/store/orders/${orderId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    }, 25000);
    if (!res.ok) throw new Error('Failed to update order status.');
    return res.json();
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

    const res = await this.fetchWithTimeout(`${API_BASE_URL}/notifications${qs}`, {
      headers: this.getHeaders(),
    }, 6000);
    if (!res.ok) throw new Error('Failed to fetch notifications.');
    const data: AppNotification[] = await res.json();
    this.setCached(cacheKey, data);
    return data;
  }

  async createNotification(notif: AppNotification): Promise<AppNotification> {
    this.cache.clear();
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/notifications`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(notif),
    }, 6000);
    if (!res.ok) throw new Error('Failed to dispatch notification.');
    return res.json();
  }

  async markNotificationRead(notifId: string): Promise<void> {
    this.cache.clear();
    await this.fetchWithTimeout(`${API_BASE_URL}/notifications/${notifId}/read`, {
      method: 'PUT',
      headers: this.getHeaders(),
    }, 5000);
  }

  // -------------------------
  // CONTACT SUBMISSIONS
  // -------------------------
  async getContacts(): Promise<ContactSubmission[]> {
    const cached = this.getCached<ContactSubmission[]>('contacts_all', 20000);
    if (cached) return cached;

    const res = await this.fetchWithTimeout(`${API_BASE_URL}/contacts`, {
      headers: this.getHeaders(),
    }, 6000);
    if (!res.ok) throw new Error('Failed to fetch contact submissions.');
    const data: ContactSubmission[] = await res.json();
    this.setCached('contacts_all', data);
    return data;
  }

  async submitContact(data: { name: string; email: string; phone?: string; message: string }): Promise<ContactSubmission> {
    this.cache.delete('contacts_all');
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/contacts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    }, 8000);
    if (!res.ok) throw new Error('Failed to submit contact form.');
    return res.json();
  }

  async updateContactStatus(contactId: string, status: string): Promise<ContactSubmission> {
    this.cache.delete('contacts_all');
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/contacts/${contactId}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    }, 6000);
    if (!res.ok) throw new Error('Failed to update contact status.');
    return res.json();
  }

  // -------------------------
  // PARENT ENDPOINTS
  // -------------------------
  async linkChild(parentUid: string, childRegNo: string) {
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/parent/link`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ parentUid, childRegNo }),
    }, 8000);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Linking failed.' }));
      throw new Error(err.detail || 'Linking failed.');
    }
    return res.json();
  }

  async getLinkedChildren(parentUid: string) {
    const res = await this.fetchWithTimeout(`${API_BASE_URL}/parent/children/${parentUid}`, {
      headers: this.getHeaders(),
    }, 6000);
    if (!res.ok) throw new Error('Failed to fetch linked children profiles.');
    return res.json();
  }
}

export const api = new ApiService();
