/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { Pupil, BookItem, Order, AppNotification, ContactSubmission } from './types';
import { INITIAL_PUPILS, INITIAL_BOOKS, INITIAL_ORDERS, INITIAL_NOTIFICATIONS, INITIAL_CONTACTS } from './data/initialData';
import { api } from './services/api';
import { LandingPage } from './components/LandingPage';
import { GDPRConsent } from './components/GDPRConsent';

const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const PupilDashboard = lazy(() => import('./components/PupilDashboard').then(m => ({ default: m.PupilDashboard })));
const ParentDashboard = lazy(() => import('./components/ParentDashboard').then(m => ({ default: m.ParentDashboard })));

const ViewLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 py-16 gap-3 animate-pulse">
    <div className="w-8 h-8 border-3 border-[#2D346C] border-t-transparent rounded-full animate-spin" />
    <p className="text-xs font-semibold tracking-wide">Loading portal view…</p>
  </div>
);

export default function App() {
  // State elements with instant initial cache hydration
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [books, setBooks] = useState<BookItem[]>(() => {
    try {
      const cached = localStorage.getItem('nazareth_cached_books');
      return cached ? JSON.parse(cached) : INITIAL_BOOKS;
    } catch {
      return INITIAL_BOOKS;
    }
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [contacts, setContacts] = useState<ContactSubmission[]>([]);

  // Loading state - immediately ready with instant cached/initial dataset
  const [dataReady, setDataReady] = useState(true);

  // Auth/Router states
  const [activeRole, setActiveRole] = useState<'landing' | 'admin' | 'pupil' | 'parent'>('landing');
  const [activeUser, setActiveUser] = useState<any>(null);

  // 1. Initial public initialization: Background pre-warm & fresh sync
  useEffect(() => {
    let isCancelled = false;

    const fetchPublicBooks = async () => {
      try {
        const catalog = await api.getInventory();
        if (!isCancelled && catalog && catalog.length > 0) {
          setBooks(catalog);
          try {
            localStorage.setItem('nazareth_cached_books', JSON.stringify(catalog));
          } catch {}
        }
      } catch (err) {
        console.warn('Backend API connection notice:', err);
      }
    };

    fetchPublicBooks();

    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Protected Data Loading: Fetch data from PostgreSQL/FastAPI when authenticated
  useEffect(() => {
    if (activeRole === 'landing' || !activeUser) {
      setPupils([]);
      setOrders([]);
      setNotifications([]);
      setContacts([]);
      return;
    }

    let isMounted = true;

    // Instant cache retrieval for Admin dashboard
    if (activeRole === 'admin') {
      try {
        const cachedPupils = sessionStorage.getItem('nazareth_cached_pupils');
        if (cachedPupils) setPupils(JSON.parse(cachedPupils));
      } catch {}
    }

    const loadData = async () => {
      try {
        if (activeRole === 'admin') {
          const [allPupils, allOrders, allNotifs, allContacts, allBooks] = await Promise.allSettled([
            api.getAllPupils(),
            api.getOrders(),
            api.getNotifications('admin'),
            api.getContacts(),
            api.getInventory()
          ]);

          if (!isMounted) return;

          if (allPupils.status === 'fulfilled') {
            setPupils(allPupils.value);
            try {
              sessionStorage.setItem('nazareth_cached_pupils', JSON.stringify(allPupils.value));
            } catch {}
          }
          if (allOrders.status === 'fulfilled') setOrders(allOrders.value);
          if (allNotifs.status === 'fulfilled') setNotifications(allNotifs.value);
          if (allContacts.status === 'fulfilled') setContacts(allContacts.value);
          if (allBooks.status === 'fulfilled') setBooks(allBooks.value);
        } else {
          // Pupil / Parent Role
          const pupilId = activeUser?.id || activeUser?.regNo;
          const [userOrders, userNotifs] = await Promise.allSettled([
            api.getOrders(pupilId),
            api.getNotifications(activeRole === 'pupil' ? 'pupil' : 'parent', activeUser?.regNo)
          ]);

          if (!isMounted) return;

          if (userOrders.status === 'fulfilled') setOrders(userOrders.value);
          if (userNotifs.status === 'fulfilled') setNotifications(userNotifs.value);
        }
      } catch (err) {
        console.warn('API data fetch notice:', err);
      }
    };

    loadData();

    // Periodic live sync every 30 seconds when active in dashboard and tab is visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadData();
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeRole, activeUser]);

  // Sync state helpers
  const handleUpdatePupils = async (updatedList: Pupil[]) => {
    setPupils(updatedList);
    try {
      await api.createPupilsBulk(updatedList);
    } catch (err) {
      console.error('Failed to sync pupils to SQL backend:', err);
    }
  };

  const handleUpdateBooks = async (updatedList: BookItem[]) => {
    setBooks(updatedList);
  };

  const handleUpdateOrders = async (updatedList: Order[]) => {
    setOrders(updatedList);
    try {
      for (const ord of updatedList) {
        api.syncOrder(ord).catch(() => {});
      }
    } catch (err) {
      console.warn('Orders sync notice:', err);
    }
  };

  const handleUpdateNotifications = async (updatedList: AppNotification[]) => {
    setNotifications(updatedList);
  };

  const handleUpdateContacts = async (updatedList: ContactSubmission[]) => {
    setContacts(updatedList);
  };

  const handleSystemPurge = async () => {
    if (confirm('Are you sure you want to purge all records in the registry?')) {
      try {
        for (const p of pupils) {
          await api.deletePupil(p.id).catch(() => {});
        }
        setPupils([]);
        setOrders([]);
        setNotifications([]);
        setContacts([]);
        alert('System purged successfully.');
      } catch (err) {
        console.error('System purge failed:', err);
      }
    }
  };

  // Impersonation state for Registrar view switcher
  const [impersonator, setImpersonator] = useState<any | null>(null);

  const handleLogin = (role: 'admin' | 'pupil' | 'parent', user: any) => {
    setActiveRole(role);
    setActiveUser(user);
    setImpersonator(null);
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
              try {
                const newContact = await api.submitContact(submission);
                setContacts(prev => [newContact, ...prev]);
              } catch (err) {
                console.warn('Contact API notice:', err);
              }
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
