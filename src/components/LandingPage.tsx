import React, { useState } from 'react';
import { Logo } from './Logo';
import { LoginPortal } from './LoginPortal';
import { Pupil, BookItem, Order } from '../types';
import {
  Shield, GraduationCap, Users, ShieldAlert, BookOpen, Clock, FileText, BarChart3,
  CreditCard, BellDot, Award, ArrowRight, CheckCircle, ChevronDown, MessageSquare,
  Mail, Phone, User, Check, Sparkles, BookMarked, ShoppingCart, Info, Star, Globe, Menu, X
} from 'lucide-react';

interface LandingPageProps {
  pupils: Pupil[];
  books: BookItem[];
  orders: Order[];
  onLogin: (role: 'admin' | 'pupil' | 'parent', activeUser: any) => void;
  onSubmitContact?: (submission: { name: string; email: string; phone: string; message: string }) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ pupils, books, orders, onLogin, onSubmitContact }) => {
  const [isLoginOnly, setIsLoginOnly] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);

  // Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // Cart Preview state for landing store preview
  const [previewCart, setPreviewCart] = useState<{ [id: string]: number }>({});

  const handleAddToCart = (bookId: string) => {
    setPreviewCart(prev => ({
      ...prev,
      [bookId]: (prev[bookId] || 0) + 1
    }));
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      alert('Please fill out all required fields.');
      return;
    }
    if (onSubmitContact) {
      onSubmitContact({
        name: contactName,
        email: contactEmail,
        phone: contactPhone,
        message: contactMessage,
      });
    }
    setContactSubmitted(true);
    setTimeout(() => {
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactMessage('');
      setContactSubmitted(false);
    }, 4000);
  };

  const toggleFaq = (idx: number) => {
    setFaqOpenIndex(prev => prev === idx ? null : idx);
  };

  // Dynamic stats calculation
  const totalBooks = books.length;
  const categories = Array.from(new Set(books.map(b => b.category)));

  // FAQ Items
  const FAQS = [
    {
      q: "How do parents register and link their child's profile?",
      a: "Parents can log in using their child's Surname and unique Registration Number. The system automatically associates parental permissions and billing logs to the child's academic registry."
    },
    {
      q: "Can the school store process real-time bank transfers?",
      a: "Yes. The School Store supports both cash-at-desk reservations and bank transfer billing. Parents upload their payment receipts directly through the parent dashboard for administrative verification."
    },
    {
      q: "How does the Attendance Tracking module work?",
      a: "Teachers log daily attendance checkmarks via the administration registry. Real-time notifications and statistics are immediately dispatched to pupil portfolios and parental dashboards."
    },
    {
      q: "Is this system GDPR and privacy compliant?",
      a: "Absolutely. We enforce strict role-based access control (RBAC), end-to-end data validation, and provide a secure Institutional GDPR sandbox log auditing tool for school registrars."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-[#1e293b] flex flex-col font-sans antialiased" id="nazareth-landing-page">

      {/* Dynamic Navigation Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-6 py-3.5 shadow-xs" id="nav-header">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="text-[9px] bg-[#2D346C]/10 text-[#2D346C] border border-[#2D346C]/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider hidden sm:inline-flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#2D346C]" /> GDPR Secured
            </span>
          </div>

          {/* Desktop Menu items */}
          <div className="hidden lg:flex items-center gap-5">
            <a
              href="https://nazarethpryschool.org"
              className="text-xs font-bold text-[#E37180] hover:text-[#2D346C] transition flex items-center gap-1.5 px-3 py-1.5 bg-[#E37180]/5 hover:bg-[#E37180]/10 rounded-xl border border-[#E37180]/15 shadow-xs cursor-pointer"
              id="menu-item-back-to-web"
              title="Redirect to Main School Website (nazarethpryschool.org)"
            >
              <Globe className="w-3.5 h-3.5 text-[#E37180]" />
              <span>Back to Web</span>
            </a>
            {!isLoginOnly ? (
              <>
                <a href="#features" className="text-xs font-bold text-slate-600 hover:text-[#E37180] transition">Portal Features</a>
                <a href="#how-it-works" className="text-xs font-bold text-slate-600 hover:text-[#E37180] transition">Instructions</a>
                <a href="#store-preview" className="text-xs font-bold text-slate-600 hover:text-[#E37180] transition">School Store</a>
                <a href="#faq" className="text-xs font-bold text-slate-600 hover:text-[#E37180] transition">FAQ Hub</a>
                <button
                  onClick={() => { setIsLoginOnly(true); window.location.hash = "login"; }}
                  className="px-4 py-2 bg-[#E37180] hover:bg-[#2D346C] text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Access Portal
                </button>
              </>
            ) : (
              <button
                onClick={() => { setIsLoginOnly(false); window.location.hash = ""; }}
                className="text-xs font-bold text-[#E37180] hover:text-[#2D346C] transition bg-[#E37180]/5 hover:bg-[#E37180]/10 px-3.5 py-2 rounded-xl border border-[#E37180]/15 cursor-pointer"
              >
                &larr; Return to Home Page
              </button>
            )}
          </div>

          {/* Medium / Tablet / Mobile Actions */}
          <div className="flex lg:hidden items-center gap-2">
            <a
              href="https://nazarethpryschool.org"
              className="text-xs font-bold text-[#E37180] hover:text-[#2D346C] transition flex items-center gap-1.5 px-3 py-1.5 bg-[#E37180]/5 hover:bg-[#E37180]/10 rounded-xl border border-[#E37180]/15 shadow-xs cursor-pointer"
              id="mobile-nav-back-to-web"
              title="Redirect to Main School Website"
            >
              <Globe className="w-3.5 h-3.5 text-[#E37180]" />
              <span>Back to Web</span>
            </a>

            {!isLoginOnly ? (
              <button
                onClick={() => { setIsLoginOnly(true); window.location.hash = "login"; }}
                className="px-3 py-1.5 bg-[#E37180] hover:bg-[#2D346C] text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Login
              </button>
            ) : (
              <button
                onClick={() => { setIsLoginOnly(false); window.location.hash = ""; }}
                className="text-xs font-bold text-[#E37180] bg-[#E37180]/5 px-2.5 py-1.5 rounded-xl border border-[#E37180]/15 cursor-pointer"
              >
                &larr; Home
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-[#E37180] rounded-xl hover:bg-slate-100 transition cursor-pointer"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-slate-200 flex flex-col gap-2 animate-fade-in" id="mobile-menu-dropdown">
            <a
              href="https://nazarethpryschool.org"
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#E37180] bg-[#E37180]/5 hover:bg-[#E37180]/10 border border-[#E37180]/15 transition cursor-pointer"
            >
              <Globe className="w-4 h-4 text-[#E37180]" />
              <span>Back to Web (nazarethpryschool.org)</span>
            </a>
            {!isLoginOnly && (
              <>
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-[#E37180] hover:bg-slate-50 transition"
                >
                  Portal Features
                </a>
                <a
                  href="#how-it-works"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-[#E37180] hover:bg-slate-50 transition"
                >
                  Instructions
                </a>
                <a
                  href="#store-preview"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-[#E37180] hover:bg-slate-50 transition"
                >
                  School Store
                </a>
                <a
                  href="#faq"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-[#E37180] hover:bg-slate-50 transition"
                >
                  FAQ Hub
                </a>
              </>
            )}
          </div>
        )}
      </header>

      {/* DEDICATED LOGIN SCREEN (Conditional Router Override) */}
      {isLoginOnly ? (
        <div className="flex-1 flex justify-center items-center py-12 px-4 bg-gradient-to-tr from-slate-100 to-slate-200" id="login-layout-panel">
          <div className="w-full max-w-md">
            <LoginPortal pupils={pupils} onLogin={onLogin} isLoginOnly={true} />
          </div>
        </div>
      ) : (
        /* ENTERPRISE LANDING PAGE SECTIONS */
        <>
          {/* SECTION 1: HERO CONTAINER */}
          <section className="relative overflow-hidden bg-gradient-to-br from-[#2D346C] via-[#242b5c] to-[#141838] text-white py-16 md:py-24 px-4 sm:px-6 md:px-12 text-left" id="hero-banner">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#E37180]/20 via-transparent to-transparent z-0 pointer-events-none"></div>
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">

              <div className="lg:col-span-12 max-w-3xl space-y-6">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3.5 py-1 rounded-full text-xs text-rose-200 font-semibold shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-[#E37180]" /> Next-Gen Academic ERP Platform
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white">
                  Premium Portal for<br />
                  <span className="text-[#E37180]">Modern Schooling.</span>
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-slate-200 max-w-2xl leading-relaxed">
                  Supercharge school store requisitions, daily attendance auditing, billing logs, and student metrics through our unified, role-restricted dashboard infrastructure.
                </p>
                <div className="flex flex-wrap gap-4 pt-2">
                  <button
                    onClick={() => { setIsLoginOnly(true); window.location.hash = "login"; }}
                    className="px-6 py-3 bg-[#E37180] hover:bg-[#c95867] text-white font-extrabold text-sm rounded-xl transition shadow-lg hover:shadow-xl cursor-pointer"
                  >
                    Access Portal Now
                  </button>
                  <a
                    href="#store-preview"
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/25 rounded-xl text-sm font-bold text-white transition text-center"
                  >
                    Browse Catalog
                  </a>
                </div>
              </div>

            </div>
          </section>

          {/* SECTION 2: FEATURES GRID */}
          <section className="py-20 px-6 max-w-7xl mx-auto text-center" id="features">
            <div className="space-y-3 mb-12">
              <span className="text-xs font-bold uppercase tracking-widest text-[#E37180]">Unified Ecosystem</span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Core Functional Components</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Robust modular dashboards built specifically for students, parents, and school administrators.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <div className="bg-white border border-slate-200 p-5 rounded-2xl text-left hover:border-slate-350 transition duration-200">
                <GraduationCap className="w-8 h-8 text-[#E37180] mb-3" />
                <h4 className="font-bold text-sm text-slate-900">Student Dashboard</h4>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">Access subjects list, download study resources, order books, and trace attendance grids.</p>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-2xl text-left hover:border-slate-350 transition duration-200">
                <Users className="w-8 h-8 text-indigo-600 mb-3" />
                <h4 className="font-bold text-sm text-slate-900">Parent Dashboard</h4>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">Monitor child's academic reports, request supplies, upload bank transfer receipts, and get invoices.</p>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-2xl text-left hover:border-slate-350 transition duration-200">
                <ShieldAlert className="w-8 h-8 text-rose-600 mb-3" />
                <h4 className="font-bold text-sm text-slate-900">Admin Dashboard</h4>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">Control entire school store catalog, edit registered pupil profiles, audit GDPR logs, and verify orders.</p>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-2xl text-left hover:border-slate-350 transition duration-200">
                <BookOpen className="w-8 h-8 text-amber-600 mb-3" />
                <h4 className="font-bold text-sm text-slate-900">School Store</h4>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">Unified catalog listing textbook collections, drawing books, branded wear, and basic stationery.</p>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-2xl text-left hover:border-slate-350 transition duration-200">
                <CreditCard className="w-8 h-8 text-[#2D346C] mb-3" />
                <h4 className="font-bold text-sm text-slate-900">Digital Payments</h4>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">Fast transfer ledger invoices with automated document receipt uploads for instant administrative audit.</p>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-2xl text-left hover:border-slate-350 transition duration-200">
                <BellDot className="w-8 h-8 text-purple-600 mb-3" />
                <h4 className="font-bold text-sm text-slate-900">Notifications</h4>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">Systemic notifications dispatched directly to student and parental dashboards on invoice status updates.</p>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-2xl text-left hover:border-slate-350 transition duration-200">
                <Award className="w-8 h-8 text-blue-600 mb-3" />
                <h4 className="font-bold text-sm text-slate-900">Result Tracking</h4>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">Consolidated grades evaluation metrics and report cards ready to read or download on parental view.</p>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-2xl text-left hover:border-slate-350 transition duration-200">
                <Clock className="w-8 h-8 text-[#E37180] mb-3" />
                <h4 className="font-bold text-sm text-slate-900">Attendance Tracker</h4>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">Daily checkmarks auditing student attendance sheets. Instantly visible to linked parents.</p>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-2xl text-left hover:border-slate-350 transition duration-200">
                <FileText className="w-8 h-8 text-orange-600 mb-3" />
                <h4 className="font-bold text-sm text-slate-900">Invoice Generation</h4>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">Dynamic transaction invoices and PDF receipts listing order IDs, payment methods, and subtotals.</p>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-2xl text-left hover:border-slate-350 transition duration-200">
                <BarChart3 className="w-8 h-8 text-pink-600 mb-3" />
                <h4 className="font-bold text-sm text-slate-900">Sales Analytics</h4>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">Counter dashboards listing daily gross sales volume, stock alerts, and registry onboarding analysis.</p>
              </div>
            </div>
          </section>

          {/* SECTION 3: HOW IT WORKS VISUALIZATION */}
          <section className="bg-slate-100 py-16 px-6" id="how-it-works">
            <div className="max-w-7xl mx-auto text-center space-y-12">
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-widest text-[#E37180]">Getting Started</span>
                <h2 className="text-3xl font-extrabold tracking-tight">4-Step Portal Instructions</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">

                {/* Step 1 */}
                <div className="space-y-3 relative text-center">
                  <div className="w-12 h-12 bg-[#E37180] text-white rounded-full flex items-center justify-center font-bold text-base mx-auto shadow-md">1</div>
                  <h4 className="font-bold text-sm text-slate-900 mt-3">Register</h4>
                  <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto leading-normal">
                    Admins add pupil files in bulk via Excel spreadsheet logs into Firestore database.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="space-y-3 relative text-center">
                  <div className="w-12 h-12 bg-[#E37180] text-white rounded-full flex items-center justify-center font-bold text-base mx-auto shadow-md">2</div>
                  <h4 className="font-bold text-sm text-slate-900 mt-3">Secure Login</h4>
                  <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto leading-normal">
                    Students and parents authenticate instantly using Surname and unique Registration IDs.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="space-y-3 relative text-center">
                  <div className="w-12 h-12 bg-[#E37180] text-white rounded-full flex items-center justify-center font-bold text-base mx-auto shadow-md">3</div>
                  <h4 className="font-bold text-sm text-slate-900 mt-3">Purchase/Manage</h4>
                  <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto leading-normal">
                    Order core books from the automated store. Pay via transfer and upload receipts.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="space-y-3 relative text-center">
                  <div className="w-12 h-12 bg-[#E37180] text-white rounded-full flex items-center justify-center font-bold text-base mx-auto shadow-md">4</div>
                  <h4 className="font-bold text-sm text-slate-900 mt-3">Track Progress</h4>
                  <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto leading-normal">
                    Review digital invoices, monitor attendance records, and inspect grading progress reports.
                  </p>
                </div>

              </div>
            </div>
          </section>

          {/* SECTION 3.5: DETAILED PURCHASE & TRACKING PROCESS */}
          <section className="py-16 px-6 bg-gradient-to-b from-slate-100 to-white border-t border-b border-slate-200" id="purchase-tracking-process">
            <div className="max-w-7xl mx-auto space-y-12">
              <div className="text-center space-y-3">
                <span className="text-xs font-bold uppercase tracking-widest text-[#E37180] flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#2D346C]" /> Operations Guide
                </span>
                <h2 className="text-3xl font-extrabold tracking-tight">Parent & Pupil Store Guide</h2>
                <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                  Follow this straightforward procedure to acquire curricular resources and track your orders in real time.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                {/* Panel 1: Purchase Process */}
                <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between text-left space-y-6">
                  <div>
                    <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
                      <div className="p-2 bg-[#E37180]/10 rounded-xl text-[#E37180]">
                        <ShoppingCart className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-sans font-bold text-base text-slate-900">How to Make a Purchase</h3>
                        <p className="text-[10px] text-slate-400">Step-by-step requisition walkthrough</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Step 1 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#E37180]/10 text-[#E37180] font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-[#E37180]/20">1</div>
                        <div className="space-y-0.5">
                          <h5 className="font-bold text-xs text-slate-800">Access and Authenticate</h5>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            Log in to the Pupil Dashboard using the student's unique <span className="font-semibold text-slate-700">Surname</span> and <span className="font-semibold text-slate-700">Registration Number</span>.
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#E37180]/10 text-[#E37180] font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-[#E37180]/20">2</div>
                        <div className="space-y-0.5">
                          <h5 className="font-bold text-xs text-slate-800">Add Materials to Cart</h5>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            Browse the School Store catalog. Filter items by academic class and add the required books or uniform wear to your cart.
                          </p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#E37180]/10 text-[#E37180] font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-[#E37180]/20">3</div>
                        <div className="space-y-0.5">
                          <h5 className="font-bold text-xs text-slate-800">Checkout & Payment Method</h5>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            Proceed to checkout inside the cart window. Select your preferred billing option (Direct Bank Transfer or Cash Pay-at-Desk) to submit your order.
                          </p>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#E37180]/10 text-[#E37180] font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-[#E37180]/20">4</div>
                        <div className="space-y-0.5">
                          <h5 className="font-bold text-xs text-slate-800">Submit Transfer Receipt</h5>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            If paying via Bank Transfer, upload the payment receipt or proof of payment on the invoice for administrative verification.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-slate-450 text-[10px]">Need help? Refer to the FAQ block below.</span>
                    <button
                      onClick={() => { setIsLoginOnly(true); window.location.hash = "login"; }}
                      className="font-bold text-[#E37180] hover:text-[#2D346C] flex items-center gap-1 transition cursor-pointer"
                    >
                      Login to Store <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Panel 2: Tracking Process */}
                <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between text-left space-y-6">
                  <div>
                    <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
                      <div className="p-2 bg-indigo-50 rounded-xl text-indigo-700">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-sans font-bold text-base text-slate-900">How to Track Purchased Items</h3>
                        <p className="text-[10px] text-slate-450">Real-time status tracking walkthrough</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Step 1 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-indigo-100">1</div>
                        <div className="space-y-0.5">
                          <h5 className="font-bold text-xs text-slate-800">Visit Ledger History</h5>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            Open the Parent or Pupil Dashboard and navigate to the <span className="font-semibold text-slate-700">Bookshop Logs</span> or <span className="font-semibold text-slate-700">Purchase History</span> ledger.
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-indigo-100">2</div>
                        <div className="space-y-0.5">
                          <h5 className="font-bold text-xs text-slate-800">Verify Status Indicators</h5>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            Monitor the badge next to your invoice number: <span className="text-[#b45309] font-bold">Pending</span> (awaiting verification), <span className="text-[#E37180] font-bold">Paid</span> (ready for collection), or <span className="text-slate-500 font-bold">Completed</span>.
                          </p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-indigo-100">3</div>
                        <div className="space-y-0.5">
                          <h5 className="font-bold text-xs text-slate-800">Receive Push Notifications</h5>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            Check the dashboard alert centers. You will receive live updates instantly when the registrar changes your order state.
                          </p>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-indigo-100">4</div>
                        <div className="space-y-0.5">
                          <h5 className="font-bold text-xs text-slate-800">Download Official Invoice</h5>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            Once marked as Paid or Completed, view or download your official payment invoice containing transaction reference numbers.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-slate-450 text-[10px]">Secure, audited logs powered by Cloud Firestore.</span>
                    <button
                      onClick={() => { setIsLoginOnly(true); window.location.hash = "login"; }}
                      className="font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 transition cursor-pointer"
                    >
                      Check Ledger History <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: SCHOOL STORE PREVIEW */}
          <section className="py-20 px-6 max-w-7xl mx-auto" id="store-preview">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-10 pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#E37180]">School Store Catalog</span>
                <h2 className="text-3xl font-extrabold tracking-tight mt-1.5">Material Requisitions Preview</h2>
                <p className="text-xs text-slate-500 mt-1">Directly order syllabus collections and uniform wear online.</p>
              </div>

              {/* Mini Cart Preview */}
              <div className="bg-[#E37180]/5 border border-[#E37180]/20 px-4 py-2 rounded-xl flex items-center gap-2.5">
                <ShoppingCart className="w-4 h-4 text-[#E37180]" />
                <span className="text-xs font-bold text-[#E37180]">
                  Preview Cart: {Object.values(previewCart).reduce((s: number, c: number) => s + c, 0)} items
                </span>
                {Object.keys(previewCart).length > 0 && (
                  <button
                    onClick={() => setPreviewCart({})}
                    className="text-[10px] bg-[#2D346C] hover:bg-[#d65d6c] text-white px-2 py-0.5 rounded transition font-bold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {books.slice(0, 4).map((book) => (
                <div key={book.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition duration-200 flex flex-col justify-between text-left">
                  <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[9px] bg-[#2D346C]/15 text-[#E37180] font-bold px-2 py-0.5 rounded-full uppercase">{book.category}</span>
                    <span className="text-[10px] text-slate-450 font-mono font-bold">{book.classLevel}</span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{book.title}</h4>
                      <p className="text-[10px] text-slate-400 font-mono italic">by {book.author}</p>
                      <p className="text-xs text-slate-500 line-clamp-2 pt-1.5">{book.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <button
                        onClick={() => handleAddToCart(book.id)}
                        className="py-1.5 px-3 bg-[#E37180] hover:bg-[#2D346C] text-white rounded-lg text-[10px] font-bold tracking-wide transition cursor-pointer w-full text-center"
                      >
                        Add to Cart +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 5: TESTIMONIALS */}
          <section className="py-20 px-6 max-w-7xl mx-auto text-center" id="testimonials">
            <div className="space-y-3 mb-12">
              <span className="text-xs font-bold uppercase tracking-widest text-[#E37180]">Trust & Feedback</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Parent & Student Reviews</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 p-6 rounded-2xl text-left space-y-4 shadow-xs">
                <div className="flex items-center gap-1 text-amber-500">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed italic">
                  "Ordering books for Daniel has never been this simple. I placed the order from home, paid via mobile transfer, uploaded the bank receipt, and picked up the package at the school office the next day!"
                </p>
                <div className="border-t border-slate-100 pt-3">
                  <h5 className="font-bold text-xs text-slate-900">Mrs. Okon</h5>
                  <p className="text-[9px] text-slate-400">Parent of Daniel Okon (P1)</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-2xl text-left space-y-4 shadow-xs">
                <div className="flex items-center gap-1 text-amber-500">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed italic">
                  "The bulk Excel registration system is a lifesaver. I onboarded our entire Kindergarten registry block of 60 pupils in under 10 seconds. The autogenerated credentials allowed them to login instantly."
                </p>
                <div className="border-t border-slate-100 pt-3">
                  <h5 className="font-bold text-xs text-slate-900">Admin Faculty Staff</h5>
                  <p className="text-[9px] text-slate-400">School Registrar</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-2xl text-left space-y-4 shadow-xs">
                <div className="flex items-center gap-1 text-amber-500">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed italic">
                  "I love the notifications panel. Every time my payment is approved or the books are ready for pick-up, my portal dashboard shows the checkmarks immediately. No more queue lines!"
                </p>
                <div className="border-t border-slate-100 pt-3">
                  <h5 className="font-bold text-xs text-slate-900">Zainab Adamu</h5>
                  <p className="text-[9px] text-slate-400">Primary 4 Student</p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 7: DETAILED FAQ ACCORDION */}
          <section className="bg-slate-100 py-20 px-6" id="faq">
            <div className="max-w-3xl mx-auto space-y-10">
              <div className="text-center space-y-3">
                <span className="text-xs font-bold uppercase tracking-widest text-[#E37180]">Onboarding Center</span>
                <h2 className="text-3xl font-extrabold tracking-tight">Frequently Asked Questions</h2>
              </div>

              <div className="space-y-3">
                {FAQS.map((faq, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <button
                      onClick={() => toggleFaq(idx)}
                      className="w-full px-5 py-4 flex justify-between items-center text-left font-bold text-xs text-slate-800 hover:bg-slate-50 transition cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${faqOpenIndex === idx ? 'rotate-180' : ''}`} />
                    </button>
                    {faqOpenIndex === idx && (
                      <div className="px-5 pb-4 text-left text-xs text-slate-500 leading-relaxed animate-slideDown border-t border-slate-50 pt-2">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 8: CONTACT US FORM */}
          <section className="py-20 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12" id="contact">
            <div className="lg:col-span-5 space-y-6 text-left">
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-widest text-[#E37180]">Contact Us</span>
                <h2 className="text-3xl font-extrabold tracking-tight">Get in Touch</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Have questions about the student portal, institutional enrollment, or store catalog orders? Disptach a message to the Registrar faculty desk.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#E37180]/10 text-[#E37180] flex items-center justify-center font-bold"><Mail className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold text-slate-700">Email Address</p>
                    <p className="text-[10px] text-slate-450">nazarethschoolfestac@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#E37180]/10 text-[#E37180] flex items-center justify-center font-bold"><Phone className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold text-slate-700">Telephone Contact</p>
                    <p className="text-[10px] text-slate-450">+2349116409689</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#E37180]/10 text-[#E37180] flex items-center justify-center font-bold"><Info className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold text-slate-700">Registrar Office hours</p>
                    <p className="text-[10px] text-slate-450">Mon - Fri: 8:00 AM - 4:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form card */}
            <div className="lg:col-span-7 bg-white border border-slate-200 p-6 rounded-3xl text-left shadow-sm">
              {contactSubmitted ? (
                <div className="p-10 text-center flex flex-col items-center justify-center space-y-3 animate-fadeIn min-h-[300px]">
                  <div className="w-12 h-12 bg-[#2D346C]/15 text-[#E37180] rounded-full flex items-center justify-center"><Check className="w-6 h-6 text-[#E37180]" /></div>
                  <h4 className="font-bold text-slate-905">Message Dispatched!</h4>
                  <p className="text-xs text-slate-450">Thank you. The school registrar will contact you shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4 text-xs" id="contact-school-form">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="c-name" className="block font-semibold mb-1 text-slate-655">Your Name *</label>
                      <div className="relative">
                        <input
                          id="c-name"
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="e.g. Daniel Adamu"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 focus:outline-none focus:ring-1 focus:ring-[#2D346C]"
                        />
                        <User className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="c-email" className="block font-semibold mb-1 text-slate-655">Email Address *</label>
                      <div className="relative">
                        <input
                          id="c-email"
                          type="email"
                          required
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 focus:outline-none focus:ring-1 focus:ring-[#2D346C]"
                        />
                        <Mail className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="c-phone" className="block font-semibold mb-1 text-slate-655">Phone Number</label>
                    <div className="relative">
                      <input
                        id="c-phone"
                        type="text"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="+234..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 focus:outline-none focus:ring-1 focus:ring-[#2D346C]"
                      />
                      <Phone className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="c-msg" className="block font-semibold mb-1 text-slate-655">Your Message *</label>
                    <div className="relative">
                      <textarea
                        id="c-msg"
                        rows={4}
                        required
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Detail your request here..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pl-9 focus:outline-none focus:ring-1 focus:ring-[#2D346C]"
                      />
                      <MessageSquare className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>

                  <button
                    id="submit-contact-btn"
                    type="submit"
                    className="w-full py-3 bg-[#E37180] hover:bg-[#2D346C] text-white font-bold rounded-xl transition shadow cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Submit Ticket
                  </button>
                </form>
              )}
            </div>
          </section>

          {/* SECTION 9: FOOTER LINKS */}
          <footer className="bg-slate-900 text-white py-12 px-6 border-t border-slate-800" id="landing-footer">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-left text-xs mb-8">
              <div className="space-y-4">
                <Logo size="md" />
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Nazareth School Festac School Store and Student Portal Management System. A modern secure ERP platform.
                </p>
              </div>
              <div className="space-y-3">
                <h5 className="font-bold text-[#E37180] uppercase tracking-wider text-[11px]">Quick Navigation</h5>
                <div className="flex flex-col gap-2 text-slate-300">
                  <a href="https://nazarethpryschool.org" target="_blank" rel="noopener noreferrer" className="hover:text-[#E37180] transition flex items-center gap-1 text-[#E37180] font-semibold">
                    <Globe className="w-3 h-3" /> Back to Web (nazarethpryschool.org)
                  </a>
                  <a href="#features" className="hover:text-white transition">Features Ledger</a>
                  <a href="#how-it-works" className="hover:text-white transition">How it works</a>
                  <a href="#store-preview" className="hover:text-white transition">Store Requisitions</a>
                  <a href="#faq" className="hover:text-white transition">FAQ Hub</a>
                </div>
              </div>
              <div className="space-y-3">
                <h5 className="font-bold text-[#E37180] uppercase tracking-wider text-[11px]">Security & GDPR</h5>
                <div className="flex flex-col gap-2 text-slate-300">
                  <a href="#gdpr" className="hover:text-white transition">GDPR Rights</a>
                  <a href="#privacy" className="hover:text-white transition">Privacy Policy</a>
                  <a href="#terms" className="hover:text-white transition">Terms & Conditions</a>
                </div>
              </div>
              <div className="space-y-3">
                <h5 className="font-bold text-[#E37180] uppercase tracking-wider text-[11px]">Contact Helpdesk</h5>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Nazareth School Festac Campus Block A<br />
                  nazarethschoolfestac@gmail.com<br />
                  +2349116409689
                </p>
              </div>
            </div>

            <div className="max-w-7xl mx-auto border-t border-slate-800 pt-6 flex flex-col sm:flex-row justify-between items-center text-slate-400 text-[10px] gap-4">
              <p className="uppercase tracking-widest font-semibold">
                &copy; {new Date().getFullYear()} Nazareth School Festac &bull; Secure Management System &bull; Designed by <a href="https://hltsltd.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#E37180] text-slate-300 underline">HLTS LTD</a>
              </p>
              <div className="flex gap-4 font-bold uppercase">
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Facebook</a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Twitter</a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">LinkedIn</a>
              </div>
            </div>
          </footer>
        </>
      )}

    </div>
  );
};
