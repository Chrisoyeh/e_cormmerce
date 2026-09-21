/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Pupil, BookItem, Order, AppNotification, ContactSubmission } from './types';
import { INITIAL_PUPILS, INITIAL_BOOKS, INITIAL_ORDERS, INITIAL_NOTIFICATIONS, INITIAL_CONTACTS } from './data/initialData';
import { api, getDeletedOrderIds } from './services/api';
import { LandingPage } from './components/LandingPage';
import { AdminDashboard } from './components/AdminDashboard';
import { PupilDashboard } from './components/PupilDashboard';
import { ParentDashboard } from './components/ParentDashboard';
import { GDPRConsent } from './components/GDPRConsent';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  // State elements with instant initial cache hydration
  const [pupils, setPupils] = useState<Pupil[]>(() => {
    try {
      const cached = localStorage.getItem('nazareth_cached_pupils') || sessionStorage.getItem('nazareth_cached_pupils');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_PUPILS;
    } catch {
      return INITIAL_PUPILS;
    }
  });
  const [books, setBooks] = useState<BookItem[]>(() => {
    try {
      const cached = localStorage.getItem('nazareth_cached_books') || sessionStorage.getItem('nazareth_cached_books');
      return cached !== null ? JSON.parse(cached) : INITIAL_BOOKS;
    } catch {
      return INITIAL_BOOKS;
    }
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => INITIAL_NOTIFICATIONS);
  const [contacts, setContacts] = useState<ContactSubmission[]>(() => INITIAL_CONTACTS);

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
        if (!isCancelled && Array.isArray(catalog)) {
          setBooks(catalog);
          try {
            localStorage.setItem('nazareth_cached_books', JSON.stringify(catalog));
            sessionStorage.setItem('nazareth_cached_books', JSON.stringify(catalog));
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
      return;
    }

    let isMounted = true;

    // Instant cache retrieval for Admin / Pupil / Parent dashboard (Pupils and Books ONLY)
    try {
      // Purge any legacy cached orders to enforce single source of truth
      sessionStorage.removeItem('nazareth_cached_orders');
      localStorage.removeItem('nazareth_cached_orders');

      const cachedPupils = sessionStorage.getItem('nazareth_cached_pupils') || localStorage.getItem('nazareth_cached_pupils');
      if (cachedPupils) {
        const parsed = JSON.parse(cachedPupils);
        if (Array.isArray(parsed) && parsed.length > 0) setPupils(parsed);
      }

      const cachedBooks = sessionStorage.getItem('nazareth_cached_books') || localStorage.getItem('nazareth_cached_books');
      if (cachedBooks) {
        const parsed = JSON.parse(cachedBooks);
        if (Array.isArray(parsed) && parsed.length > 0) setBooks(parsed);
      }
    } catch {}

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

          if (allPupils.status === 'fulfilled' && Array.isArray(allPupils.value)) {
            const cleanIncomingPupils = allPupils.value.filter(Boolean);
            if (cleanIncomingPupils.length > 0) {
              setPupils(cleanIncomingPupils);
              try {
                sessionStorage.setItem('nazareth_cached_pupils', JSON.stringify(cleanIncomingPupils));
                localStorage.setItem('nazareth_cached_pupils', JSON.stringify(cleanIncomingPupils));
              } catch {}
            }
          }
          if (allOrders.status === 'fulfilled' && Array.isArray(allOrders.value)) {
            const deleted = getDeletedOrderIds();
            const cleanIncomingOrders = allOrders.value.filter(
              (o: Order) => o && !deleted.has(String(o.id || '').trim().toLowerCase()) && !deleted.has(String(o.invoiceNo || '').trim().toLowerCase())
            );
            if (cleanIncomingOrders.length > 0) {
              setOrders(cleanIncomingOrders);
            }
          }
          if (allNotifs.status === 'fulfilled' && Array.isArray(allNotifs.value)) setNotifications(allNotifs.value.filter(Boolean));
          if (allContacts.status === 'fulfilled' && Array.isArray(allContacts.value)) setContacts(allContacts.value.filter(Boolean));
          if (allBooks.status === 'fulfilled' && Array.isArray(allBooks.value)) {
            const cleanBooks = allBooks.value.filter(Boolean);
            if (cleanBooks.length > 0) {
              setBooks(cleanBooks);
              try {
                sessionStorage.setItem('nazareth_cached_books', JSON.stringify(cleanBooks));
                localStorage.setItem('nazareth_cached_books', JSON.stringify(cleanBooks));
              } catch {}
            }
          }
        } else {
          // Pupil / Parent Role
          const pupilId = activeUser?.id;
          const pupilRegNo = activeUser?.regNo;
          const [userOrders, userNotifs, allBooks] = await Promise.allSettled([
            api.getOrders(pupilId, pupilRegNo),
            api.getNotifications(activeRole === 'pupil' ? 'pupil' : 'parent', pupilRegNo || pupilId),
            api.getInventory()
          ]);

          if (!isMounted) return;

          if (userOrders.status === 'fulfilled' && Array.isArray(userOrders.value)) {
            const deleted = getDeletedOrderIds();
            const cleanUserOrders = (userOrders.value || []).filter(
              (o: Order) => o && !deleted.has(String(o.id || '').trim().toLowerCase()) && !deleted.has(String(o.invoiceNo || '').trim().toLowerCase())
            );
            if (cleanUserOrders.length > 0) {
              setOrders(cleanUserOrders);
            }
          }
          if (userNotifs.status === 'fulfilled') setNotifications(userNotifs.value);
          if (allBooks.status === 'fulfilled' && Array.isArray(allBooks.value)) {
            setBooks(allBooks.value);
            try {
              sessionStorage.setItem('nazareth_cached_books', JSON.stringify(allBooks.value));
              localStorage.setItem('nazareth_cached_books', JSON.stringify(allBooks.value));
            } catch {}
          }
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
  const handleUpdatePupils = (updatedList: Pupil[]) => {
    setPupils(updatedList);
    try {
      sessionStorage.setItem('nazareth_cached_pupils', JSON.stringify(updatedList));
      localStorage.setItem('nazareth_cached_pupils', JSON.stringify(updatedList));
    } catch {}
  };

  const handleUpdateBooks = async (updatedList: BookItem[]) => {
    setBooks(updatedList);
    try {
      sessionStorage.setItem('nazareth_cached_books', JSON.stringify(updatedList));
      localStorage.setItem('nazareth_cached_books', JSON.stringify(updatedList));
    } catch {}
  };

  const handleUpdateOrders = async (updatedList: Order[]) => {
    const deleted = getDeletedOrderIds();
    const cleanList = (updatedList || []).filter(
      (o: Order) => o && !deleted.has(String(o.id || '').trim().toLowerCase()) && !deleted.has(String(o.invoiceNo || '').trim().toLowerCase())
    );
    setOrders(cleanList);
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
      <ErrorBoundary>
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
          (activeUser?.role === 'admin' || (activeUser?.username && (String(activeUser.username).toLowerCase() === 'admin' || String(activeUser.username).toLowerCase() === 'registrar'))) ? (
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
              <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-[#E37180] hover:bg-[#2D346C] rounded-lg text-xs font-bold transition cursor-pointer">Return to Login</button>
            </div>
          )
        )}

        {activeRole === 'pupil' && (
          activeUser ? (
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
          ) : (
            <div className="p-12 text-center flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
              <h1 className="text-xl font-bold">Session Expired</h1>
              <p className="text-xs text-slate-400 mt-2">Please log in with your pupil credentials.</p>
              <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-[#E37180] hover:bg-[#2D346C] rounded-lg text-xs font-bold transition cursor-pointer">Return to Login</button>
            </div>
          )
        )}

        {activeRole === 'parent' && (
          activeUser ? (
            <ParentDashboard
              pupil={activeUser}
              orders={orders}
              notifications={notifications}
              onUpdateNotifications={handleUpdateNotifications}
              onUpdateOrders={handleUpdateOrders}
              onLogout={handleLogout}
            />
          ) : (
            <div className="p-12 text-center flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
              <h1 className="text-xl font-bold">Session Expired</h1>
              <p className="text-xs text-slate-400 mt-2">Please log in with your ward credentials.</p>
              <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-[#E37180] hover:bg-[#2D346C] rounded-lg text-xs font-bold transition cursor-pointer">Return to Login</button>
            </div>
          )
        )}

        {/* Global GDPR Consent Banner Widget */}
        <GDPRConsent />
      </ErrorBoundary>
    </div>
  );
}
