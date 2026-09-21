import { BookItem, Pupil, Order, AppNotification, ContactSubmission } from '../types';

export const INITIAL_BOOKS: BookItem[] = [];

export const INITIAL_PUPILS: Pupil[] = [];

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'not1',
    title: 'System Registry Live',
    message: 'PostgreSQL database connected and operational.',
    type: 'success',
    timestamp: new Date().toISOString(),
    read: true,
    role: 'admin',
  },
];

export const INITIAL_CONTACTS: ContactSubmission[] = [];
