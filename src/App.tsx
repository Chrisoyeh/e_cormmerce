/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { Pupil, BookItem, Order, AppNotification, ContactSubmission } from './types';
import { INITIAL_PUPILS, INITIAL_BOOKS, INITIAL_ORDERS, INITIAL_NOTIFICATIONS, INITIAL_CONTACTS } from './data/initialData';
import { collection, onSnapshot, getDocs, getDoc, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const PupilDashboard = lazy(() => import('./components/PupilDashboard').then(m => ({ default: m.PupilDashboard })));
const ParentDashboard = lazy(() => import('./components/ParentDashboard').then(m => ({ default: m.ParentDashboard })));
const GDPRConsent = lazy(() => import('./components/GDPRConsent').then(m => ({ default: m.GDPRConsent })));

const ViewLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 py-16 gap-3 animate-pulse">
    <div className="w-8 h-8 border-3 border-[#2D346C] border-t-transparent rounded-full animate-spin" />
    <p className="text-xs font-semibold tracking-wide">Loading view module…</p>
  </div>
);

// Helper to seed a single Firestore collection if empty
async function seedCollectionIfEmpty<T extends { id: string }>(
  collectionName: string,
  initialData: T[]
) {
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      console.log(`Seeding ${collectionName} with ${initialData.length} items...`);
      const batch = writeBatch(db);
      initialData.forEach((item) => {
        const docRef = doc(db, collectionName, item.id);
        batch.set(docRef, item);
      });
      await batch.commit();
    }
  } catch (err) {
    console.error(`Error seeding ${collectionName}:`, err);
  }
}

