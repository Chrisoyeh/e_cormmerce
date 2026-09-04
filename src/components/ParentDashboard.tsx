import React, { useState, useRef, useEffect } from 'react';
import { Pupil, Order, AppNotification } from '../types';
import { Logo } from './Logo';
import { InvoiceModal } from './InvoiceModal';
import { NotificationCenter } from './NotificationCenter';
import {
  FileText, Calendar, CheckCircle, CheckCircle2, AlertTriangle, Printer, TrendingUp, Bell,
  Shield, Download, UserCheck, Package, RefreshCw, MessageSquare, CreditCard, Menu, X, Power, Globe, Coins, BookOpen, Phone, Mail
} from 'lucide-react';

interface ParentDashboardProps {
  pupil: Pupil;
  orders: Order[];
  notifications: AppNotification[];
  onUpdateNotifications: (newNotifications: AppNotification[]) => void;
  onUpdateOrders?: (newOrders: Order[]) => void;
  onLogout: () => void;
}

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  pupil,
  orders,
  notifications,
  onUpdateNotifications,
  onUpdateOrders,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'support'>('overview');
  const [selectedInvoice, setSelectedInvoice] = useState<Order | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleSubmitInvoice = (submittedOrder: Order) => {
    if (submittedOrder.paymentMethod === 'bank' && !submittedOrder.paymentReceiptUrl) {
      alert('Please upload a payment receipt before submitting this invoice.');
      return;
    }

    // Mark the order as submitted to the ledger
    const updatedOrder = { ...submittedOrder, submittedToLedger: true };
    if (onUpdateOrders) {
      const updatedOrders = orders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
      onUpdateOrders(updatedOrders);
    }

    // Create an admin notification for the submitted invoice
    const newAdminNotif: AppNotification = {
      id: 'not-inv-' + Date.now(),
      title: 'Invoice Submitted with Receipt',
      message: `Parent of ${pupil.firstName} ${pupil.surname} (${pupil.classLevel}) submitted invoice ${submittedOrder.invoiceNo} with payment receipt.`,
      type: 'success',
      timestamp: new Date().toISOString(),
      read: false,
      role: 'admin',
    };
    onUpdateNotifications([newAdminNotif, ...notifications]);
    showToast(`Invoice ${submittedOrder.invoiceNo} submitted to Central Registrar successfully!`, 'success');
    setSelectedInvoice(null);
  };

  // Filter ward specific data
  const wardOrders = orders.filter((o) => o.pupilRegNo === pupil.regNo && o.status !== 'Cancelled');

  // Compute stats
  const totalSpend = wardOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Notification management
  const handleMarkRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    onUpdateNotifications(updated);
  };

  const handleClearNotifications = () => {
    const updated = notifications.filter((n) => n.role !== 'parent' || n.recipientId !== pupil.regNo);
    onUpdateNotifications(updated);
  };

  const unreadParentCount = notifications.filter(
    (n) => n.role === 'parent' && (n.recipientId === 'all' || n.recipientId === pupil.regNo) && !n.read
  ).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] flex flex-col p-4 md:p-6 gap-6 font-sans" id="parent-suite">
      
      {/* Top Header Navigation */}
      <nav className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-slate-800" id="parent-navbar">
        <Logo size="md" />
        
        {/* Mobile menu toggle */}
        <button 
          className="md:hidden p-2 text-slate-600 hover:text-emerald-600 focus:outline-none"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row items-center gap-4 w-full md:w-auto mt-4 md:mt-0`}>
          {/* Notifications center */}
          <div className="relative w-full md:w-auto flex justify-center">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[#065f46] relative transition cursor-pointer w-full md:w-auto flex justify-center"
              id="parent-notifications-toggler"
            >
              <Bell className="w-4 h-4" />
              {unreadParentCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[8px] px-1 rounded-full animate-pulse">
                  {unreadParentCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 z-50 w-80 shadow-2xl animate-fade-in" id="parent-notification-box-float">
                <NotificationCenter
                  notifications={notifications}
                  onMarkAsRead={handleMarkRead}
                  onClearAll={handleClearNotifications}
                  roleFilter="parent"
                  recipientId={pupil.regNo}
                />
              </div>
            )}
          </div>

          <div className="text-center md:text-right w-full md:w-auto">
            <span className="text-[9px] text-[#065f46] font-mono uppercase tracking-widest block font-bold">In Loco Parentis</span>
            <p className="text-xs font-bold text-slate-800 capitalize leading-none mt-0.5">{pupil.parentName}</p>
          </div>

          <a
            href="https://nazarethpryschool.org"
            className="flex items-center justify-center w-full md:w-auto gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
            id="parent-nav-back-to-web"
            title="Redirect to Main School Website"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>Back to Web</span>
          </a>

          <button
            onClick={onLogout}
            className="w-full md:w-auto px-3.5 py-2 md:py-1.5 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Leave Suite
          </button>
        </div>
      </nav>

      {/* Ward identification block - Embedded inside Bento Emerald Gradient Card */}
      <div className="bg-gradient-to-br from-[#065f46] to-[#047857] text-white p-6 rounded-3xl shadow-lg flex flex-wrap gap-4 items-center justify-between" id="parent-ward-banner">
        <div className="flex gap-3.5 items-center text-left">
          <div className="p-2.5 bg-white/10 rounded-xl border border-white/20 text-white">
            <UserCheck className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-[9px] text-emerald-200 uppercase tracking-widest font-mono font-bold">Pupil Profile Inspected:</div>
            <h2 className="text-lg font-black text-white leading-tight">
              {pupil.firstName} {pupil.surname} &bull; <span className="opacity-90 font-medium">{pupil.classLevel}</span>
            </h2>
          </div>
        </div>

        <div className="flex gap-4 text-xs">
          <div className="bg-white/10 border border-white/10 p-3 rounded-2xl flex items-center gap-2.5">
            <div className="p-1.5 bg-white/25 rounded-lg text-emerald-100">
              <Coins className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-[9px] text-emerald-250 leading-none">Total Bookshop spend</p>
              <span className="font-bold font-mono text-white text-sm tracking-tight">₦{totalSpend.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Sandbox Layout container */}
      <main className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-6" id="parent-workspace-main">
        
        {/* Textbook Ledger - Left */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-6">
            
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center text-left">
              <div>
                <h3 className="font-sans font-bold text-base text-slate-900">Classroom Textbook Ledger</h3>
                <p className="text-xs text-slate-500 mt-0.5">Requisition and invoice logs for school materials.</p>
              </div>
              <span className="text-[10px] bg-emerald-100 text-[#065f46] font-bold uppercase py-1 px-2.5 rounded-full font-mono flex items-center gap-1.5 border border-emerald-200">
                <BookOpen className="w-3.5 h-3.5" /> Bookshop Logs
              </span>
            </div>

            {wardOrders.length === 0 ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <Calendar className="w-10 h-10 text-slate-300" />
                <p className="text-xs text-slate-500">No materials purchases logged for this household yet.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1" id="parent-ward-orders">
                {wardOrders.map((ord) => (
                  <div key={ord.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-700 text-sm select-all">{ord.invoiceNo}</span>
                        <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[#065f46] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{ord.status}</span>
                      </div>
                      <div className="text-xs text-slate-450 font-mono">Date: {new Date(ord.date).toLocaleString()}</div>
                      <div className="text-xs text-slate-650 font-sans mt-1">
                        {ord.items.map((it) => `${it.title} (x${it.quantity})`).join(', ')}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-stretch sm:self-auto justify-between border-t sm:border-t-0 border-slate-200/50 pt-2 sm:pt-0 shrink-0">
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 font-mono">Total Paid</p>
                        <span className="font-mono text-sm font-bold text-emerald-700">₦{ord.totalAmount.toFixed(2)}</span>
                      </div>
                      <button
                        id={`parent-view-invoice-${ord.id}`}
                        onClick={() => setSelectedInvoice(ord)}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl transition cursor-pointer hover:shadow-xs shrink-0"
                      >
                        Print Invoice
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* Pupil Registrar Record - Right */}
        <div className="lg:col-span-4 space-y-6 text-left">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
              <h4 className="font-sans font-bold text-sm text-slate-800">Registrar Contact Profile</h4>
              <UserCheck className="w-4 h-4 text-[#065f46]" />
            </div>

            <div className="space-y-3.5 text-xs text-slate-700">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-2.5">
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">Full Name</span>
                  <span className="text-sm font-bold text-slate-900">{pupil.firstName} {pupil.surname}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">Registry Code</span>
                  <span className="font-mono font-bold text-emerald-600 select-all">{pupil.regNo}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">Academic Class</span>
                  <span className="font-semibold text-slate-800">{pupil.classLevel}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-2">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">Guardian Contact Coordinates</span>
                <div className="flex items-center gap-2 text-slate-600"><Phone className="w-3.5 h-3.5 text-slate-400" /> {pupil.parentPhone}</div>
                <div className="flex items-center gap-2 text-slate-600"><Mail className="w-3.5 h-3.5 text-slate-400" /> {pupil.parentEmail}</div>
              </div>
            </div>

            {/* Privacy compliance & download */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <button
                id="parent-backup-ward-data-btn"
                onClick={() => {
                  const dataBackup = {
                    household: pupil.parentName,
                    pupilName: pupil.firstName + ' ' + pupil.surname,
                    pupilReg: pupil.regNo,
                    orders: wardOrders,
                  };
                  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataBackup, null, 2));
                  const dlAnchor = document.createElement('a');
                  dlAnchor.setAttribute('href', dataStr);
                  dlAnchor.setAttribute('download', `nazareth_household_${pupil.surname}.json`);
                  dlAnchor.click();
                }}
                className="w-full py-2.5 bg-slate-900 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 hover:opacity-90 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download Ward Data transcript
              </button>

              <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-1.5 text-[9px] text-slate-450 leading-relaxed">
                <div className="font-bold flex items-center gap-1 text-slate-650">
                  <Shield className="w-3 h-3 text-[#065f46]" /> Data Privacy (GDPR Compliance):
                </div>
                <span>
                  Nazareth School protects pupil identities under standard privacy compliance controls. Parent check files are generated locally and transiently.
                </span>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Invoice modal */}
      {selectedInvoice && (
        <InvoiceModal
          order={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onUpdateOrder={(updatedOrder) => {
            if (onUpdateOrders) {
              const orderWithSubmission = updatedOrder.paymentReceiptUrl
                ? { ...updatedOrder, submittedToLedger: true }
                : updatedOrder;
              const updated = orders.map((o) => (o.id === orderWithSubmission.id ? orderWithSubmission : o));
              onUpdateOrders(updated);
              setSelectedInvoice(orderWithSubmission);
            }
          }}
          onSubmitInvoice={handleSubmitInvoice}
        />
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border bg-slate-900 text-white border-slate-700 animate-slide-up"
          id="parent-toast-notification"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs max-w-xs">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-1 p-0.5 hover:bg-white/10 rounded-full transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
};
