import React, { useState } from 'react';
import { BookItem, Pupil, Order, AppNotification, ClassLevel } from '../types';
import { Logo } from './Logo';
import { InvoiceModal } from './InvoiceModal';
import { NotificationCenter } from './NotificationCenter';
import {
  ShoppingBag, BookOpen, Clock, CheckCircle, Ticket, FileText, ChevronRight, Tags,
  Bell, User, Shield, Info, Smartphone, HelpCircle, Loader, Power, Heart, Trash2, Eye, Sparkles, Globe
} from 'lucide-react';

interface PupilDashboardProps {
  pupil: Pupil;
  books: BookItem[];
  orders: Order[];
  notifications: AppNotification[];
  onUpdateOrders: (newOrders: Order[]) => void;
  onUpdateNotifications: (newNotifications: AppNotification[]) => void;
  onUpdateBooks: (newBooks: BookItem[]) => void;
  onLogout: () => void;
}

export const PupilDashboard: React.FC<PupilDashboardProps> = ({
  pupil,
  books,
  orders,
  notifications,
  onUpdateOrders,
  onUpdateNotifications,
  onUpdateBooks,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'store' | 'history' | 'profile'>('store');
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);

  // Cart State variables
  const [cart, setCart] = useState<{ [bookId: string]: number }>({});
  const [selectedBookForInvoice, setSelectedBookForInvoice] = useState<Order | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'online' | 'bank'>('bank');

  // Store selection filter
  const [classFilter, setClassFilter] = useState<string>(pupil.classLevel);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // GDPR Pupil Data Drawer
  const [gdprPrivacyReview, setGdprPrivacyReview] = useState(false);

  // Wishlist, Recently Viewed, and Book Detail states
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem(`nazareth_wishlist_${pupil.id}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem(`nazareth_recent_viewed_${pupil.id}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [viewingBook, setViewingBook] = useState<BookItem | null>(null);

  // -------------------------
  // WISHLIST ACTIONS
  // -------------------------
  const handleToggleWishlist = (bookId: string) => {
    let updated: string[];
    if (wishlist.includes(bookId)) {
      updated = wishlist.filter((id) => id !== bookId);
    } else {
      updated = [...wishlist, bookId];
    }
    setWishlist(updated);
    localStorage.setItem(`nazareth_wishlist_${pupil.id}`, JSON.stringify(updated));
  };

  const handleRemoveFromWishlist = (bookId: string) => {
    const updated = wishlist.filter((id) => id !== bookId);
    setWishlist(updated);
    localStorage.setItem(`nazareth_wishlist_${pupil.id}`, JSON.stringify(updated));
  };

  const handleMoveToCart = (book: BookItem) => {
    if (book.stock <= 0) {
      alert('This material is currently out of stock. Contact school admin for replenishment.');
      return;
    }
    handleAddToCart(book);
    handleRemoveFromWishlist(book.id);
  };

  // -------------------------
  // VIEW BOOK (RECENTLY VIEWED)
  // -------------------------
  const handleViewBook = (book: BookItem) => {
    setViewingBook(book);
    const filtered = recentlyViewed.filter((id) => id !== book.id);
    const updated = [book.id, ...filtered].slice(0, 5);
    setRecentlyViewed(updated);
    localStorage.setItem(`nazareth_recent_viewed_${pupil.id}`, JSON.stringify(updated));
  };

  // Filter bookshop items
  const filteredBooks = books.filter((b) => {
    const matchesClass = classFilter === 'All' || b.classLevel === classFilter || b.classLevel === 'All Classes';
    const matchesCategory = categoryFilter === 'All' || b.category === categoryFilter;
    return matchesClass && matchesCategory;
  });

  // -------------------------
  // CART ACTIONS
  // -------------------------
  const handleAddToCart = (book: BookItem) => {
    if (book.stock <= 0) {
      alert('This material is currently out of stock. Contact school admin for replenishment.');
      return;
    }
    const currentQty = cart[book.id] || 0;
    if (currentQty >= book.stock) {
      alert(`Only ${book.stock} units are currently available inside the bookshop.`);
      return;
    }

    setCart({
      ...cart,
      [book.id]: currentQty + 1,
    });
  };

  const handleRemoveFromCart = (bookId: string) => {
    const currentQty = cart[bookId] || 0;
    if (currentQty <= 1) {
      const updated = { ...cart };
      delete updated[bookId];
      setCart(updated);
    } else {
      setCart({
        ...cart,
        [bookId]: currentQty - 1,
      });
    }
  };

  const handleClearCart = () => setCart({});

  const handleCheckout = () => {
    const cartItemsKeys = Object.keys(cart);
    if (cartItemsKeys.length === 0) return;

    // Check stock for all items
    for (const id of cartItemsKeys) {
      const book = books.find(b => b.id === id);
      if (book && book.stock < cart[id]) {
        alert(`Insufficient stock for "${book.title}". Available: ${book.stock}`);
        return;
      }
    }

    // Build order items
    const orderItems = cartItemsKeys.map((id) => {
      const b = books.find((x) => x.id === id)!;
      return {
        bookId: b.id,
        title: b.title,
        price: b.price,
        quantity: cart[id],
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const invoiceNumber = 'INV-2026-' + String(1015 + orders.length);
    const newOrder: Order = {
      id: 'ord-' + Date.now(),
      pupilId: pupil.id,
      pupilName: `${pupil.firstName} ${pupil.surname}`,
      pupilRegNo: pupil.regNo,
      classLevel: pupil.classLevel,
      items: orderItems,
      totalAmount: subtotal * 1.05, // includes 5% VAT
      status: 'Pending Approved', // Default state
      date: new Date().toISOString(),
      invoiceNo: invoiceNumber,
      paymentMethod: selectedPaymentMethod,
    };

    // Deduct stock in book records
    const updatedBooks = books.map((b) => {
      if (cart[b.id]) {
        return { ...b, stock: Math.max(0, b.stock - cart[b.id]) };
      }
      return b;
    });

    onUpdateBooks(updatedBooks);
    onUpdateOrders([newOrder, ...orders]);

    setCart({}); // clear cart
    setSelectedPaymentMethod('bank'); // Reset payment method selection

    // Automatically trigger visual Invoice modal for immediate printing
    setSelectedBookForInvoice(newOrder);

    // Create delivery logs alerts
    const newPupilNotif: AppNotification = {
      id: 'not-pk-' + Date.now(),
      title: 'Material Requisition Booked!',
      message: `Invoice ${invoiceNumber} created. Take printout to Central Desk Room A for textbook release.`,
      type: 'success',
      timestamp: new Date().toISOString(),
      read: false,
      role: 'pupil',
      recipientId: pupil.regNo
    };

    const newAdminNotif: AppNotification = {
      id: 'not-adm-req-' + Date.now(),
      title: 'New Book Order Received',
      message: `${pupil.firstName} ${pupil.surname} requested textbooks for ${pupil.classLevel}.`,
      type: 'info',
      timestamp: new Date().toISOString(),
      read: false,
      role: 'admin'
    };

    onUpdateNotifications([newPupilNotif, newAdminNotif, ...notifications]);
  };

  const cartTotalQty = Object.keys(cart).reduce((sum, id) => sum + (cart[id] || 0), 0);
  const cartSubtotal = Object.keys(cart).reduce((sum, id) => {
    const book = books.find((b) => b.id === id);
    return sum + (book ? book.price * (cart[id] || 0) : 0);
  }, 0);
  const cartWithTax = cartSubtotal * 1.05;

  // Filter pupil specific orders
  const pupilOrders = orders.filter((o) => o.pupilRegNo === pupil.regNo);

  // -------------------------
  // THE RECOMMENDATIONS ENGINE
  // -------------------------
  const getRecommendations = (): BookItem[] => {
    // 1. Get all books of current pupil's class level
    const classBooks = books.filter((b) => b.classLevel === pupil.classLevel || b.classLevel === 'All Classes');
    
    // 2. Identify already ordered book IDs
    const orderedBookIds = pupilOrders.flatMap((o) => o.items.map((it) => it.bookId));
    
    // 3. Filter out already ordered books
    let recommended = classBooks.filter((b) => !orderedBookIds.includes(b.id));

    // 4. Try loading from next grade levels if empty
    if (recommended.length < 3) {
      const levels: ClassLevel[] = [
        'Pre-Nursery', 'Kindergarten', 'Prep 1', 'Prep 2', 
        'Primary 1', 'Primary 2', 'Primary 3', 
        'Primary 4', 'Primary 5', 'Primary 6'
      ];
      const currentIndex = levels.indexOf(pupil.classLevel as ClassLevel);
      if (currentIndex !== -1 && currentIndex + 1 < levels.length) {
        const nextLevel = levels[currentIndex + 1];
        const nextGradeBooks = books.filter((b) => b.classLevel === nextLevel && !orderedBookIds.includes(b.id));
        recommended = [...recommended, ...nextGradeBooks];
      }
    }
    
    // Fallback: Suggest essential static material of category Stationery or Utility
    if (recommended.length < 4) {
      const essentials = books.filter((b) => 
        (b.category === 'Stationery' || b.category === 'Utility') && 
        !orderedBookIds.includes(b.id) &&
        !recommended.map((r) => r.id).includes(b.id)
      );
      recommended = [...recommended, ...essentials];
    }
    
    return recommended.slice(0, 4);
  };

  const recommendations = getRecommendations();

  const getStepColor = (status: string, currentStep: number) => {
    // Steps: 1 (Submitted), 2 (Dispatched / Ready for Pickup), 3 (Completed)
    let stateVal = 1;
    if (status === 'Ready for Pickup') stateVal = 2;
    if (status === 'Completed') stateVal = 3;
    if (status === 'Cancelled') return 'bg-slate-300 dark:bg-slate-800 text-slate-400';

    if (stateVal >= currentStep) {
      return currentStep === 3 ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-slate-900';
    }
    return 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600';
  };

  // -------------------------
  // NOTIFICATIONS PORTAL MANAGER
  // -------------------------
  const handleMarkNotifRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    onUpdateNotifications(updated);
  };

  const handleClearAllNotifs = () => {
    const updated = notifications.filter((n) => n.role !== 'pupil' || n.recipientId !== pupil.regNo);
    onUpdateNotifications(updated);
  };

  const unreadNotifsCount = notifications.filter(
    (n) => n.role === 'pupil' && (n.recipientId === 'all' || n.recipientId === pupil.regNo) && !n.read
  ).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] flex flex-col p-4 md:p-6 gap-6 font-sans" id="pupil-suite">
      
      {/* Top Academic Header bar */}
      <nav className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-slate-800" id="pupil-nav">
        <Logo size="md" />
        
        {/* Profile elements */}
        <div className="flex items-center gap-4">
          
          {/* Bell Icon */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl relative text-[#065f46] transition cursor-pointer"
              id="pupil-notifications-toggle"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[8px] px-1 rounded-full animate-pulse">
                  {unreadNotifsCount}
                </span>
              )}
            </button>
            {showNotificationsMenu && (
              <div className="absolute right-0 mt-2 z-50 w-80 shadow-2xl animate-fade-in" id="pupil-notif-center-floating">
                <NotificationCenter
                  notifications={notifications}
                  onMarkAsRead={handleMarkNotifRead}
                  onClearAll={handleClearAllNotifs}
                  roleFilter="pupil"
                  recipientId={pupil.regNo}
                />
              </div>
            )}
          </div>

          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-800 capitalize leading-none">{pupil.firstName} {pupil.surname}</p>
            <span className="text-[10px] text-[#065f46] font-mono tracking-wide leading-none select-all font-semibold mt-1 block">{pupil.regNo}</span>
          </div>

          <a
            href="https://nazarethpryschool.org"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
            id="pupil-nav-back-to-web"
            title="Redirect to Main School Website"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Back to Web</span>
          </a>

          <button
            onClick={onLogout}
            className="p-1 px-3 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            id="pupil-logout-appbox"
          >
            <Power className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </nav>

      {/* Grade segment banner - Implemented as highly polished Emerald Gradient bento block with overlay tabs */}
      <div className="bg-gradient-to-br from-[#065f46] to-[#047857] text-white p-6 rounded-3xl shadow-lg flex flex-wrap justify-between items-center gap-4 border-none" id="pupil-class-badge-panel">
        <div className="flex gap-4 items-center text-left">
          <div className="h-12 w-12 bg-white/20 border border-white/25 text-white rounded-2xl flex items-center justify-center font-sans font-black text-lg animate-pulse">
            {pupil.classLevel.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-widest text-emerald-200 font-mono font-bold">Academic Class Level</span>
            <h2 className="text-lg font-black text-white leading-normal">{pupil.classLevel} Section &bull; Bookshop Gate</h2>
          </div>
        </div>

        <div className="flex bg-white/15 p-1 rounded-2xl border border-white/10" id="pupil-suite-tabs">
          <button
            onClick={() => setActiveTab('store')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'store' ? 'bg-white text-[#065f46] shadow-sm' : 'text-white/80 hover:text-white'
            }`}
          >
            Study Store
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'history' ? 'bg-white text-[#065f46] shadow-sm' : 'text-white/80 hover:text-white'
            }`}
          >
            Order Tracker
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'profile' ? 'bg-white text-[#065f46] shadow-sm' : 'text-white/80 hover:text-white'
            }`}
          >
            My GDPR Profile
          </button>
        </div>
      </div>

      {/* Main Container Area */}
      <main className="flex-1 w-full" id="pupil-active-window">

        {/* 1. STORE TAB */}
        {activeTab === 'store' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="pupil-store-grid">
            
            {/* Catalog Grid Area - Left */}
            <div className="lg:col-span-8 space-y-6">
              
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 border border-slate-200 rounded-2xl">
                <div className="flex items-center gap-2 text-xs">
                  <Tags className="text-[#065f46] w-4 h-4" />
                  <span className="font-semibold text-slate-600">Grade Scope:</span>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-[#065f46]"
                  >
                    <option value="All">All School Materials</option>
                    <option value="All Classes">All Classes</option>
                    <option value="Pre-Nursery">Pre-Nursery</option>
                    <option value="Kindergarten">Kindergarten</option>
                    <option value="Prep 1">Prep 1</option>
                    <option value="Prep 2">Prep 2</option>
                    <option value="Primary 1">Primary 1</option>
                    <option value="Primary 2">Primary 2</option>
                    <option value="Primary 3">Primary 3</option>
                    <option value="Primary 4">Primary 4</option>
                    <option value="Primary 5">Primary 5</option>
                    <option value="Primary 6">Primary 6</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  {['All', 'Textbook', 'Notebook', 'Stationery', 'Utility'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                        categoryFilter === cat ? 'bg-[#065f46] text-white shadow-xs' : 'text-slate-500 hover:text-[#065f46]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* PUPIL RECOMMENDATIONS SECTION */}
              {recommendations.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-55 border border-emerald-100 rounded-3xl p-5 hover:shadow-xs transition space-y-4 text-left" id="pupil-recommendations-bento">
                  <div className="flex justify-between items-center border-b border-emerald-100/50 pb-2">
                    <h3 className="font-sans font-bold text-sm text-[#065f46] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
                      Recommended for You
                    </h3>
                    <span className="text-[10px] bg-emerald-600/10 text-[#065f46] font-semibold px-2.5 py-0.5 rounded-full">
                      Based on {pupil.classLevel} Level
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recommendations.map((item) => (
                      <div
                        key={`rec-${item.id}`}
                        onClick={() => handleViewBook(item)}
                        className="bg-white/80 backdrop-blur-xs border border-emerald-100/80 rounded-2xl p-4 flex gap-3 text-left relative overflow-hidden group hover:bg-white hover:border-[#065f46]/30 hover:shadow-md transition cursor-pointer"
                      >
                        <div className="w-12 bg-gradient-to-tr from-slate-900 to-[#065f46] rounded-lg flex flex-col justify-between p-1.5 shadow-sm shrink-0">
                          <BookOpen className="w-5 h-5 text-amber-500 mx-auto mt-1" />
                          <div className="text-[5px] text-emerald-300 font-sans tracking-wide text-center leading-none uppercase max-w-full truncate">
                            REC
                          </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-between space-y-1 overflow-hidden">
                          <div className="space-y-0.5">
                            <h4 className="font-sans font-extrabold text-slate-900 text-xs tracking-tight leading-snug group-hover:text-[#065f46] transition truncate">
                              {item.title}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-mono">By {item.author}</p>
                          </div>

                          <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-slate-100/80">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleWishlist(item.id);
                                }}
                                className="p-1 rounded-full text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                                title="Add to Wishlist"
                              >
                                <Heart className={`w-3.5 h-3.5 ${wishlist.includes(item.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-300'}`} />
                              </button>
                              
                              {item.stock > 0 ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToCart(item);
                                  }}
                                  className="px-2 py-0.5 bg-[#065f46] hover:bg-[#047857] text-white rounded-lg font-bold text-[10px] transition cursor-pointer"
                                >
                                  + Add
                                </button>
                              ) : (
                                <span className="text-[8px] text-rose-500 font-semibold bg-rose-55 px-1.5 py-0.5 rounded">OOS</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bookshop products list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredBooks.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleViewBook(item)}
                    className="bg-white border border-slate-200 rounded-3xl p-5 hover:shadow-lg transition flex gap-4 text-left relative overflow-hidden group cursor-pointer"
                  >
                    <span className="absolute top-3 right-3 text-[9px] font-mono font-bold bg-[#065f46]/10 text-[#065f46] px-2 py-0.5 rounded">
                      {item.category}
                    </span>

                    {/* Quick Wishlist Hearts button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleWishlist(item.id);
                      }}
                      className="absolute top-3 right-20 p-1 rounded-full hover:bg-slate-50 transition cursor-pointer"
                      title={wishlist.includes(item.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                    >
                      <Heart className={`w-4 h-4 transition ${wishlist.includes(item.id) ? 'text-rose-500 fill-rose-500 animate-none' : 'text-slate-300 hover:text-rose-400'}`} />
                    </button>

                    {/* Book spine aesthetic block */}
                    <div className="w-20 bg-gradient-to-tr from-slate-900 to-[#065f46] rounded-xl flex flex-col justify-between p-2.5 shadow-md relative shrink-0">
                      <div className="p-0.5 border border-white/20 rounded font-mono text-[8px] text-amber-400 truncate text-center uppercase tracking-widest leading-none">
                        {item.classLevel.substring(0, 6)}
                      </div>
                      <BookOpen className="w-8 h-8 text-amber-500 mx-auto" />
                      <div className="text-[7px] text-slate-300 font-sans tracking-wide text-center leading-none truncate">
                        NAZARETH
                      </div>
                    </div>

                    {/* Product copy info */}
                    <div className="flex-1 flex flex-col justify-between space-y-2">
                      <div className="space-y-1">
                        <h4 className="font-sans font-bold text-slate-900 text-sm tracking-tight leading-snug group-hover:text-[#065f46] transition line-clamp-2">
                          {item.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono italic">By {item.author}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 w-full">

                        {item.stock <= 0 ? (
                          <span className="text-[10px] text-rose-650 font-semibold uppercase tracking-wider bg-rose-50 px-2 py-1 rounded">Out of Stock</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              id={`quick-view-desc-${item.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewBook(item);
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-[#065f46]/10 text-slate-600 hover:text-[#065f46] rounded-xl font-bold text-[11px] transition cursor-pointer"
                              title="Inspect Item"
                            >
                              Details
                            </button>
                            <button
                              id={`add-to-cart-${item.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(item);
                              }}
                              className="px-3.5 py-1.5 bg-[#065f46] hover:bg-[#047857] text-white rounded-xl font-bold text-xs transition cursor-pointer hover:shadow-xs"
                            >
                              Add to Cart
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredBooks.length === 0 && (
                  <div className="col-span-2 p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <BookOpen className="w-10 h-10 text-slate-300" />
                    No books found matching section parameters.
                  </div>
                )}
              </div>

              {/* RECENTLY VIEWED SECTION */}
              {recentlyViewed.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-3xl p-5 hover:shadow-xs transition space-y-4 text-left" id="pupil-recently-viewed-row">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Clock className="w-4 h-4 text-[#065f46]" />
                    <h3 className="font-sans font-bold text-xs text-slate-800">
                      Recently Viewed Supplies
                    </h3>
                  </div>

                  <div className="flex flex-row gap-4 overflow-x-auto pb-1 bento-scrollable">
                    {recentlyViewed.map((viewedId) => {
                      const item = books.find((b) => b.id === viewedId);
                      if (!item) return null;
                      return (
                        <div
                          key={`rv-${item.id}`}
                          onClick={() => handleViewBook(item)}
                          className="min-w-[170px] max-w-[190px] bg-slate-50 border border-slate-150 rounded-2xl p-3 flex flex-col justify-between hover:bg-white hover:shadow-sm transition cursor-pointer relative group flex-1 animate-none"
                        >
                          <div className="space-y-1.5 text-left">
                            <span className="text-[8px] font-mono font-black text-slate-400 uppercase bg-slate-200/50 px-1.5 py-0.5 rounded">
                              {item.category}
                            </span>
                            <h4 className="font-sans font-bold text-slate-900 text-xs tracking-tight line-clamp-2 leading-tight group-hover:text-[#065f46]">
                              {item.title}
                            </h4>
                          </div>

                          <div className="flex items-center justify-end gap-1 pt-2 mt-2 border-t border-slate-200 font-mono">
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleWishlist(item.id);
                              }}
                              className="p-1 rounded-full text-rose-500 hover:bg-rose-50 transition cursor-pointer animate-none"
                              title="Wishlist"
                            >
                              <Heart className={`w-3.5 h-3.5 ${wishlist.includes(item.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-300'}`} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Shopping Cart & Wishlist Column - Right */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Basket Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 h-fit space-y-4 text-left shadow-sm">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <h3 className="font-sans font-bold text-base text-slate-900 flex items-center gap-1.5 flex-row">
                    <ShoppingBag className="text-[#065f46] w-5 h-5 shrink-0" /> Shopping Basket
                  </h3>
                  {cartTotalQty > 0 && (
                    <button
                      onClick={handleClearCart}
                      className="text-[10px] text-slate-400 hover:text-[#065f46] uppercase font-mono font-semibold cursor-pointer"
                    >
                      Clear Basket
                    </button>
                  )}
                </div>

                {cartTotalQty === 0 ? (
                  <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2 bg-slate-50 rounded-xl p-4">
                    <ShoppingBag className="w-8 h-8 text-slate-300 animate-none" />
                    <p className="text-xs">Your basket is empty. Select textbooks to begin learning checkout.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Cart items list */}
                    <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
                      {Object.keys(cart).map((id) => {
                        const book = books.find((b) => b.id === id)!;
                        const qty = cart[id];
                        return (
                          <div key={id} className="py-2.5 flex justify-between items-center text-xs gap-1.5">
                            <div className="space-y-0.5 flex-1 pr-3 text-left overflow-hidden">
                              <p className="font-bold text-slate-900 line-clamp-1">{book.title}</p>
                              <span className="font-mono text-slate-400 text-[10px]">{book.classLevel}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleRemoveFromCart(id)}
                                className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer text-slate-700 hover:bg-slate-250 transition"
                              >
                                -
                              </button>
                              <span className="font-mono text-xs font-bold w-6 text-center text-slate-900">{qty}</span>
                              <button
                                onClick={() => handleAddToCart(book)}
                                className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer text-slate-700 hover:bg-slate-250 transition"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Calculations block */}
                    <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-800">
                      <div className="flex justify-between text-slate-500">
                        <span>Materials Subtotal:</span>
                        <span className="font-mono">₦{cartSubtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Instructional Tax (5% VAT):</span>
                        <span className="font-mono">₦{(cartSubtotal * 0.05).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-100 text-sm font-bold text-slate-900 font-sans">
                        <span>Total Amount:</span>
                        <span className="font-mono text-[#065f46] font-black">₦{cartWithTax.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-800">
                      <span className="font-bold text-slate-800 font-sans block text-left">Select Payment Method:</span>
                      <div className="grid grid-cols-1 gap-2" id="payment-method-selector-container">
                        <label className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition text-left ${selectedPaymentMethod === 'bank' ? 'border-[#065f46] bg-emerald-50/50 text-[#065f46] font-bold' : 'border-slate-200 text-slate-650 hover:bg-slate-50'}`}>
                          <input
                            type="radio"
                            name="payment_method"
                            checked={selectedPaymentMethod === 'bank'}
                            onChange={() => setSelectedPaymentMethod('bank')}
                            className="sr-only"
                          />
                          <span className="text-[10px] leading-tight font-sans">Bank Transfer</span>
                          <span className="text-[8px] font-normal text-slate-400 mt-1">Abbey Bank</span>
                        </label>
                      </div>
                    </div>

                    <button
                      id="trigger-order-checkout"
                      onClick={handleCheckout}
                      className="w-full py-3 bg-[#065f46] hover:bg-[#047857] text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                    >
                      Confirm Requisition & Generate Invoice
                    </button>

                    <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex items-start gap-1.5 text-[10px] text-slate-500 leading-normal text-left">
                      <Info className="w-3.5 h-3.5 shrink-0 text-[#065f46]" />
                      <span>Checkout automatically creates a physical transaction stamp document which can be printed live in our Order Tracker. Collect your books at Station A desk.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* My Personal Wishlist Area */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 h-fit space-y-4 text-left shadow-sm" id="pupil-wishlist-sidebar">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <h3 className="font-sans font-bold text-slate-900 text-base flex items-center gap-1.5">
                    <Heart className="text-rose-500 fill-rose-500 w-5 h-5 shrink-0" /> My Personal Wishlist
                  </h3>
                  {wishlist.length > 0 && (
                    <span className="font-mono text-[10px] font-bold bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-full border border-rose-100">
                      {wishlist.length}
                    </span>
                  )}
                </div>

                {wishlist.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2 bg-slate-50 rounded-xl p-4">
                    <Heart className="w-8 h-8 text-rose-200 animate-none" />
                    <p className="text-xs text-slate-400">Your wishlist is empty. Tap the heart icon on books to bookmark them.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1">
                    {wishlist.map((id) => {
                      const book = books.find((b) => b.id === id);
                      if (!book) return null;
                      return (
                        <div key={`wish-${id}`} className="py-3 flex justify-between items-center text-xs gap-2">
                          <div className="space-y-0.5 flex-1 pr-1 text-left cursor-pointer overflow-hidden" onClick={() => handleViewBook(book)}>
                            <p className="font-bold text-slate-900 line-clamp-1 hover:text-[#065f46] transition text-xs" title="Click to view details">{book.title}</p>
                            <span className="font-mono text-slate-400 text-[10px]">{book.classLevel}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            {book.stock <= 0 ? (
                              <span className="text-[9px] text-rose-500 font-bold bg-rose-50 px-1 py-0.5 rounded font-sans">OOS</span>
                            ) : (
                              <button
                                onClick={() => handleMoveToCart(book)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-[#065f46] rounded-lg transition cursor-pointer"
                                title="Add to Basket & Remove from Wishlist"
                              >
                                <ShoppingBag className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveFromWishlist(id)}
                              className="p-1.5 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                              title="Remove from Wishlist"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* 2. ORDER HISTORY & TRACKER TAB */}
        {activeTab === 'history' && (
          <div className="space-y-6" id="pupil-history-tab">
            <h3 className="font-sans font-bold text-base text-slate-850 border-b border-slate-100 pb-2 text-left">My Book Requisition Orders</h3>
            
            {pupilOrders.length === 0 ? (
              <div className="p-16 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 shadow-sm">
                <Ticket className="w-10 h-10 text-slate-300" />
                <p className="text-xs">You do not have any pending or completed school supplies orders yet. Open the Study Store to checkout textbooks.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pupilOrders.map((ord) => (
                  <div key={ord.id} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col md:flex-row justify-between items-stretch">
                    
                    {/* Invoice Meta Segment */}
                    <div className="p-6 md:w-80 bg-slate-50 border-r border-slate-150 flex flex-col justify-between text-left space-y-4">
                      <div className="space-y-1.5">
                        <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[#065f46] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{ord.classLevel} Section</span>
                        <h4 className="font-mono text-lg font-bold text-slate-950">{ord.invoiceNo}</h4>
                        <p className="text-[10px] text-slate-450">Transaction Date: {new Date(ord.date).toLocaleDateString()}</p>
                      </div>

                      <div className="text-xs font-mono">
                        <div className="text-slate-450 font-sans text-[10px]">Total Amount Paid:</div>
                        <div className="text-lg font-black text-[#065f46] mt-0.5">₦{ord.totalAmount.toFixed(2)}</div>
                      </div>

                      <button
                        id={`view-invoice-action-${ord.id}`}
                        onClick={() => setSelectedBookForInvoice(ord)}
                        className="py-2.5 bg-[#065f46] hover:bg-[#047857] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer hover:shadow-xs"
                      >
                        <FileText className="w-4 h-4" /> Inspect Invoice Document
                      </button>
                    </div>

                    {/* Stepper Status Timeline */}
                    <div className="p-6 flex-1 flex flex-col justify-center space-y-4">
                      
                      {/* Active Status Display and Description */}
                      <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          Dispatch Status: <span className="text-[#065f46] font-mono text-[11px] uppercase bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">{ord.status}</span>
                        </p>
                        <p className="text-[11px] text-slate-550 mt-1 leading-normal">
                          {ord.status === 'Pending Approved' && 'Your order is queued in the Nazareth Bookshop database. A central registrar is checking stock items.'}
                          {ord.status === 'Ready for Pickup' && 'APPROVED \u2705! The books have been packaged. Please present this invoice barcode at Desk A for handout releases.'}
                          {ord.status === 'Completed' && 'RELEASED \ud83c\udf93! Materials have been successfully signed-for and transferred to the pupil household.'}
                          {ord.status === 'Cancelled' && 'CANCELLED \u26a0\ufe0f! This invoice has been voided by school administrative command.'}
                        </p>
                      </div>

                      {/* Timeline Steps visualization */}
                      <div className="grid grid-cols-3 gap-2 relative pt-2">
                        {/* Horizontal Connector Line */}
                        <div className="absolute top-6 left-1/6 right-1/6 h-0.5 bg-slate-200 z-0" />

                        {/* Step 1 */}
                        <div className="flex flex-col items-center text-center z-10 space-y-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold leading-none ${getStepColor(ord.status, 1)}`}>
                            1
                          </div>
                          <span className="text-[10px] font-bold text-slate-905">Submitted</span>
                        </div>

                        {/* Step 2 */}
                        <div className="flex flex-col items-center text-center z-10 space-y-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold leading-none ${getStepColor(ord.status, 2)}`}>
                            2
                          </div>
                          <span className="text-[10px] font-bold text-slate-905">Approved Desk</span>
                        </div>

                        {/* Step 3 */}
                        <div className="flex flex-col items-center text-center z-10 space-y-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold leading-none ${getStepColor(ord.status, 3)}`}>
                            3
                          </div>
                          <span className="text-[10px] font-bold text-slate-905">Handed Out</span>
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* 3. GDPR PROFILE & ERASURE */}
        {activeTab === 'profile' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-6 text-left shadow-sm" id="pupil-profile-tab">
            <div className="border-b border-slate-150 pb-3 flex justify-between items-center">
              <div>
                <h3 className="font-sans font-bold text-base text-slate-900">Pupil GDPR Profile Data</h3>
                <p className="text-xs text-slate-500">Review historical data and regulate your digital digital profile ledger permissions.</p>
              </div>
              <span className="text-xs bg-emerald-50 border border-emerald-100 text-[#065f46] px-3 py-1 rounded-full flex items-center gap-1.5 font-mono font-bold">
                <Shield className="w-3.5 h-3.5" /> Compliant Section
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
              <div className="space-y-4 text-left">
                <h4 className="font-sans font-bold text-sm text-slate-900">Institutional Data Transparency</h4>
                <p className="text-slate-500 leading-relaxed text-[12px]">
                  Nazareth School maps pupil data purely for classroom logistics, textbook release tracking, and automated parent progress notifications.
                </p>

                <div className="p-4 bg-slate-50 rounded-xl space-y-2.5 font-mono border border-slate-150">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400">Class Block:</span>
                    <span className="font-bold text-slate-800">{pupil.classLevel}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400">Household Email:</span>
                    <span className="font-mono text-slate-800">{pupil.parentEmail}</span>
                  </div>
                  <div className="flex justify-between pb-0.5">
                    <span className="text-slate-400">Billing Profile ID:</span>
                    <span className="font-bold text-slate-800">{pupil.id}</span>
                  </div>
                </div>
              </div>

              {/* Action sandbox */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 h-fit text-left">
                <h4 className="font-sans font-bold text-sm text-slate-900">Active Privacy Commands</h4>
                <p className="text-slate-500 leading-relaxed">
                  You can export your profile details in a machine-readable format, or submit an inquiry to institutional registrars.
                </p>

                <div className="space-y-2">
                  <button
                    id="export-pupil-json-btn"
                    onClick={() => {
                      const backupObj = {
                        pupil_profile: pupil,
                        order_ledger: pupilOrders
                      };
                      const s = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObj, null, 2));
                      const a = document.createElement('a');
                      a.setAttribute('href', s);
                      a.setAttribute('download', `nazareth_${pupil.surname}_data_backup.json`);
                      a.click();
                    }}
                    className="w-full py-2.5 bg-[#065f46] hover:bg-[#047857] text-white font-bold text-[11px] rounded-xl transition cursor-pointer"
                  >
                    Export My Data Ledger (.JSON)
                  </button>
                  <button
                    onClick={() => setGdprPrivacyReview(!gdprPrivacyReview)}
                    className="w-full py-2.5 bg-slate-200 text-slate-800 hover:bg-slate-250 font-semibold text-[11px] rounded-xl transition cursor-pointer"
                  >
                    Inquire Right to be Forgotten (ERASURE)
                  </button>
                </div>

                {gdprPrivacyReview && (
                  <div className="pt-3 border-t border-slate-150 text-[11px] text-[#065f46] space-y-1 animate-fade-in" id="erasure-warning">
                    <span className="font-bold">⚠️ Right of Erasure (Article 17) request:</span>
                    <p className="text-slate-500 leading-normal">
                      Under general scholastic laws, certain billing logs must be retained for audits. To anonymize non-billing records or erase your pupil profile permanently, please forward your formal request to our School Registrar at: <strong className="text-emerald-700 font-sans">nazarethschoolfestac@gmail.com</strong> or reset your browser's private sandbox parameters.
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Invoice modal rendering */}
      {selectedBookForInvoice && (
        <InvoiceModal
          order={selectedBookForInvoice}
          onClose={() => setSelectedBookForInvoice(null)}
          onUpdateOrder={(updatedOrder) => {
            const updated = orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
            onUpdateOrders(updated);
            setSelectedBookForInvoice(updatedOrder);
          }}
        />
      )}

      {/* Book Detail Modal */}
      {viewingBook && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="book-detail-modal">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl relative text-left text-slate-800">
            {/* Top Close indicator */}
            <button
              onClick={() => setViewingBook(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Decorative Header Spine */}
            <div className="flex gap-4 items-start">
              <div className="w-16 h-20 bg-gradient-to-tr from-slate-900 to-[#065f46] rounded-xl flex flex-col justify-between p-2 shadow-md shrink-0">
                <BookOpen className="w-6 h-6 text-amber-500 mx-auto mt-2 animate-none" />
                <div className="text-[6px] text-slate-300 text-center leading-none font-bold truncate mt-1">NAZARETH</div>
              </div>

              <div className="space-y-1 flex-1 pr-6">
                <span className="text-[9px] uppercase tracking-wider font-mono font-bold bg-[#065f46]/10 text-[#065f46] px-2.5 py-0.5 rounded-full">
                  {viewingBook.category}
                </span>
                <h3 className="font-sans font-extrabold text-slate-905 text-base leading-snug">
                  {viewingBook.title}
                </h3>
                <p className="text-xs text-slate-400 font-mono italic">By {viewingBook.author}</p>
              </div>
            </div>

            {/* Meta statistics */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl text-xs font-mono border border-slate-150 text-slate-700">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Class Level:</span>
                <span className="font-bold text-slate-800">{viewingBook.classLevel}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Stock Status:</span>
                {viewingBook.stock > 0 ? (
                  <span className="font-bold text-emerald-600">{viewingBook.stock} Units left</span>
                ) : (
                  <span className="font-bold text-rose-500">Out of Stock</span>
                )}
              </div>
            </div>

            {/* Description segment */}
            <div className="space-y-2">
              <span className="text-xs font-sans font-bold text-slate-800 block">Overview Description</span>
              <p className="text-xs text-slate-500 leading-relaxed font-sans mt-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                {viewingBook.description}
              </p>
            </div>

            {/* Action footer block */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-100 mt-2">

              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    handleToggleWishlist(viewingBook.id);
                  }}
                  className={`p-2.5 border rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold ${
                    wishlist.includes(viewingBook.id)
                      ? 'bg-rose-50 border-rose-200 text-rose-600'
                      : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                  title={wishlist.includes(viewingBook.id) ? "In Wishlist" : "Add to Wishlist"}
                >
                  <Heart className={`w-4 h-4 ${wishlist.includes(viewingBook.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                  {wishlist.includes(viewingBook.id) ? "Saved" : "Save"}
                </button>

                {viewingBook.stock > 0 ? (
                  <button
                    onClick={() => {
                      handleAddToCart(viewingBook);
                      setViewingBook(null);
                    }}
                    className="px-4 py-2.5 bg-[#065f46] hover:bg-[#047857] text-white rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer hover:shadow-md"
                  >
                    <ShoppingBag className="w-4 h-4" /> Add to Basket
                  </button>
                ) : (
                  <button
                    disabled
                    className="px-4 py-2.5 bg-slate-200 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed"
                  >
                    Out of Stock
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
