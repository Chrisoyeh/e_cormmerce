import { Pupil, BookItem, Order, OrderItem, AppNotification, ContactSubmission } from '../types';

const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
const DEFAULT_API = isHttps ? '' : 'http://localhost:8000';
export const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API;

class ApiService {
  private token: string | null = null;

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

  // -------------------------
  // AUTHENTICATION ENDPOINTS
  // -------------------------
  async pupilLogin(credentials: {
    surname: string;
    regNo: string;
    role: 'pupil' | 'parent';
  }): Promise<{ status: string; role: string; user: Pupil }> {
    const res = await fetch(`${API_BASE_URL}/auth/pupil-login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(credentials),
    });
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
    const res = await fetch(`${API_BASE_URL}/auth/admin-login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(credentials),
    });
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
    const params = new URLSearchParams();
    if (classLevel && classLevel !== 'All Classes') params.append('classLevel', classLevel);
    if (search) params.append('search', search);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/students/${qs}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch students list from SQL.');
    return res.json();
  }

  async getStudent(uid: string): Promise<Pupil> {
    const res = await fetch(`${API_BASE_URL}/students/${uid}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to retrieve student profile.');
    return res.json();
  }

  async createStudent(studentData: Omit<Pupil, 'id'> | Pupil): Promise<Pupil> {
    const res = await fetch(`${API_BASE_URL}/students/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(studentData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create student.' }));
      throw new Error(err.detail || 'Failed to create student record.');
    }
    return res.json();
  }

  async createPupilsBulk(students: Pupil[]): Promise<{ inserted: number; skipped?: number; updated?: number; totalProcessed: number }> {
    const res = await fetch(`${API_BASE_URL}/students/bulk`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ students }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Bulk upload failed.' }));
      throw new Error(err.detail || 'Failed to perform bulk upload.');
    }
    return res.json();
  }

  async updatePupil(studentId: string, data: Partial<Pupil>): Promise<Pupil> {
    const res = await fetch(`${API_BASE_URL}/students/${studentId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update student profile.');
    return res.json();
  }

  async deletePupil(studentId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/students/${studentId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete student profile.');
  }

  async deleteClassPupils(classLevel: string): Promise<{ count: number }> {
    const res = await fetch(`${API_BASE_URL}/students/class/${encodeURIComponent(classLevel)}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to delete class ${classLevel}.`);
    return res.json();
  }

  async logAttendance(attendance: {
    studentId: string;
    date: string;
    classLevel: string;
    status: 'Present' | 'Absent' | 'Late';
  }) {
    const res = await fetch(`${API_BASE_URL}/students/attendance`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(attendance),
    });
    if (!res.ok) throw new Error('Failed to log attendance checkmark.');
    return res.json();
  }

  // -------------------------
  // SCHOOL STORE ENDPOINTS
  // -------------------------
  async getInventory(): Promise<BookItem[]> {
    const res = await fetch(`${API_BASE_URL}/store/inventory`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch inventory catalog.');
    return res.json();
  }

  async addBook(book: BookItem): Promise<BookItem> {
    const res = await fetch(`${API_BASE_URL}/store/inventory`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(book),
    });
    if (!res.ok) throw new Error('Failed to add book to store.');
    return res.json();
  }

  async updateBook(bookId: string, book: BookItem): Promise<BookItem> {
    const res = await fetch(`${API_BASE_URL}/store/inventory/${bookId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(book),
    });
    if (!res.ok) throw new Error('Failed to update book item.');
    return res.json();
  }

  async deleteBook(bookId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/store/inventory/${bookId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
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
    const res = await fetch(`${API_BASE_URL}/store/checkout`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(checkoutData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Checkout failed.' }));
      throw new Error(err.detail || 'Checkout failed.');
    }
    return res.json();
  }

  async getOrders(pupilId?: string): Promise<Order[]> {
    const url = pupilId ? `${API_BASE_URL}/store/orders?pupilId=${encodeURIComponent(pupilId)}` : `${API_BASE_URL}/store/orders`;
    const res = await fetch(url, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch orders ledger.');
    return res.json();
  }

  async updateOrder(orderId: string, data: Partial<Order>): Promise<Order> {
    const res = await fetch(`${API_BASE_URL}/store/orders/${orderId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update order status.');
    return res.json();
  }

  // -------------------------
  // NOTIFICATIONS ENDPOINTS
  // -------------------------
  async getNotifications(role?: string, recipientId?: string): Promise<AppNotification[]> {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (recipientId) params.append('recipientId', recipientId);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_BASE_URL}/notifications/${qs}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch notifications.');
    return res.json();
  }

  async createNotification(notif: AppNotification): Promise<AppNotification> {
    const res = await fetch(`${API_BASE_URL}/notifications/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(notif),
    });
    if (!res.ok) throw new Error('Failed to dispatch notification.');
    return res.json();
  }

  async markNotificationRead(notifId: string): Promise<void> {
    await fetch(`${API_BASE_URL}/notifications/${notifId}/read`, {
      method: 'PUT',
      headers: this.getHeaders(),
    });
  }

  // -------------------------
  // CONTACT SUBMISSIONS
  // -------------------------
  async getContacts(): Promise<ContactSubmission[]> {
    const res = await fetch(`${API_BASE_URL}/contacts/`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch contact submissions.');
    return res.json();
  }

  async submitContact(data: { name: string; email: string; phone?: string; message: string }): Promise<ContactSubmission> {
    const res = await fetch(`${API_BASE_URL}/contacts/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to submit contact form.');
    return res.json();
  }

  async updateContactStatus(contactId: string, status: string): Promise<ContactSubmission> {
    const res = await fetch(`${API_BASE_URL}/contacts/${contactId}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update contact status.');
    return res.json();
  }

  // -------------------------
  // PARENT ENDPOINTS
  // -------------------------
  async linkChild(parentUid: string, childRegNo: string) {
    const res = await fetch(`${API_BASE_URL}/parent/link`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ parentUid, childRegNo }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Linking failed.' }));
      throw new Error(err.detail || 'Linking failed.');
    }
    return res.json();
  }

  async getLinkedChildren(parentUid: string) {
    const res = await fetch(`${API_BASE_URL}/parent/children/${parentUid}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch linked children profiles.');
    return res.json();
  }
}

export const api = new ApiService();
