import { Pupil, BookItem, OrderItem } from '../types';

const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
const DEFAULT_API = isHttps ? '' : 'http://localhost:8000';
const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API;

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
  // AUTH ENTICATION ENDPOINTS
  // -------------------------
  async registerUser(userData: {
    email: string;
    password?: string;
    displayName: string;
    role: 'admin' | 'student' | 'parent';
    associatedId?: string;
  }) {
    if (!API_BASE_URL) {
      throw new Error('Backend API URL is not configured.');
    }
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Registration failed.');
    }
    return res.json();
  }

  async pupilLogin(credentials: {
    surname: string;
    regNo: string;
    role: 'pupil' | 'parent';
  }): Promise<{ status: string; role: string; user: Pupil }> {
    if (!API_BASE_URL) {
      throw new Error('Direct Firestore authentication fallback.');
    }
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

  // -------------------------
  // STUDENT ENDPOINTS
  // -------------------------
  async getStudent(uid: string) {
    const res = await fetch(`${API_BASE_URL}/students/${uid}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to retrieve student profile.');
    return res.json();
  }

  async createStudent(studentData: Omit<Pupil, 'id'>) {
    const res = await fetch(`${API_BASE_URL}/students/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(studentData),
    });
    if (!res.ok) throw new Error('Failed to create student record.');
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
  // PARENT ENDPOINTS
  // -------------------------
  async linkChild(parentUid: string, childRegNo: string) {
    const res = await fetch(`${API_BASE_URL}/parent/link`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ parentUid, childRegNo }),
    });
    if (!res.ok) {
      const err = await res.json();
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

  // -------------------------
  // SCHOOL STORE ENDPOINTS
  // -------------------------
  async checkoutCart(checkoutData: {
    pupilId: string;
    pupilName: string;
    pupilRegNo: string;
    classLevel: string;
    items: OrderItem[];
    paymentMethod: 'online' | 'bank';
  }) {
    const res = await fetch(`${API_BASE_URL}/store/checkout`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(checkoutData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Checkout failed.');
    }
    return res.json();
  }

  async updateOrderStatus(orderId: string, status: string) {
    const res = await fetch(`${API_BASE_URL}/store/orders/${orderId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to adjust invoice status.');
    return res.json();
  }
}

export const api = new ApiService();