export default function App() {
  // State elements
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [contacts, setContacts] = useState<ContactSubmission[]>([]);

  // Loading state — true once the first pupils snapshot arrives
  const [dataReady, setDataReady] = useState(false);

  // Auth/Router states
  const [activeRole, setActiveRole] = useState<'landing' | 'admin' | 'pupil' | 'parent'>('landing');
  const [activeUser, setActiveUser] = useState<any>(null);  // 1. Initial public initialization: Load public book catalog only
  useEffect(() => {
    const initPublicData = async () => {
      try {
        const seedFlagDoc = await getDoc(doc(db, 'system', 'seeded'));
        if (!seedFlagDoc.exists()) {
          await seedCollectionIfEmpty('books', INITIAL_BOOKS);
          await seedCollectionIfEmpty('pupils', INITIAL_PUPILS);
          await seedCollectionIfEmpty('orders', INITIAL_ORDERS);
          await seedCollectionIfEmpty('notifications', INITIAL_NOTIFICATIONS);
          await seedCollectionIfEmpty('contacts', INITIAL_CONTACTS);
          await setDoc(doc(db, 'system', 'seeded'), { seeded: true });
        }
      } catch (err) {
        console.warn('System initialization note:', err);
      }
    };

    initPublicData();

    // Books / Stock Catalog is public
    const unsubBooks = onSnapshot(
      collection(db, 'books'),
      (snapshot) => {
        const list: BookItem[] = [];
        snapshot.forEach((docSnap) => list.push(docSnap.data() as BookItem));
        setBooks(list);
        setDataReady(true);
      },
      (err) => {
        console.warn('Books snapshot notice:', err.message);
        setDataReady(true);
      }
    );

    return () => {
      unsubBooks();
    };
  }, []);

  // 2. Protected Data Loading: Subscribe to sensitive collections ONLY when authenticated
  useEffect(() => {
    if (activeRole === 'landing' || !activeUser) {
      // Clear sensitive state in memory on logout or unauthenticated state
      setPupils([]);
      setOrders([]);
      setNotifications([]);
      setContacts([]);
      return;
    }

    const unsubs: (() => void)[] = [];

    // Admin Role: Full access to administrative collections
    if (activeRole === 'admin') {
      const unsubPupils = onSnapshot(collection(db, 'pupils'), (snapshot) => {
        const list: Pupil[] = [];
        snapshot.forEach((docSnap) => list.push(docSnap.data() as Pupil));
        setPupils(list);
      });
      unsubs.push(unsubPupils);

      const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach((docSnap) => list.push(docSnap.data() as Order));
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setOrders(list);
      });
      unsubs.push(unsubOrders);

      const unsubNotifications = onSnapshot(collection(db, 'notifications'), (snapshot) => {
        const list: AppNotification[] = [];
        snapshot.forEach((docSnap) => list.push(docSnap.data() as AppNotification));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setNotifications(list);
      });
      unsubs.push(unsubNotifications);

      const unsubContacts = onSnapshot(collection(db, 'contacts'), (snapshot) => {
        const list: ContactSubmission[] = [];
        snapshot.forEach((docSnap) => list.push(docSnap.data() as ContactSubmission));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setContacts(list);
      });
      unsubs.push(unsubContacts);
    } 
    // Pupil / Parent Role: Fetch only relevant orders and notifications
    else {
      const pupilId = activeUser?.id || activeUser?.uid;
      const pupilReg = activeUser?.regNo;

      const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach((docSnap) => {
          const ord = docSnap.data() as Order;
          if (ord.pupilId === pupilId || ord.pupilRegNo === pupilReg) {
            list.push(ord);
          }
        });
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setOrders(list);
      });
      unsubs.push(unsubOrders);

      const unsubNotifications = onSnapshot(collection(db, 'notifications'), (snapshot) => {
        const list: AppNotification[] = [];
        snapshot.forEach((docSnap) => {
          const notif = docSnap.data() as AppNotification;
          const targetRole = activeRole === 'pupil' ? 'pupil' : 'parent';
          if (
            (notif.role === targetRole || notif.role === 'all') &&
            (notif.recipientId === 'all' || notif.recipientId === pupilReg || !notif.recipientId)
          ) {
            list.push(notif);
          }
        });
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setNotifications(list);
      });
      unsubs.push(unsubNotifications);
    }

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [activeRole, activeUser]);

  // Sync helper that updates only diffs in Firestore
  const syncCollection = async <T extends { id: string }>(
    collectionName: string,
    updatedList: T[],
    currentList: T[],
    allowDeletes = true
  ) => {
    try {
      const batch = writeBatch(db);
      let operations = 0;

      // 1. Add or update items from updatedList
      const currentMap = new Map(currentList.map(item => [item.id, item]));
      for (const item of updatedList) {
        const existing = currentMap.get(item.id);
        if (!existing || JSON.stringify(existing) !== JSON.stringify(item)) {
          const docRef = doc(db, collectionName, item.id);
          batch.set(docRef, item);
          operations++;
        }
      }

      // 2. Delete items that are no longer in updatedList (fetch real collection docs to ensure complete purge)
      if (allowDeletes) {
        const updatedIds = new Set(updatedList.map(item => item.id));
        const snap = await getDocs(collection(db, collectionName));
        snap.forEach(docSnap => {
          if (!updatedIds.has(docSnap.id)) {
            batch.delete(docSnap.ref);
            operations++;
          }
        });
      }

      if (operations > 0) {
        await batch.commit();
      }
    } catch (err) {
      console.error(`Syncing ${collectionName} failed: `, err);
    }
  };

  // Sync state helpers
  const handleUpdatePupils = async (updatedList: Pupil[]) => {
    setPupils(updatedList);
    await syncCollection('pupils', updatedList, pupils, activeRole === 'admin');
  };

  const handleUpdateBooks = async (updatedList: BookItem[]) => {
    setBooks(updatedList);
    await syncCollection('books', updatedList, books, activeRole === 'admin');
  };

  const handleUpdateOrders = async (updatedList: Order[]) => {
    setOrders(updatedList);
    // Non-admin roles (pupil/parent) only upsert their own orders without deleting other students' orders
    await syncCollection('orders', updatedList, orders, activeRole === 'admin');
  };

  const handleUpdateNotifications = async (updatedList: AppNotification[]) => {
    setNotifications(updatedList);
    await syncCollection('notifications', updatedList, notifications, activeRole === 'admin');
  };

  const handleUpdateContacts = async (updatedList: ContactSubmission[]) => {
    setContacts(updatedList);
    await syncCollection('contacts', updatedList, contacts);
  };

  const handleSystemPurge = async () => {
    const collections = ['pupils', 'books', 'orders', 'notifications', 'contacts'];
    for (const name of collections) {
      try {
        const snap = await getDocs(collection(db, name));
        const batch = writeBatch(db);
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      } catch (err) {
        console.error(`Purging ${name} failed: `, err);
      }
    }
    // Ensure the seeded flag remains set to true so that the app does not reseed on next load.
    try {
      await setDoc(doc(db, 'system', 'seeded'), { seeded: true });
      console.log('Seed flag maintained after purge.');
    } catch (err) {
      console.error('Failed to set seed flag after purge:', err);
    }
  };

  // Impersonation state for Registrar view switcher
  const [impersonator, setImpersonator] = useState<any | null>(null);

  const handleLogin = (role: 'admin' | 'pupil' | 'parent', user: any) => {
    setActiveRole(role);
    setActiveUser(user);
    setImpersonator(null);

    // Smooth scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    setActiveRole('landing');
    setActiveUser(null);
    setImpersonator(null);
  };

  const handleStartImpersonating = (role: 'pupil' | 'parent', pupil: Pupil) => {
    setImpersonator(activeUser || { username: 'admin', displayName: 'School Registrar' });
    setActiveRole(role);
    setActiveUser(pupil);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStopImpersonating = () => {
    if (impersonator) {
      setActiveRole('admin');
      setActiveUser(impersonator);
      setImpersonator(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="font-sans antialiased bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 min-h-screen" id="applet-core-canvas">
      {/* Dynamic sticky header for Registrar View Impersonation */}
      {impersonator && (
        <div className="bg-[#E37180] text-white text-xs font-bold px-4 py-2.5 flex justify-between items-center z-50 sticky top-0 shadow-md border-b border-[#1e2348]" id="registrar-impersonation-banner">
          <div className="flex items-center gap-2 flex-wrap text-left">
            <span className="bg-[#2D346C] text-white px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
              Registrar View Mode
            </span>
            <span>
              Viewing portal as <strong className="underline">{activeUser?.firstName} {activeUser?.surname}</strong> ({activeRole === 'pupil' ? 'Pupil' : 'Parent'})
            </span>
          </div>
          <button
            onClick={handleStopImpersonating}
            className="bg-white hover:bg-slate-100 text-[#E37180] font-bold px-3 py-1 rounded-lg transition cursor-pointer"
          >
            Return to Admin Dashboard
          </button>
        </div>
      )}

      {/* Dynamic View Router switch */}
      <Suspense fallback={<ViewLoadingFallback />}>
        {activeRole === 'landing' && !dataReady && (
          <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white gap-4" id="app-loading-screen">
            <div className="w-10 h-10 border-4 border-[#2D346C] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-400 tracking-wide">Connecting to school portal…</p>
          </div>
        )}

        {activeRole === 'landing' && dataReady && (
          <LandingPage
            pupils={pupils}
            books={books}
            orders={orders}
            onLogin={handleLogin}
            onSubmitContact={async (submission) => {
              const newContact: ContactSubmission = {
                id: 'cnt-' + Date.now(),
                ...submission,
                timestamp: new Date().toISOString(),
                status: 'Pending'
              };
              const updated = [newContact, ...contacts];
              await handleUpdateContacts(updated);
            }}
          />
        )}

        {activeRole === 'admin' && (
          activeUser?.username === 'admin' ? (
            <AdminDashboard
              books={books}
              pupils={pupils}
              orders={orders}
              notifications={notifications}
              contacts={contacts}
              onUpdateBooks={handleUpdateBooks}
              onUpdatePupils={handleUpdatePupils}
              onUpdateOrders={handleUpdateOrders}
              onUpdateNotifications={handleUpdateNotifications}
              onUpdateContacts={handleUpdateContacts}
              onLogout={handleLogout}
              onSystemPurge={handleSystemPurge}
              onImpersonate={handleStartImpersonating}
            />
          ) : (
            <div className="p-12 text-center flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
              <span className="text-4xl mb-4">🛡️</span>
              <h1 className="text-xl font-bold">Access Restricted</h1>
              <p className="text-xs text-slate-400 mt-2">Only the School Registrar can access the administrative interface.</p>
              <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-[#E37180] hover:bg-[#2D346C] rounded-lg text-xs font-bold transition">Return to Login</button>
            </div>
          )
        )}

        {activeRole === 'pupil' && activeUser && (
          <PupilDashboard
            pupil={activeUser}
            books={books}
            orders={orders}
            notifications={notifications}
            onUpdateOrders={handleUpdateOrders}
            onUpdateNotifications={handleUpdateNotifications}
            onUpdateBooks={handleUpdateBooks}
            onLogout={handleLogout}
          />
        )}

        {activeRole === 'parent' && activeUser && (
          <ParentDashboard
            pupil={activeUser}
            orders={orders}
            notifications={notifications}
            onUpdateNotifications={handleUpdateNotifications}
            onUpdateOrders={handleUpdateOrders}
            onLogout={handleLogout}
          />
        )}

        {/* Global GDPR Consent Banner Widget */}
        <GDPRConsent />
      </Suspense>
    </div>
  );
}
