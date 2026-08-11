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
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<'admin' | 'parent' | 'student'>('admin');
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
            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-150 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider hidden sm:inline-flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-600" /> GDPR Secured
            </span>
          </div>

          {/* Desktop Menu items */}
          <div className="hidden lg:flex items-center gap-5">
            <a
              href="https://nazarethpryschool.org"
              className="text-xs font-bold text-[#065f46] hover:text-emerald-700 transition flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/70 rounded-xl border border-emerald-200/60 shadow-xs cursor-pointer"
              id="menu-item-back-to-web"
              title="Redirect to Main School Website (nazarethpryschool.org)"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-700" />
              <span>Back to Web</span>
            </a>
            {!isLoginOnly ? (
              <>
                <a href="#features" className="text-xs font-bold text-slate-600 hover:text-[#065f46] transition">Portal Features</a>
                <a href="#how-it-works" className="text-xs font-bold text-slate-600 hover:text-[#065f46] transition">Instructions</a>
                <a href="#store-preview" className="text-xs font-bold text-slate-600 hover:text-[#065f46] transition">School Store</a>
                <a href="#faq" className="text-xs font-bold text-slate-600 hover:text-[#065f46] transition">FAQ Hub</a>
                <button
                  onClick={() => { setIsLoginOnly(true); window.location.hash = "login"; }}
                  className="px-4 py-2 bg-[#065f46] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Access Portal
                </button>
              </>
            ) : (
              <button
                onClick={() => { setIsLoginOnly(false); window.location.hash = ""; }}
                className="text-xs font-bold text-[#065f46] hover:text-emerald-700 transition bg-emerald-50/50 hover:bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-100/50 cursor-pointer"
              >
                &larr; Return to Home Page
              </button>
            )}
          </div>

          {/* Medium / Tablet / Mobile Actions */}
          <div className="flex lg:hidden items-center gap-2">
            <a
              href="https://nazarethpryschool.org"
              className="text-xs font-bold text-[#065f46] hover:text-emerald-700 transition flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/70 rounded-xl border border-emerald-200/60 shadow-xs cursor-pointer"
              id="mobile-nav-back-to-web"
              title="Redirect to Main School Website"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-700" />
              <span>Back to Web</span>
            </a>

            {!isLoginOnly ? (
              <button
                onClick={() => { setIsLoginOnly(true); window.location.hash = "login"; }}
                className="px-3 py-1.5 bg-[#065f46] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Login
              </button>
            ) : (
              <button
                onClick={() => { setIsLoginOnly(false); window.location.hash = ""; }}
                className="text-xs font-bold text-[#065f46] bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-100 cursor-pointer"
              >
                &larr; Home
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-emerald-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
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
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#065f46] bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/60 transition cursor-pointer"
            >
              <Globe className="w-4 h-4 text-emerald-700" />
              <span>Back to Web (nazarethpryschool.org)</span>
            </a>
            {!isLoginOnly && (
              <>
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-[#065f46] hover:bg-slate-50 transition"
                >
                  Portal Features
                </a>
                <a
                  href="#how-it-works"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-[#065f46] hover:bg-slate-50 transition"
                >
                  Instructions
                </a>
                <a
                  href="#store-preview"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-[#065f46] hover:bg-slate-50 transition"
                >
                  School Store
                </a>
                <a
                  href="#faq"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-[#065f46] hover:bg-slate-50 transition"
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
          <section className="relative overflow-hidden bg-emerald-950 text-white py-20 px-6 md:px-12 text-left" id="hero-banner">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-800/40 via-emerald-950 to-slate-950 z-0"></div>
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
              
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs text-emerald-300 font-semibold animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" /> Next-Gen Academic ERP Platform
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
                  Premium Portal for<br />
                  <span className="text-emerald-400 bg-clip-text">Modern Schooling.</span>
                </h1>
                <p className="text-sm md:text-base text-slate-300 max-w-xl leading-relaxed">
                  Supercharge school store requisitions, daily attendance auditing, billing logs, and student metrics through our unified, role-restricted dashboard infrastructure.
                </p>
                <div className="flex flex-wrap gap-4 pt-2">
                  <button
                    onClick={() => { setIsLoginOnly(true); window.location.hash = "login"; }}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm rounded-xl transition shadow-lg cursor-pointer"
                  >
                    Access Portal Now
                  </button>
                  <a
                    href="#store-preview"
                    className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-sm font-bold transition text-center"
                  >
                    Browse Catalog
                  </a>
                </div>
              </div>

              {/* Stat Bento Grid on Hero */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-5 text-left">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Active Students</div>
                  <div className="text-3xl font-black font-mono text-emerald-400 mt-1">{pupils.length}</div>
                  <p className="text-[9px] text-slate-500 mt-0.5">Enrolled registry base</p>
                </div>
                <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-5 text-left">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Parent Profiles</div>
                  <div className="text-3xl font-black font-mono text-emerald-400 mt-1">{pupils.length}</div>
                  <p className="text-[9px] text-slate-500 mt-0.5">Verified child associations</p>
                </div>
                <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-5 text-left">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Store Catalog</div>
                  <div className="text-3xl font-black font-mono text-emerald-400 mt-1">{totalBooks}</div>
                  <p className="text-[9px] text-slate-500 mt-0.5">Available textbooks & wear</p>
                </div>
                <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-5 text-left">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Ledger Orders</div>
                  <div className="text-3xl font-black font-mono text-emerald-400 mt-1">{orders.length}</div>
                  <p className="text-[9px] text-slate-500 mt-0.5">Requisitions dispatched</p>
                </div>
              </div>

            </div>
          </section>

          {/* SECTION 2: FEATURES GRID */}
          <section className="py-20 px-6 max-w-7xl mx-auto text-center" id="features">
            <div className="space-y-3 mb-12">
              <span className="text-xs font-bold uppercase tracking-widest text-[#065f46]">Unified Ecosystem</span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Core Functional Components</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Robust modular dashboards built specifically for students, parents, and school administrators.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <div className="bg-white border border-slate-200 p-5 rounded-2xl text-left hover:border-slate-350 transition duration-200">
                <GraduationCap className="w-8 h-8 text-emerald-600 mb-3" />
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
                <CreditCard className="w-8 h-8 text-teal-600 mb-3" />
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
                <Clock className="w-8 h-8 text-emerald-600 mb-3" />
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
                <span className="text-xs font-bold uppercase tracking-widest text-[#065f46]">Getting Started</span>
                <h2 className="text-3xl font-extrabold tracking-tight">4-Step Portal Instructions</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
                
                {/* Step 1 */}
                <div className="space-y-3 relative text-center">
                  <div className="w-12 h-12 bg-[#065f46] text-white rounded-full flex items-center justify-center font-bold text-base mx-auto shadow-md">1</div>
                  <h4 className="font-bold text-sm text-slate-900 mt-3">Register</h4>
                  <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto leading-normal">
                    Admins add pupil files in bulk via Excel spreadsheet logs into Firestore database.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="space-y-3 relative text-center">
                  <div className="w-12 h-12 bg-[#065f46] text-white rounded-full flex items-center justify-center font-bold text-base mx-auto shadow-md">2</div>
                  <h4 className="font-bold text-sm text-slate-900 mt-3">Secure Login</h4>
                  <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto leading-normal">
                    Students and parents authenticate instantly using Surname and unique Registration IDs.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="space-y-3 relative text-center">
                  <div className="w-12 h-12 bg-[#065f46] text-white rounded-full flex items-center justify-center font-bold text-base mx-auto shadow-md">3</div>
                  <h4 className="font-bold text-sm text-slate-900 mt-3">Purchase/Manage</h4>
                  <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto leading-normal">
                    Order core books from the automated store. Pay via transfer and upload receipts.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="space-y-3 relative text-center">
                  <div className="w-12 h-12 bg-[#065f46] text-white rounded-full flex items-center justify-center font-bold text-base mx-auto shadow-md">4</div>
                  <h4 className="font-bold text-sm text-slate-900 mt-3">Track Progress</h4>
                  <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto leading-normal">
                    Review digital invoices, monitor attendance records, and inspect grading progress reports.
                  </p>
                </div>

              </div>
            </div>
          </section>

          {/* SECTION 4: SCHOOL STORE PREVIEW */}
          <section className="py-20 px-6 max-w-7xl mx-auto" id="store-preview">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-10 pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#065f46]">School Store Catalog</span>
                <h2 className="text-3xl font-extrabold tracking-tight mt-1.5">Material Requisitions Preview</h2>
                <p className="text-xs text-slate-500 mt-1">Directly order syllabus collections and uniform wear online.</p>
              </div>
              
              {/* Mini Cart Preview */}
              <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl flex items-center gap-2.5">
                <ShoppingCart className="w-4 h-4 text-[#065f46]" />
                <span className="text-xs font-bold text-[#065f46]">
                  Preview Cart: {Object.values(previewCart).reduce((s: number, c: number) => s + c, 0)} items
                </span>
                {Object.keys(previewCart).length > 0 && (
                  <button 
                    onClick={() => setPreviewCart({})}
                    className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded transition font-bold cursor-pointer"
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
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">{book.category}</span>
                    <span className="text-[10px] text-slate-450 font-mono font-bold">{book.classLevel}</span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{book.title}</h4>
                      <p className="text-[10px] text-slate-400 font-mono italic">by {book.author}</p>
                      <p className="text-xs text-slate-500 line-clamp-2 pt-1.5">{book.description}</p>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <span className="font-mono font-black text-sm text-slate-800">₦{book.price.toFixed(2)}</span>
                      <button
                        onClick={() => handleAddToCart(book.id)}
                        className="py-1 px-3 bg-[#065f46] hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold tracking-wide transition cursor-pointer"
                      >
                        Add to Cart +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 5: DASHBOARD SHOWCASE TABS */}
          <section className="bg-slate-900 text-white py-20 px-6" id="dashboard-showcase">
            <div className="max-w-7xl mx-auto space-y-12">
              <div className="text-center space-y-3">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Dashboard Previews</span>
                <h2 className="text-3xl font-extrabold tracking-tight">Inspect Our Portal Interfaces</h2>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Toggle views to inspect interactive dashboards configured for students, parents, and administrative suite.
                </p>
              </div>

              {/* Showcase Tab buttons */}
              <div className="flex justify-center border-b border-slate-800 max-w-md mx-auto">
                <button
                  onClick={() => setActiveShowcaseTab('admin')}
                  className={`flex-1 py-3 text-xs font-bold border-b-2 transition cursor-pointer ${
                    activeShowcaseTab === 'admin' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-450 hover:text-white'
                  }`}
                >
                  Admin View
                </button>
                <button
                  onClick={() => setActiveShowcaseTab('parent')}
                  className={`flex-1 py-3 text-xs font-bold border-b-2 transition cursor-pointer ${
                    activeShowcaseTab === 'parent' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-450 hover:text-white'
                  }`}
                >
                  Parent View
                </button>
                <button
                  onClick={() => setActiveShowcaseTab('student')}
                  className={`flex-1 py-3 text-xs font-bold border-b-2 transition cursor-pointer ${
                    activeShowcaseTab === 'student' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-450 hover:text-white'
                  }`}
                >
                  Student View
                </button>
              </div>

              {/* Mockup Display Box */}
              <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 max-w-4xl mx-auto shadow-2xl text-left space-y-4">
                {activeShowcaseTab === 'admin' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex justify-between items-center border-b border-slate-850 pb-3 flex-wrap gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-white">🛡️ Central Registrar Dashboard Mockup</h4>
                        <p className="text-[10px] text-slate-450 mt-0.5">Granular institutional records, attendance registry, and sales logs.</p>
                      </div>
                      <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">Restricted</span>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-4 space-y-3 border border-slate-850/50">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-950 rounded-lg border border-slate-850">
                          <span className="text-[9px] text-slate-500 block">Total Pupils</span>
                          <span className="text-xl font-black text-emerald-400 mt-1 block">5 onboarded</span>
                        </div>
                        <div className="p-3 bg-slate-950 rounded-lg border border-slate-850">
                          <span className="text-[9px] text-slate-500 block">Store Reserves</span>
                          <span className="text-xl font-black text-emerald-400 mt-1 block">570 books</span>
                        </div>
                        <div className="p-3 bg-slate-950 rounded-lg border border-slate-850">
                          <span className="text-[9px] text-slate-500 block">System State</span>
                          <span className="text-xl font-black text-emerald-400 mt-1 block">Active</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-450 leading-relaxed">
                        Contains excel import registry tools, database system purge triggers, manual item consignment entries, and central bookshop billing logs.
                      </p>
                    </div>
                  </div>
                )}

                {activeShowcaseTab === 'parent' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex justify-between items-center border-b border-slate-850 pb-3 flex-wrap gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-white">👪 Parental Supervision Portal Mockup</h4>
                        <p className="text-[10px] text-slate-450 mt-0.5">Ward performance trackers, digital invoice dispatch, and fee receipts.</p>
                      </div>
                      <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">Verified Access</span>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-4 space-y-3 border border-slate-855">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs">PS</div>
                        <div>
                          <p className="text-xs font-bold text-white">Preston Smith (Prep 2 Ward)</p>
                          <p className="text-[9px] text-slate-450">Linked Parent: Olivia Smith</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-450 leading-relaxed">
                        Provides access to daily attendance records, order history ledgers, invoice status logs (Pending / Ready for Pickup), and payment file uploader.
                      </p>
                    </div>
                  </div>
                )}

                {activeShowcaseTab === 'student' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex justify-between items-center border-b border-slate-855 pb-3 flex-wrap gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-white">🎓 Student Portal & Material Requisitions Mockup</h4>
                        <p className="text-[10px] text-slate-450 mt-0.5">Syllabus catalog ordering, profile credentials, and attendance grids.</p>
                      </div>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">Verified Access</span>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-4 space-y-3 border border-slate-855">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs">DO</div>
                        <div>
                          <p className="text-xs font-bold text-white">Daniel Okon (Primary 1 Pupil)</p>
                          <p className="text-[9px] text-slate-450">Reg ID: NS/2026/001</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-450 leading-relaxed">
                        Enables students to add books and wear to cart, trigger desk orders, review notifications feed, and inspect daily attendance.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 6: TESTIMONIALS */}
          <section className="py-20 px-6 max-w-7xl mx-auto text-center" id="testimonials">
            <div className="space-y-3 mb-12">
              <span className="text-xs font-bold uppercase tracking-widest text-[#065f46]">Trust & Feedback</span>
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
                  "I love the notifications panel. Every time my payment is approved or the books are ready for pick-up, my portal dashboard shows the green checkmarks immediately. No more queue lines!"
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
                <span className="text-xs font-bold uppercase tracking-widest text-[#065f46]">Onboarding Center</span>
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
                <span className="text-xs font-bold uppercase tracking-widest text-[#065f46]">Contact Us</span>
                <h2 className="text-3xl font-extrabold tracking-tight">Get in Touch</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Have questions about the student portal, institutional enrollment, or store catalog orders? Disptach a message to the Registrar faculty desk.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold"><Mail className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold text-slate-700">Email Address</p>
                    <p className="text-[10px] text-slate-450">nazarethschoolfestac@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold"><Phone className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold text-slate-700">Telephone Contact</p>
                    <p className="text-[10px] text-slate-450">+2349116409689</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold"><Info className="w-4 h-4" /></div>
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
                  <div className="w-12 h-12 bg-emerald-100 text-[#065f46] rounded-full flex items-center justify-center"><Check className="w-6 h-6" /></div>
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
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 focus:outline-none"
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
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 focus:outline-none"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 focus:outline-none"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pl-9 focus:outline-none"
                      />
                      <MessageSquare className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>

                  <button
                    id="submit-contact-btn"
                    type="submit"
                    className="w-full py-3 bg-[#065f46] hover:bg-emerald-600 text-white font-bold rounded-xl transition shadow cursor-pointer flex items-center justify-center gap-1.5"
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
                <h5 className="font-bold text-emerald-400">Quick Navigation</h5>
                <div className="flex flex-col gap-2 text-slate-400">
                  <a href="https://nazarethpryschool.org" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition flex items-center gap-1 text-emerald-300 font-semibold">
                    <Globe className="w-3 h-3" /> Back to Web (nazarethpryschool.org)
                  </a>
                  <a href="#features" className="hover:text-white transition">Features Ledger</a>
                  <a href="#how-it-works" className="hover:text-white transition">How it works</a>
                  <a href="#store-preview" className="hover:text-white transition">Store Requisitions</a>
                  <a href="#faq" className="hover:text-white transition">FAQ Hub</a>
                </div>
              </div>
              <div className="space-y-3">
                <h5 className="font-bold text-emerald-400">Security & GDPR</h5>
                <div className="flex flex-col gap-2 text-slate-400">
                  <a href="#gdpr" className="hover:text-white transition">GDPR Rights</a>
                  <a href="#privacy" className="hover:text-white transition">Privacy Policy</a>
                  <a href="#terms" className="hover:text-white transition">Terms & Conditions</a>
                </div>
              </div>
              <div className="space-y-3">
                <h5 className="font-bold text-emerald-400">Contact Helpdesk</h5>
                <p className="text-slate-400 text-[11px]">
                  Nazareth School Festac Campus Block A<br />
                  nazarethschoolfestac@gmail.com<br />
                  +2349116409689
                </p>
              </div>
            </div>

            <div className="max-w-7xl mx-auto border-t border-slate-800 pt-6 flex flex-col sm:flex-row justify-between items-center text-slate-500 text-[10px] gap-4">
              <p className="uppercase tracking-widest font-semibold">
                &copy; {new Date().getFullYear()} Nazareth School Festac &bull; Secure Management System &bull; Designed by <a href="https://hltsltd.com" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 underline">HLTS LTD</a>
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
