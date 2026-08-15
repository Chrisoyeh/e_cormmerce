export type ClassLevel =
  | 'Kindergarten'
  | 'Pre-Nursery'
  | 'Prep 1'
  | 'Prep 2'
  | 'Primary 1'
  | 'Primary 2'
  | 'Primary 3'
  | 'Primary 4'
  | 'Primary 5'
  | 'Primary 6';

export interface Pupil {
  id: string;
  surname: string;
  firstName: string;
  regNo: string;
  classLevel: ClassLevel;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
}

export interface BookItem {
  id: string;
  title: string;
  author: string;
  price: number;
  classLevel: ClassLevel;
  category: 'Textbook' | 'Notebook' | 'Stationery' | 'Uniform' | 'Utility';
  stock: number;
  imageUrl?: string;
  description: string;
  shoeSize?: string;
  uniformSize?: string;
}

export interface OrderItem {
  bookId: string;
  title: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  pupilId: string;
  pupilName: string;
  pupilRegNo: string;
  classLevel: ClassLevel;
  items: OrderItem[];
  totalAmount: number;
  status: 'Pending Approved' | 'Processing' | 'Ready for Pickup' | 'Completed' | 'Cancelled';
  date: string; // ISO String
  invoiceNo: string;
  paymentMethod?: 'online' | 'bank';
  paymentReceiptUrl?: string;
  receiptFileName?: string;
  receiptUploadedAt?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'report_delivery';
  timestamp: string;
  read: boolean;
  role: 'admin' | 'pupil' | 'parent';
  recipientId?: string; // e.g., pupilRegNo or 'all'
}

export interface AppUser {
  id: string;
  username: string;
  role: 'admin' | 'pupil' | 'parent' | 'faculty';
  displayName: string;
  additionalId?: string; // pupilRegNo or classLevel
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  timestamp: string; // ISO String
  status: 'Pending' | 'Read' | 'Resolved';
}
