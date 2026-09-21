import React, { useState, useRef, useEffect } from 'react';
import { Pupil, Order, AppNotification } from '../types';
import { Logo } from './Logo';
import { InvoiceModal } from './InvoiceModal';
import { NotificationCenter } from './NotificationCenter';
import { api } from '../services/api';
import { useToast } from './Toast';
import {
  FileText, Calendar, CheckCircle, CheckCircle2, AlertTriangle, Printer, TrendingUp, Bell,
  Shield, Download, UserCheck, Package, RefreshCw, MessageSquare, CreditCard, Menu, X, Power, Globe, Coins, BookOpen, Phone, Mail, Search
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
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);

  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

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
      toastError('Please upload a payment receipt before submitting this invoice.');
      return;
    }

    // Mark the order as submitted to the ledger
    const updatedOrder = { ...submittedOrder, submittedToLedger: true };
    if (onUpdateOrders) {
      const updatedOrders = orders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
      onUpdateOrders(updatedOrders);
    }

    // Persist to backend database
    api.syncOrder(updatedOrder).catch((err) => {
      console.warn('Backend order sync notice:', err);
    });

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
    api.createNotification(newAdminNotif).catch(() => {});
    showToast(`Invoice ${submittedOrder.invoiceNo} submitted to Central Registrar successfully!`, 'success');
    setSelectedInvoice(null);
  };

  // Search state for ward invoices
  const [searchInvoiceTerm, setSearchInvoiceTerm] = useState('');

  // Filter ward specific data with strict deduplication & case-insensitive matching
  const wardOrders = (() => {
    const regLower = pupil?.regNo ? String(pupil.regNo).trim().toLowerCase() : '';
    const idLower = pupil?.id ? String(pupil.id).trim().toLowerCase() : '';
    const nameLower = pupil?.firstName && pupil?.surname ? `${pupil.firstName} ${pupil.surname}`.trim().toLowerCase() : '';

    const list = (orders || []).filter((o) => {
      if (!o || o.status === 'Cancelled') return false;
      const oReg = String(o.pupilRegNo || '').trim().toLowerCase();
      const oId = String(o.pupilId || '').trim().toLowerCase();
      const oName = String(o.pupilName || '').trim().toLowerCase();

      if (regLower && (oReg === regLower || oId === regLower)) return true;
      if (idLower && (oId === idLower || oReg === idLower)) return true;
      if (nameLower && oName === nameLower) return true;
      return false;
    });

    const seen = new Set<string>();
    const deduplicated: Order[] = [];
    for (const ord of list) {
      if (!ord) continue;
      const key = (ord.invoiceNo && String(ord.invoiceNo).trim()) || ord.id;
      if (key && !seen.has(key)) {
        seen.add(key);
        deduplicated.push(ord);
      }
    }
    return deduplicated;
  })();

  const filteredWardOrders = wardOrders.filter((ord) => {
    if (!ord) return false;
    const q = String(searchInvoiceTerm || '').trim().toLowerCase();
    if (!q) return true;
    return (
      (ord.invoiceNo && String(ord.invoiceNo).toLowerCase().includes(q)) ||
      (ord.pupilName && String(ord.pupilName).toLowerCase().includes(q)) ||
      (ord.pupilRegNo && String(ord.pupilRegNo).toLowerCase().includes(q)) ||
      (ord.items || []).some((it) => (it?.title ? String(it.title).toLowerCase().includes(q) : false))
    );
  });

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
          className="md:hidden p-2 text-slate-600 hover:text-[#E37180] focus:outline-none"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row items-center gap-4 w-full md:w-auto mt-4 md:mt-0`}>
          {/* Notifications center */}
          <div className="relative w-full md:w-auto flex justify-center">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[#E37180] relative transition cursor-pointer w-full md:w-auto flex justify-center"
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
            <span className="text-[9px] text-[#E37180] font-mono uppercase tracking-widest block font-bold">In Loco Parentis</span>
            <p className="text-xs font-bold text-slate-800 capitalize leading-none mt-0.5">{pupil.parentName}</p>
          </div>

          <a
            href="https://nazarethpryschool.org"
            className="flex items-center justify-center w-full md:w-auto gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-[#E37180]/10 text-slate-700 hover:text-[#E37180] text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
            id="parent-nav-back-to-web"
            title="Redirect to Main School Website"
          >
            <Globe className="w-3.5 h-3.5 text-[#E37180]" />
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

      {/* Ward identification block - Holographic Academic Identity Pass */}
      <div className="holographic-pass text-white p-6 rounded-3xl shadow-xl flex flex-wrap gap-4 items-center justify-between border border-white/15 relative overflow-hidden" id="parent-ward-banner">
        <div className="flex gap-4 items-center text-left relative z-10">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#E37180] to-[#2D346C] p-0.5 shadow-lg shrink-0">
            <div className="h-full w-full bg-[#121633] rounded-[14px] flex items-center justify-center font-editorial font-black text-xl text-[#E37180] shadow-inner">
              {pupil.classLevel.substring(0, 2).toUpperCase()}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-amber-300/95 uppercase tracking-widest font-mono font-bold">Pupil Profile Inspected</span>
              <span className="text-[8px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">ENROLLED</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-academic font-bold text-white tracking-tight mt-0.5">
              {pupil.firstName} {pupil.surname}
            </h2>
            <p className="text-xs text-slate-300 font-mono mt-0.5">
              {pupil.regNo} &bull; <span className="text-rose-200 font-semibold">{pupil.classLevel}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-4 text-xs relative z-10">
          <div className="bg-white/10 backdrop-blur-md border border-white/15 p-3.5 rounded-2xl flex items-center gap-3 shadow-inner">
            <div className="p-2 bg-[#E37180]/30 rounded-xl text-white border border-white/20">
              <Coins className="w-5 h-5 text-rose-200" />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-slate-300 font-medium">Total Bookshop Spend</p>
              <span className="font-bold font-mono text-white text-base tracking-tight">₦{totalSpend.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
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
              <span className="text-[10px] bg-[#E37180]/10 text-[#E37180] font-bold uppercase py-1 px-2.5 rounded-full font-mono flex items-center gap-1.5 border border-[#E37180]/20">
                <BookOpen className="w-3.5 h-3.5" /> Bookshop Logs
              </span>
            </div>

            {wardOrders.length > 0 && (
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchInvoiceTerm}
                  onChange={(e) => setSearchInvoiceTerm(e.target.value)}
                  placeholder="Search invoice no, pupil name, or material title..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#E37180] focus:border-transparent transition shadow-xs"
                />
                {searchInvoiceTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchInvoiceTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {wardOrders.length === 0 ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <Calendar className="w-10 h-10 text-slate-300" />
                <p className="text-xs text-slate-500">No materials purchases logged for this household yet.</p>
              </div>
            ) : filteredWardOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Search className="w-8 h-8 text-slate-300" />
                <p className="text-xs text-slate-600 font-semibold">No invoices match "{searchInvoiceTerm}"</p>
                <button
                  type="button"
                  onClick={() => setSearchInvoiceTerm('')}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition mt-1 cursor-pointer"
                >
                  Clear Search
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1" id="parent-ward-orders">
                {filteredWardOrders.map((ord) => {
                  const isOrderUnderpaid = ord.paymentVerificationStatus === 'Underpaid' || (ord.balanceDue !== undefined && ord.balanceDue > 0);
                  return (
                    <div key={ord.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-[#E37180] text-sm select-all">{ord.invoiceNo}</span>
                          <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[#E37180] bg-[#E37180]/10 px-2 py-0.5 rounded-full border border-[#E37180]/20">{ord.status}</span>
                          {isOrderUnderpaid && (
                            <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                              ⚠️ Part-Paid (Bal: ₦{ord.balanceDue?.toLocaleString()})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-450 font-mono">Date: {new Date(ord.date).toLocaleString()}</div>
                        <div className="text-xs text-slate-650 font-sans mt-1">
                          {(ord.items || []).map((it) => `${it.title || 'Item'} (x${it.quantity || 1})`).join(', ')}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between border-t sm:border-t-0 border-slate-200/50 pt-2 sm:pt-0 shrink-0">
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400 font-mono">{isOrderUnderpaid ? 'Total Bill' : 'Total Paid'}</p>
                          <span className="font-mono text-sm font-bold text-[#E37180]">₦{ord.totalAmount.toFixed(2)}</span>
                          {isOrderUnderpaid && ord.amountPaid !== undefined && (
                            <span className="block text-[9px] font-mono text-slate-500">Paid: ₦{ord.amountPaid.toFixed(2)}</span>
                          )}
                        </div>
                        <button
                          id={`parent-view-invoice-${ord.id}`}
                          onClick={() => setSelectedInvoice(ord)}
                          className={`px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer hover:shadow-xs shrink-0 ${isOrderUnderpaid
                              ? 'bg-amber-600 hover:bg-amber-700 text-white'
                              : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-800'
                            }`}
                        >
                          {isOrderUnderpaid ? '➕ Pay Balance' : 'Print Invoice'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>

        {/* Pupil Registrar Record - Right */}
        <div className="lg:col-span-4 space-y-6 text-left">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
              <h4 className="font-sans font-bold text-sm text-slate-800">Registrar Contact Profile</h4>
              <UserCheck className="w-4 h-4 text-[#E37180]" />
            </div>

            <div className="space-y-3.5 text-xs text-slate-700">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-2.5">
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">Full Name</span>
                  <span className="text-sm font-bold text-slate-900">{pupil.firstName} {pupil.surname}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">Registry Code</span>
                  <span className="font-mono font-bold text-[#E37180] select-all">{pupil.regNo}</span>
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
                  <Shield className="w-3 h-3 text-[#E37180]" /> Data Privacy (GDPR Compliance):
                </div>
                <span>
                  Nazareth School protects pupil identities under standard privacy compliance controls. Parent check files are generated locally and transiently.
                </span>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Mobile Sticky Summary Bar */}
      {wardOrders.length > 0 && !isMobileSummaryOpen && (
        <aside
          aria-label="Order and Account Summary"
          className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl z-30 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#E37180]/15 rounded-xl text-[#E37180]">
              <Coins className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-[10px] uppercase font-mono text-slate-400 font-bold leading-none">Total Spend</p>
              <p className="font-mono font-black text-slate-900 text-sm leading-tight">₦{totalSpend.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileSummaryOpen(true)}
            className="px-4 py-2.5 bg-[#E37180] hover:bg-[#2D346C] text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer min-h-[44px] flex items-center gap-1.5"
          >
            <UserCheck className="w-4 h-4" />
            <span>Ward Profile & Ledger</span>
          </button>
        </aside>
      )}

      {/* Mobile Summary Bottom Drawer */}
      {isMobileSummaryOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setIsMobileSummaryOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl p-5 overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pull handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-4 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#E37180]" />
                <h3 className="font-bold text-base text-slate-900">Ward & Account Profile</h3>
              </div>
              <button
                onClick={() => setIsMobileSummaryOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Profile Details */}
            <div className="flex-1 overflow-y-auto space-y-4 my-3 pr-1 text-left">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-mono">Pupil:</span>
                  <span className="font-bold text-slate-900">{pupil.firstName} {pupil.surname}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-mono">Registry Code:</span>
                  <span className="font-mono font-bold text-[#E37180]">{pupil.regNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-mono">Academic Class:</span>
                  <span className="font-semibold text-slate-800">{pupil.classLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-mono">Guardian:</span>
                  <span className="font-semibold text-slate-800">{pupil.parentName}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-600 font-bold">Total Invoices:</span>
                  <span className="font-mono font-bold text-slate-900">{wardOrders.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold">Total Bookshop Spend:</span>
                  <span className="font-mono font-black text-[#E37180]">₦{totalSpend.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Quick Contact & Support Info */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-2 text-xs">
                <p className="font-bold text-slate-800 font-mono uppercase text-[10px]">Central Bookshop Support</p>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-[#E37180]" />
                  <span>+234 800 000 0000</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-[#E37180]" />
                  <span>support@nazarethpryschool.org</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsMobileSummaryOpen(false)}
              className="w-full min-h-[44px] py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
            >
              Close Summary
            </button>
          </div>
        </div>
      )}

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
          <CheckCircle2 className="w-4 h-4 text-[#E37180] shrink-0" />
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
