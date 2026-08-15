import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { BookItem, Pupil, Order, AppNotification, ClassLevel, OrderItem, ContactSubmission } from '../types';
import { Logo } from './Logo';
import {
  FileText, Plus, Database, Inbox, UserPlus, FileSpreadsheet, Send, TrendingUp, CheckCircle,
  AlertTriangle, RefreshCw, Trash2, Search, Edit3, Save, Check, X, Mail, ShieldAlert, Globe
} from 'lucide-react';

interface AdminDashboardProps {
  books: BookItem[];
  pupils: Pupil[];
  orders: Order[];
  notifications: AppNotification[];
  contacts: ContactSubmission[];
  onUpdateBooks: (newBooks: BookItem[]) => void;
  onUpdatePupils: (newPupils: Pupil[]) => void;
  onUpdateOrders: (newOrders: Order[]) => void;
  onUpdateNotifications: (newNotifications: AppNotification[]) => void;
  onUpdateContacts: (newContacts: ContactSubmission[]) => void;
  onLogout: () => void;
  onSystemPurge?: () => Promise<void>;
  onImpersonate?: (role: 'pupil' | 'parent', pupil: Pupil) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  books,
  pupils,
  orders,
  notifications,
  contacts,
  onUpdateBooks,
  onUpdatePupils,
  onUpdateOrders,
  onUpdateNotifications,
  onUpdateContacts,
  onLogout,
  onSystemPurge,
  onImpersonate,
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'onboarding' | 'orders' | 'analytics' | 'contacts'>('inventory');
  const [selectedPupilClass, setSelectedPupilClass] = useState<ClassLevel>('Primary 1');
  const [selectedPupilIds, setSelectedPupilIds] = useState<string[]>([]);

  // GDPR Safe Reset Tracker
  const [gdprAuditOpen, setGdprAuditOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<{ url: string; filename: string } | null>(null);

  // Contact tab states
  const [searchContactTerm, setSearchContactTerm] = useState('');
  const [contactFilter, setContactFilter] = useState<'All' | 'Pending' | 'Read' | 'Resolved'>('All');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // -------------------------
  // INVENTORY TAB LOGIC
  // -------------------------
  const [searchBookTerm, setSearchBookTerm] = useState('');
  const [filterClass, setFilterClass] = useState<string>('All');
  const [newBook, setNewBook] = useState<Partial<BookItem>>({
    title: '', author: '', price: 15.0, classLevel: 'Primary 1', category: 'Textbook', stock: 25, description: '', shoeSize: '', uniformSize: ''
  });
  const [bookSuccessMsg, setBookSuccessMsg] = useState('');
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editBookData, setEditBookData] = useState<Partial<BookItem>>({});


  const handleAddBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBook.title || !newBook.author || !newBook.price) {
      alert('Please fill out Title, Author, and Price.');
      return;
    }
    const created: BookItem = {
      id: 'bk-' + Date.now(),
      title: newBook.title,
      author: newBook.author,
      price: Number(newBook.price),
      classLevel: (newBook.classLevel as ClassLevel) || 'Primary 1',
      category: newBook.category as any || 'Textbook',
      stock: Number(newBook.stock) || 10,
      description: newBook.description || 'Scholastic material for Nazareth School curriculum support.',
      shoeSize: newBook.shoeSize || '',
      uniformSize: newBook.uniformSize || '',
    };

    const updated = [created, ...books];
    onUpdateBooks(updated);

    // Add systemic notification
    const newNotif: AppNotification = {
      id: 'not-' + Date.now(),
      title: 'New Stock Added',
      message: `"${created.title}" added to inventory list for ${created.classLevel}.`,
      type: 'info',
      timestamp: new Date().toISOString(),
      read: false,
      role: 'admin'
    };
    onUpdateNotifications([newNotif, ...notifications]);

    setNewBook({
      title: '', author: '', price: 15.0, classLevel: 'Primary 1', category: 'Textbook', stock: 25, description: '', shoeSize: '', uniformSize: ''
    });
    setBookSuccessMsg('Study material catalogued successfully!');
    setTimeout(() => setBookSuccessMsg(''), 4000);
  };

  const handleAdjustStock = (bookId: string, current: number, amount: number) => {
    const updated = books.map(b => {
      if (b.id === bookId) {
        return { ...b, stock: Math.max(0, current + amount) };
      }
      return b;
    });
    onUpdateBooks(updated);
  };

  const handleDeleteBook = (bookId: string) => {
    if (confirm('Are you sure you want to remove this book from the Nazareth catalog?')) {
      onUpdateBooks(books.filter(b => b.id !== bookId));
    }
  };

  const handleStartEditBook = (book: BookItem) => {
    setEditingBookId(book.id);
    setEditBookData({ ...book });
  };

  const handleCancelEditBook = () => {
    setEditingBookId(null);
    setEditBookData({});
  };

  const handleSaveEditBook = () => {
    if (!editBookData.title || !editBookData.author || editBookData.price === undefined) {
      alert('Title, Author, and Price are required.');
      return;
    }

    const updated = books.map(b => {
      if (b.id === editingBookId) {
        return {
          ...b,
          title: editBookData.title!,
          author: editBookData.author!,
          price: Number(editBookData.price),
          classLevel: editBookData.classLevel || b.classLevel,
          category: editBookData.category || b.category,
          stock: Number(editBookData.stock) ?? b.stock,
          shoeSize: editBookData.shoeSize ?? b.shoeSize,
          uniformSize: editBookData.uniformSize ?? b.uniformSize,
          description: editBookData.description ?? b.description,
        };
      }
      return b;
    });

    onUpdateBooks(updated);
    setEditingBookId(null);
    setEditBookData({});

    // Add systemic notification
    const newNotif: AppNotification = {
      id: 'not-' + Date.now(),
      title: 'Stock Updated',
      message: `"${editBookData.title}" details updated in inventory.`,
      type: 'info',
      timestamp: new Date().toISOString(),
      read: false,
      role: 'admin'
    };
    onUpdateNotifications([newNotif, ...notifications]);
  };


  // Classes listing
  const CLASS_LEVELS: ClassLevel[] = [
    'Kindergarten', 'Pre-Nursery', 'Prep 1', 'Prep 2',
    'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'
  ];

  // -------------------------
  // EXCEL BULK ONBOARDING LOGIC
  // -------------------------
  const [onboardPreview, setOnboardPreview] = useState<Partial<Pupil>[]>([]);
  const [onboardSuccess, setOnboardSuccess] = useState('');

  const handleLoadSampleData = () => {
    const parsed: Partial<Pupil>[] = [
      {
        id: 'temp-0-' + Date.now(),
        surname: 'Nwachukwu',
        firstName: 'Chima',
        classLevel: 'Primary 1',
        parentName: 'Mr. Nwachukwu',
        parentEmail: 'nwachukwu.p@example.com',
        parentPhone: '+2348011223344',
        regNo: 'NS/2026/' + String(100 + pupils.length + 1)
      },
      {
        id: 'temp-1-' + Date.now(),
        surname: 'Adeleke',
        firstName: 'Adebayo',
        classLevel: 'Primary 3',
        parentName: 'Dr. Adeleke',
        parentEmail: 'adeleke.p@example.com',
        parentPhone: '+2348022334455',
        regNo: 'NS/2026/' + String(100 + pupils.length + 2)
      },
      {
        id: 'temp-2-' + Date.now(),
        surname: 'Vance',
        firstName: 'Arthur',
        classLevel: 'Prep 1',
        parentName: 'George Vance',
        parentEmail: 'vance.p@example.com',
        parentPhone: '+447123112233',
        regNo: 'NS/2026/' + String(100 + pupils.length + 3)
      },
      {
        id: 'temp-3-' + Date.now(),
        surname: 'Bello',
        firstName: 'Aisha',
        classLevel: 'Kindergarten',
        parentName: 'Alhaji Bello',
        parentEmail: 'bello.p@example.com',
        parentPhone: '+2349033445566',
        regNo: 'NS/2026/' + String(100 + pupils.length + 4)
      }
    ];
    setOnboardPreview(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

        if (data.length === 0) {
          alert("The selected spreadsheet is empty.");
          return;
        }

        let startRow = 0;
        const firstRow = data[0];
        const colIndices = {
          surname: 0,
          firstName: 1,
          classLevel: 2,
          parentName: 3,
          parentEmail: 4,
          parentPhone: 5,
          regNo: -1
        };

        if (firstRow && firstRow.some(cell => {
          const name = String(cell || '').toLowerCase().trim();
          return ['surname', 'lastname', 'first name', 'class', 'parent', 'guardian', 'email', 'reg no', 'regno', 'registration', 'adm no'].some(kw => name.includes(kw));
        })) {
          startRow = 1;
          firstRow.forEach((cell, idx) => {
            const name = String(cell || '').toLowerCase().trim();
            if (!name) return;

            // Check for Reg No first to ensure unique match
            if (
              name.includes('reg') ||
              name.includes('adm') ||
              name.includes('number') ||
              name.includes('id') ||
              name.includes('roll')
            ) {
              if (!name.includes('parent') && !name.includes('email') && !name.includes('phone')) {
                colIndices.regNo = idx;
              }
            }

            // Check for Surname
            if (name.includes('surname') || name.includes('lastname') || name === 'last' || name.includes('last name')) {
              colIndices.surname = idx;
            }

            // Check for First Name
            if (name.includes('first name') || name.includes('firstname') || name === 'first') {
              colIndices.firstName = idx;
            }

            // Check for Class
            if (name.includes('class') || name.includes('grade') || name.includes('level')) {
              colIndices.classLevel = idx;
            }

            // Check for Parent Name
            if (name.includes('parent name') || name === 'parent' || name.includes('guardian') || name.includes('parent guardian')) {
              colIndices.parentName = idx;
            }

            // Check for Parent Email
            if (name.includes('email') || name.includes('mail')) {
              colIndices.parentEmail = idx;
            }

            // Check for Parent Phone
            if (name.includes('phone') || name.includes('mobile') || name.includes('contact') || name.includes('tel')) {
              colIndices.parentPhone = idx;
            }
          });
        }

        // If regNo column index is not found but there are at least 7 columns in the first row,
        // assume column 7 (index 6) is the registration number.
        if (colIndices.regNo === -1 && firstRow && firstRow.length >= 7) {
          colIndices.regNo = 6;
        }

        const parsed: Partial<Pupil>[] = [];
        for (let i = startRow; i < data.length; i++) {
          const row = data[i];
          if (row && row.length >= 2) {
            const manualRegNo = colIndices.regNo !== -1 && row[colIndices.regNo] ? String(row[colIndices.regNo]).trim() : '';
            parsed.push({
              id: 'temp-' + i + '-' + Date.now(),
              surname: String(row[colIndices.surname] || '').trim() || 'Surname',
              firstName: String(row[colIndices.firstName] || '').trim() || 'Firstname',
              classLevel: (String(row[colIndices.classLevel] || '').trim() as ClassLevel) || 'Primary 1',
              parentName: String(row[colIndices.parentName] || '').trim() || 'Parent Guardian',
              parentEmail: String(row[colIndices.parentEmail] || '').trim() || 'parent@example.com',
              parentPhone: String(row[colIndices.parentPhone] || '').trim() || '+23400000000',
              regNo: manualRegNo || ('NS/2026/' + String(100 + pupils.length + parsed.length + 1))
            });
          }
        }

        setOnboardPreview(parsed);
      } catch (err) {
        console.error(err);
        alert("Error parsing spreadsheet file. Please check that it is a valid .xlsx, .xls or .csv file.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleTableFieldChange = (idx: number, field: keyof Pupil, val: string) => {
    const updated = [...onboardPreview];
    updated[idx] = { ...updated[idx], [field]: val };
    setOnboardPreview(updated);
  };

  const handleAddNewPreviewRow = () => {
    const nextIndex = onboardPreview.length;
    const nextReg = 'NS/2026/' + String(100 + pupils.length + nextIndex + 1);
    setOnboardPreview([...onboardPreview, {
      id: 'temp-' + nextIndex + '-' + Date.now(),
      surname: '',
      firstName: '',
      classLevel: 'Primary 1',
      parentName: '',
      parentEmail: '',
      parentPhone: '',
      regNo: nextReg
    }]);
  };

  const handleCommitOnboarding = () => {
    // Dynamically assign default reg numbers only to rows that don't have one manually entered
    const updatedPreview = onboardPreview.map((s, idx) => {
      if (!s.regNo || !s.regNo.trim()) {
        return {
          ...s,
          regNo: 'NS/2026/' + String(100 + pupils.length + idx + 1)
        };
      }
      return { ...s, regNo: s.regNo.trim() };
    });

    const invalid = updatedPreview.some(s => !s.surname || !s.firstName);
    if (invalid) {
      alert('Please complete all Surnames and First Names before committing.');
      return;
    }

    // Check for duplicate reg numbers within the preview list itself
    const regNos = updatedPreview.map(s => s.regNo!.toLowerCase());
    const hasDuplicatesInBatch = regNos.some((reg, index) => regNos.indexOf(reg) !== index);
    if (hasDuplicatesInBatch) {
      alert('Error: There are duplicate Registration Numbers in the preview list. Each pupil must have a unique Registration Number.');
      return;
    }

    // Check for duplicate reg numbers against already registered pupils
    const existingRegNos = new Set(pupils.map(p => p.regNo.toLowerCase().trim()));
    const hasExistingDuplicates = regNos.some(reg => existingRegNos.has(reg));
    if (hasExistingDuplicates) {
      alert('Error: One or more Registration Numbers already exist in the system. Please ensure all Registration Numbers are unique.');
      return;
    }

    const pupilsToAdd: Pupil[] = updatedPreview.map((s, idx) => ({
      id: 'std-' + (pupils.length + idx + 1) + '-' + Date.now(),
      surname: s.surname!,
      firstName: s.firstName!,
      classLevel: (s.classLevel as ClassLevel) || 'Primary 1',
      regNo: s.regNo!,
      parentName: s.parentName || 'Guardian',
      parentEmail: s.parentEmail || 'guardian@example.com',
      parentPhone: s.parentPhone || '+23400000'
    }));

    onUpdatePupils([...pupils, ...pupilsToAdd]);

    const sysNotif: AppNotification = {
      id: 'not-' + Date.now(),
      title: 'Bulk Onboarding Executed',
      message: `Successfully batch registered ${pupilsToAdd.length} pupils into high-level registry with credentials.`,
      type: 'success',
      timestamp: new Date().toISOString(),
      read: false,
      role: 'admin'
    };
    onUpdateNotifications([sysNotif, ...notifications]);

    setOnboardPreview([]);
    setOnboardSuccess(`Onboarded ${pupilsToAdd.length} pupils successfully! They can now log in using Surname (username) and Reg No (password).`);
    setTimeout(() => setOnboardSuccess(''), 6000);
  };

  const handleDeletePupil = (pupilId: string) => {
    const updated = pupils.filter((p) => p.id !== pupilId);
    onUpdatePupils(updated);

    // Create system notification
    const newNotif: AppNotification = {
      id: 'not-del-pupil-' + Date.now(),
      title: 'Pupil Account Deleted',
      message: `A pupil account has been deleted from the registrar database.`,
      type: 'info',
      timestamp: new Date().toISOString(),
      read: false,
      role: 'admin',
    };
    onUpdateNotifications([newNotif, ...notifications]);
  };

  const handleToggleSelectPupil = (pupilId: string) => {
    setSelectedPupilIds(prev =>
      prev.includes(pupilId) ? prev.filter(id => id !== pupilId) : [...prev, pupilId]
    );
  };

  const handleToggleSelectAllPupils = (classPupils: Pupil[]) => {
    const classPupilIds = classPupils.map(p => p.id);
    const allSelected = classPupilIds.every(id => selectedPupilIds.includes(id));
    if (allSelected) {
      setSelectedPupilIds(prev => prev.filter(id => !classPupilIds.includes(id)));
    } else {
      setSelectedPupilIds(prev => {
        const otherSelected = prev.filter(id => !classPupilIds.includes(id));
        return [...otherSelected, ...classPupilIds];
      });
    }
  };

  const handleDeleteAllPupilsInClass = () => {
    const classPupils = pupils.filter(p => p.classLevel === selectedPupilClass);
    if (classPupils.length === 0) return;

    if (confirm(`WARNING: Are you sure you want to permanently delete all ${classPupils.length} pupils in ${selectedPupilClass}?`)) {
      const classPupilIds = new Set(classPupils.map(p => p.id));
      const updated = pupils.filter(p => !classPupilIds.has(p.id));
      onUpdatePupils(updated);
      setSelectedPupilIds(prev => prev.filter(id => !classPupilIds.has(id)));

      const newNotif: AppNotification = {
        id: 'not-del-all-pupils-' + Date.now(),
        title: `Class Registry Purged: ${selectedPupilClass}`,
        message: `All ${classPupils.length} pupil profiles in ${selectedPupilClass} have been deleted.`,
        type: 'warning',
        timestamp: new Date().toISOString(),
        read: false,
        role: 'admin',
      };
      onUpdateNotifications([newNotif, ...notifications]);
    }
  };

  const handleMoveSelectedPupils = (targetClass: ClassLevel) => {
    if (selectedPupilIds.length === 0) return;

    const classPupils = pupils.filter(p => p.classLevel === selectedPupilClass && selectedPupilIds.includes(p.id));
    if (classPupils.length === 0) return;

    if (confirm(`Are you sure you want to move the ${classPupils.length} selected pupils from ${selectedPupilClass} to ${targetClass}?`)) {
      const selectedSet = new Set(selectedPupilIds);
      const updated = pupils.map(p => {
        if (selectedSet.has(p.id) && p.classLevel === selectedPupilClass) {
          return { ...p, classLevel: targetClass };
        }
        return p;
      });
      onUpdatePupils(updated);
      setSelectedPupilIds(prev => prev.filter(id => !selectedSet.has(id)));

      const newNotif: AppNotification = {
        id: 'not-move-pupils-' + Date.now(),
        title: 'Pupils Reassigned',
        message: `Successfully moved ${classPupils.length} pupils from ${selectedPupilClass} to ${targetClass}.`,
        type: 'info',
        timestamp: new Date().toISOString(),
        read: false,
        role: 'admin',
      };
      onUpdateNotifications([newNotif, ...notifications]);
    }
  };

  // -------------------------
  // ORDERS DISPATCH LOGIC
  // -------------------------
  const handleUpdateOrderStatus = (orderId: string, newStatus: any) => {
    const updated = orders.map(o => {
      if (o.id === orderId) {
        return { ...o, status: newStatus };
      }
      return o;
    });
    onUpdateOrders(updated);

    // Notify pupil
    const targetOrder = orders.find(o => o.id === orderId);
    if (targetOrder) {
      const pupilNotif: AppNotification = {
        id: 'not-order-' + orderId + '-' + Date.now(),
        title: `Bookshop Order Status: ${newStatus}`,
        message: `Your material requisition invoice [${targetOrder.invoiceNo}] has been updated to "${newStatus}". Dispatch coordinates: Station A desk.`,
        type: newStatus === 'Completed' ? 'success' : 'info',
        timestamp: new Date().toISOString(),
        read: false,
        role: 'pupil',
        recipientId: targetOrder.pupilRegNo
      };
      onUpdateNotifications([pupilNotif, ...notifications]);
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    if (confirm('Cancel this pending order ledger record?')) {
      const targetOrder = orders.find(o => o.id === orderId);
      if (targetOrder && targetOrder.status !== 'Cancelled') {
        const updatedBooks = books.map(b => {
          const item = targetOrder.items.find(it => it.bookId === b.id);
          if (item) {
            return { ...b, stock: b.stock + item.quantity };
          }
          return b;
        });
        onUpdateBooks(updatedBooks);
      }
      const updated = orders.map(o => o.id === orderId ? { ...o, status: 'Cancelled' as const } : o);
      onUpdateOrders(updated);
    }
  };

  const handleDeleteOrderPermanently = (orderId: string) => {
    if (confirm('Are you sure you want to permanently delete this invoice? This will also remove it from the system and Firestore.')) {
      const targetOrder = orders.find(o => o.id === orderId);
      if (targetOrder && targetOrder.status !== 'Cancelled') {
        const updatedBooks = books.map(b => {
          const item = targetOrder.items.find(it => it.bookId === b.id);
          if (item) {
            return { ...b, stock: b.stock + item.quantity };
          }
          return b;
        });
        onUpdateBooks(updatedBooks);
      }
      const updated = orders.filter(o => o.id !== orderId);
      onUpdateOrders(updated);
    }
  };

  // -------------------------
  // GDPR SANDBOX AUDITOR 
  // -------------------------
  const handleDownloadBackup = () => {
    const dataBackup = {
      school: 'Nazareth School Bookshop Portal Backup',
      dateExport: new Date().toISOString(),
      pupilRegistry: pupils,
      bookCatalog: books,
      orderHistory: orders,
      contactSubmissions: contacts
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataBackup, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'nazareth_institutional_gdpr_backup.json');
    dlAnchor.click();
  };

  const handleSystemPurge = async () => {
    if (confirm('WARNING: This will completely flush all custom LocalStorage records and permanently delete all documents from the database. No factory re-seeding will be done. Do you wish to proceed?')) {
      localStorage.clear();
      if (onSystemPurge) {
        await onSystemPurge();
      }
      window.location.reload();
    }
  };


  // -------------------------
  // CONTACT SUBMISSIONS LOGIC
  // -------------------------
  const handleUpdateContactStatus = (contactId: string, newStatus: 'Pending' | 'Read' | 'Resolved') => {
    const updated = contacts.map(c => c.id === contactId ? { ...c, status: newStatus } : c);
    onUpdateContacts(updated);
  };

  const handleDeleteContact = (contactId: string) => {
    if (confirm('Are you sure you want to permanently delete this contact message?')) {
      const updated = contacts.filter(c => c.id !== contactId);
      onUpdateContacts(updated);
      if (selectedContactId === contactId) {
        setSelectedContactId(null);
      }
    }
  };


  // -------------------------
  // RENDER COMPUTED STATS
  // -------------------------
  const totalMaterialPurchased = orders.filter(o => o.status !== 'Cancelled').reduce((sum, o) => sum + o.totalAmount, 0);
  const criticalStockAlerts = books.filter(b => b.stock <= 5).length;

  const filteredBooks = books.filter((b) => {
    const matchesSearch = b.title.toLowerCase().includes(searchBookTerm.toLowerCase()) || b.author.toLowerCase().includes(searchBookTerm.toLowerCase());
    const matchesClass = filterClass === 'All' || b.classLevel === filterClass;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col" id="admin-workspace">

      {/* Upper Navigation Rail */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap gap-4 items-center justify-between shadow-xs" id="admin-navbar">
        <div className="flex items-center gap-4">
          <Logo size="md" />
          <span className="text-[10px] bg-emerald-50 border border-emerald-150 text-[#065f46] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            Faculty Suite
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://nazarethpryschool.org"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
            id="admin-nav-back-to-web"
            title="Redirect to Main School Website"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Back to Web</span>
          </a>
          <button
            onClick={() => setGdprAuditOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-xs border border-slate-200 rounded-xl text-slate-700 font-semibold transition cursor-pointer"
          >
            Audit System Logs (GDPR)
          </button>
          <button
            onClick={onLogout}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Exit Workspace
          </button>
        </div>
      </nav>

      {/* Stats Board banner */}
      <div className="py-4 px-4 md:px-8 mt-4" id="admin-summary-grid">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 bg-white border border-slate-200 rounded-3xl text-left shadow-xs">
            <div className="text-[11px] uppercase font-bold tracking-wider text-[#065f46]">Onboarded Pupils</div>
            <div className="text-3xl font-black font-mono text-slate-900 mt-1.5">{pupils.length}</div>
            <div className="text-[10px] text-slate-450 mt-1">Total Active Logins</div>
          </div>
          <div className="p-5 bg-white border border-slate-200 rounded-3xl text-left shadow-xs">
            <div className="text-[11px] uppercase font-bold tracking-wider text-[#065f46]">Gross Material Sales</div>
            <div className="text-3xl font-black font-mono text-slate-900 mt-1.5">₦{totalMaterialPurchased.toFixed(2)}</div>
            <div className="text-[10px] text-slate-450 mt-1">Processed Invoices</div>
          </div>
          <div className="p-5 bg-white border border-slate-200 rounded-3xl text-left shadow-xs">
            <div className="text-[11px] uppercase font-bold tracking-wider text-rose-700">Shortage Items (&lt;=5)</div>
            <div className="text-3xl font-black font-mono text-rose-600 mt-1.5">{criticalStockAlerts}</div>
            <div className="text-[10px] text-slate-450 mt-1">Needs urgent ordering</div>
          </div>
          <div className="p-5 bg-white border border-slate-200 rounded-3xl text-left shadow-xs">
            <div className="text-[11px] uppercase font-bold tracking-wider text-[#065f46]">Store Stock Reserves</div>
            <div className="text-3xl font-black font-mono text-slate-900 mt-1.5">
              {books.reduce((sum, b) => sum + b.stock, 0)}
            </div>
            <div className="text-[10px] text-slate-450 mt-1">Total materials in stock</div>
          </div>
        </div>
      </div>

      {/* Tab Control */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-8 mt-2">
        <div className="flex border border-slate-200 overflow-x-auto gap-1 bg-white p-1.5 rounded-2xl" id="admin-workspace-tabs">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${activeTab === 'inventory' ? 'bg-[#065f46] text-white shadow-xs' : 'text-slate-500 hover:text-[#065f46]'
              }`}
          >
            <Database className="w-4 h-4" /> Bookshop Catalog
          </button>
          <button
            onClick={() => setActiveTab('onboarding')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${activeTab === 'onboarding' ? 'bg-[#065f46] text-white shadow-[#065f46]/20 shadow-sm' : 'text-slate-500 hover:text-[#065f46]'
              }`}
          >
            <UserPlus className="w-4 h-4" /> Excel Bulk Onboarder
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${activeTab === 'orders' ? 'bg-[#065f46] text-white shadow-[#065f46]/20 shadow-sm' : 'text-slate-500 hover:text-[#065f46]'
              }`}
          >
            <Inbox className="w-4 h-4" /> Pupil Ledger Invoices
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${activeTab === 'analytics' ? 'bg-[#065f46] text-white shadow-[#065f46]/20 shadow-sm' : 'text-slate-500 hover:text-[#065f46]'
              }`}
          >
            <TrendingUp className="w-4 h-4" /> Sales Analytics
          </button>
          <button
            id="admin-contacts-tab"
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${activeTab === 'contacts' ? 'bg-[#065f46] text-white shadow-[#065f46]/20 shadow-sm' : 'text-slate-500 hover:text-[#065f46]'
              }`}
          >
            <Mail className="w-4 h-4" /> Contact Messages
          </button>
        </div>
      </div>

      {/* Main Sandbox Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8" id="admin-tab-workspace-view">

        {/* 1. INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="admin-inventory-tab">
            {/* Left Col: Stock Add Form */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-6 h-fit space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-850 pb-3">
                <h3 className="font-sans font-bold text-base text-slate-900 dark:text-white tracking-tight">
                  New Material Consignment
                </h3>
                <p className="text-xs text-slate-500 mt-1">Onboard textbook reserves according to academic key sections.</p>
              </div>

              {bookSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-medium animate-pulse" id="consignment-alert">
                  {bookSuccessMsg}
                </div>
              )}

              <form onSubmit={handleAddBook} className="space-y-3.5 text-xs text-left" id="add-consignment-form">
                <div>
                  <label htmlFor="b-title" className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">Book/Item Title</label>
                  <input
                    id="b-title"
                    type="text"
                    required
                    placeholder="e.g. Modern Primary Geography Bk 1"
                    value={newBook.title}
                    onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="b-author" className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">Author</label>
                    <input
                      id="b-author"
                      type="text"
                      required
                      placeholder="e.g. O. Adeniyi"
                      value={newBook.author}
                      onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5"
                    />
                  </div>
                  <div>
                    <label htmlFor="b-price" className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">Unit Price (₦)</label>
                    <input
                      id="b-price"
                      type="number"
                      step="0.01"
                      required
                      value={newBook.price}
                      onChange={(e) => setNewBook({ ...newBook, price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="b-class" className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">Target Class</label>
                    <select
                      id="b-class"
                      value={newBook.classLevel}
                      onChange={(e) => setNewBook({ ...newBook, classLevel: e.target.value as ClassLevel })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                    >
                      <option value="All Classes">All Classes</option>
                      {CLASS_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="b-stock" className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">Initial Stock</label>
                    <input
                      id="b-stock"
                      type="number"
                      value={newBook.stock}
                      onChange={(e) => setNewBook({ ...newBook, stock: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="b-category" className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">Material Category</label>
                  <select
                    id="b-category"
                    value={newBook.category}
                    onChange={(e) => setNewBook({ ...newBook, category: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  >
                    <option value="Textbook">Core Textbook</option>
                    <option value="Notebook">Exercise Workbook</option>
                    <option value="Stationery">Pencils, Pens & Erasers</option>
                    <option value="Uniform">School Uniform / Wear</option>
                    <option value="Utility">School Bag & Utilities</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="b-shoe-size" className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">Shoe Size (Optional)</label>
                    <select
                      id="b-shoe-size"
                      value={newBook.shoeSize || ''}
                      onChange={(e) => setNewBook({ ...newBook, shoeSize: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded-lg p-2 focus:outline-none"
                    >
                      <option value="">None / Select</option>
                      <option value="All Sizes">All Sizes</option>
                      {Array.from({ length: 18 }, (_, i) => 28 + i).map((size) => (
                        <option key={size} value={size.toString()}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="b-uniform-size" className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">Uniform Size (Optional)</label>
                    <select
                      id="b-uniform-size"
                      value={newBook.uniformSize || ''}
                      onChange={(e) => setNewBook({ ...newBook, uniformSize: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded-lg p-2 focus:outline-none"
                    >
                      <option value="">None / Select</option>
                      <option value="All Sizes">All Sizes</option>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="b-desc" className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">Item Details</label>
                  <textarea
                    id="b-desc"
                    rows={2}
                    value={newBook.description}
                    placeholder="Short summary of classroom assignments relevant to this book."
                    onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded-lg p-2 px-3 focus:outline-none"
                  />
                </div>

                <button
                  id="submit-new-book-consign"
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-955 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Item to Registry
                </button>
              </form>
            </div>

            {/* Right Col: Active Inventory Table */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-850 pb-3">
                <div>
                  <h3 className="font-sans font-bold text-base text-slate-900 dark:text-white">Active Requisitions Store</h3>
                  <p className="text-xs text-slate-500">Query and adjust supplies for all class sections.</p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search title/author..."
                      value={searchBookTerm}
                      onChange={(e) => setSearchBookTerm(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 pl-8 pr-3 text-xs w-44"
                    />
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                  </div>

                  <select
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded-lg py-1.5 px-2 text-xs focus:outline-none"
                  >
                    <option value="All">All level-classes</option>
                    <option value="All Classes">All Classes</option>
                    {CLASS_LEVELS.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table rendering selection */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-450 uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="p-3">Title / Target Class</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Price</th>
                      <th className="p-3 text-center">In-Stock Reserve</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850/65">
                    {filteredBooks.map((item) => {
                      const isEditing = item.id === editingBookId;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                          {isEditing ? (
                            <>
                              <td className="p-3 space-y-1">
                                <div className="space-y-1.5 max-w-[200px]">
                                  <input
                                    type="text"
                                    value={editBookData.title || ''}
                                    onChange={(e) => setEditBookData({ ...editBookData, title: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                                    placeholder="Title"
                                  />
                                  <div className="flex gap-1.5 flex-wrap">
                                    <input
                                      type="text"
                                      value={editBookData.author || ''}
                                      onChange={(e) => setEditBookData({ ...editBookData, author: e.target.value })}
                                      className="flex-1 min-w-[80px] bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded px-2 py-0.5 text-[10px] text-slate-900 dark:text-white"
                                      placeholder="Author"
                                    />
                                    <select
                                      value={editBookData.classLevel || 'Primary 1'}
                                      onChange={(e) => setEditBookData({ ...editBookData, classLevel: e.target.value as ClassLevel })}
                                      className="bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded px-1 py-0.5 text-[10px] text-slate-900 dark:text-white focus:outline-none"
                                    >
                                      <option value="All Classes">All Classes</option>
                                      {CLASS_LEVELS.map(lvl => (
                                        <option key={lvl} value={lvl}>{lvl}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-[11px] font-semibold text-slate-600 dark:text-slate-350">
                                <select
                                  value={editBookData.category || 'Textbook'}
                                  onChange={(e) => setEditBookData({ ...editBookData, category: e.target.value as any })}
                                  className="bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded px-1.5 py-1 text-[11px] text-slate-900 dark:text-white focus:outline-none"
                                >
                                  <option value="Textbook">Textbook</option>
                                  <option value="Uniform">Uniform</option>
                                  <option value="Notebook">Notebook</option>
                                  <option value="Stationery">Stationery</option>
                                  <option value="Other">Other</option>
                                </select>
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-100">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-400">₦</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editBookData.price !== undefined ? editBookData.price : ''}
                                    onChange={(e) => setEditBookData({ ...editBookData, price: e.target.value === '' ? undefined : Number(e.target.value) })}
                                    className="w-20 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded px-1.5 py-1 text-xs text-slate-900 dark:text-white font-mono"
                                  />
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="number"
                                  value={editBookData.stock !== undefined ? editBookData.stock : ''}
                                  onChange={(e) => setEditBookData({ ...editBookData, stock: e.target.value === '' ? undefined : Number(e.target.value) })}
                                  className="w-16 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded px-1.5 py-1 text-xs text-slate-900 dark:text-white font-mono text-center"
                                />
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    id={`save-inv-item-${item.id}`}
                                    onClick={handleSaveEditBook}
                                    className="p-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition text-[11px] font-bold shadow-sm"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEditBook}
                                    className="p-1 px-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-350 dark:hover:bg-slate-700 rounded-md transition text-[11px] font-bold"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-3 space-y-1">
                                <p className="font-bold text-slate-900 dark:text-slate-100 tracking-tight">{item.title}</p>
                                <p className="text-slate-400 font-mono text-[10px]">
                                  {item.author} &bull; <span className="text-amber-500 font-bold">{item.classLevel}</span>
                                  {item.shoeSize && ` • Shoe Size: ${item.shoeSize}`}
                                  {item.uniformSize && ` • Uniform: ${item.uniformSize.charAt(0).toUpperCase() + item.uniformSize.slice(1)}`}
                                </p>
                              </td>
                              <td className="p-3 text-[11px] font-semibold text-slate-600 dark:text-slate-350">
                                {item.category}
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-100">
                                ₦{item.price.toFixed(2)}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleAdjustStock(item.id, item.stock, -5)}
                                    className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded font-bold hover:bg-slate-200 transition"
                                  >
                                    -5
                                  </button>
                                  <span className={`font-mono text-xs font-bold w-10 text-center ${item.stock <= 5 ? 'text-rose-500 animate-pulse' : 'text-slate-800 dark:text-white'
                                    }`}>
                                    {item.stock}
                                  </span>
                                  <button
                                    onClick={() => handleAdjustStock(item.id, item.stock, 5)}
                                    className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded font-bold hover:bg-slate-200 transition"
                                  >
                                    +5
                                  </button>
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    id={`edit-inv-item-${item.id}`}
                                    onClick={() => handleStartEditBook(item)}
                                    className="p-1 px-2.5 text-amber-600 dark:text-amber-400 hover:text-white hover:bg-amber-500 border border-amber-500/30 dark:border-amber-500/20 rounded-md transition text-[11px] font-bold"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    id={`delete-inv-item-${item.id}`}
                                    onClick={() => handleDeleteBook(item.id)}
                                    className="p-1 px-2.5 text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-500/30 dark:border-rose-500/20 rounded-md transition text-[11px] font-bold"
                                  >
                                    Purge
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {filteredBooks.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          No matching core Nazareth study materials are catalogued.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {/* 2. ONBOARDING & EXCEL PARSER TAB */}
        {activeTab === 'onboarding' && (
          <div className="space-y-6" id="admin-onboard-tab">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* Excel Bulk Onboarder file uploader */}
              <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-6 h-fit space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-850 pb-3">
                  <h3 className="font-sans font-bold text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileSpreadsheet className="text-emerald-500 w-5 h-5" /> Excel Bulk Importer
                  </h3>
                  <p className="text-xs text-slate-550 mt-1">
                    Upload .xlsx, .xls, or .csv files to batch register pupils instantly.
                  </p>
                </div>

                <div className="space-y-4 text-xs text-left" id="excel-uploader-block">
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition relative group bg-slate-50/50 dark:bg-slate-955/30">
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileSpreadsheet className="w-8 h-8 text-emerald-500 mx-auto mb-2 group-hover:scale-110 transition duration-300" />
                    <p className="font-bold text-slate-700 dark:text-slate-205 text-xs">Choose or drag spreadsheet file</p>
                    <p className="text-[10px] text-slate-450 mt-1">Accepts Excel (.xlsx, .xls) and CSV (.csv)</p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl space-y-1.5 text-[10px] text-slate-500 dark:text-slate-450 leading-relaxed text-left">
                    <span className="font-bold text-slate-750 dark:text-slate-300 block text-left">Spreadsheet Template Columns:</span>
                    <p className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400">
                      Column 1: Surname<br />
                      Column 2: First Name<br />
                      Column 3: Class (e.g. Primary 1)<br />
                      Column 4: Parent/Guardian Name<br />
                      Column 5: Parent Email<br />
                      Column 6: Parent Phone Number<br />
                      Column 7 (Optional): Reg No (Auto-assigned if blank)
                    </p>
                    <p className="text-[9px] text-slate-450 mt-1">
                      * If headers are provided in the first row, columns will be matched dynamically by name.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      id="load-sample-csv-btn"
                      type="button"
                      onClick={handleLoadSampleData}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-750 rounded-lg transition font-semibold cursor-pointer"
                    >
                      Load Simulated Demo Data
                    </button>
                    <button
                      id="clear-csv-text-btn"
                      type="button"
                      onClick={() => { setOnboardPreview([]); }}
                      className="p-2 text-rose-500 border border-rose-500/20 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Clear Preview"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Review Spreadsheet Grid */}
              <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-855 pb-3">
                    <div>
                      <h3 className="font-sans font-bold text-base text-slate-900 dark:text-white">Excel Ledger Preview Zone</h3>
                      <p className="text-xs text-slate-500">Edit values live in the spreadsheet cell rows prior to launching credentials.</p>
                    </div>
                    {onboardPreview.length > 0 && (
                      <button
                        onClick={handleAddNewPreviewRow}
                        className="px-3 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 rounded-md font-bold text-xs cursor-pointer"
                      >
                        Insert Row +
                      </button>
                    )}
                  </div>

                  {onboardSuccess && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold" id="onboard-committed-alert">
                      {onboardSuccess}
                    </div>
                  )}

                  {onboardPreview.length === 0 ? (
                    <div className="p-16 text-center text-slate-450 font-sans text-xs flex flex-col items-center justify-center gap-3">
                      <FileSpreadsheet className="w-12 h-12 text-slate-300" />
                      <div> No spreadsheet lines to render. Upload bulk registry files on the left or click "Load Simulated Demo Data" to preview bulk onboarding.</div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-850">
                      <table className="w-full text-left text-xs font-sans">
                        <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-350">
                          <tr>
                            <th className="p-2 border border-slate-200 dark:border-slate-850">Surname</th>
                            <th className="p-2 border border-slate-200 dark:border-slate-850">First name</th>
                            <th className="p-2 border border-slate-200 dark:border-slate-850">Grade Level</th>
                            <th className="p-2 border border-slate-200 dark:border-slate-850">Parent/Guardian</th>
                            <th className="p-2 border border-slate-200 dark:border-slate-850">Parent E-mail</th>
                            <th className="p-2 border border-slate-200 dark:border-slate-850 font-mono text-amber-500 font-bold bg-slate-50 dark:bg-slate-950 text-center">Reg No (Password)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {onboardPreview.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/40">
                              <td className="p-1 border border-slate-200 dark:border-slate-850">
                                <input
                                  type="text"
                                  value={item.surname}
                                  onChange={(e) => handleTableFieldChange(idx, 'surname', e.target.value)}
                                  className="w-full bg-transparent p-1 focus:bg-slate-100 focus:outline-none rounded font-bold"
                                />
                              </td>
                              <td className="p-1 border border-slate-200 dark:border-slate-850">
                                <input
                                  type="text"
                                  value={item.firstName}
                                  onChange={(e) => handleTableFieldChange(idx, 'firstName', e.target.value)}
                                  className="w-full bg-transparent p-1 focus:bg-slate-100 focus:outline-none rounded"
                                />
                              </td>
                              <td className="p-1 border border-slate-200 dark:border-slate-850">
                                <select
                                  value={item.classLevel}
                                  onChange={(e) => handleTableFieldChange(idx, 'classLevel', e.target.value)}
                                  className="w-full bg-transparent p-1 focus:bg-slate-100 focus:outline-none rounded"
                                >
                                  {CLASS_LEVELS.map(lvl => (
                                    <option key={lvl} value={lvl}>{lvl}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-1 border border-slate-200 dark:border-slate-850">
                                <input
                                  type="text"
                                  value={item.parentName}
                                  onChange={(e) => handleTableFieldChange(idx, 'parentName', e.target.value)}
                                  className="w-full bg-transparent p-1 focus:bg-slate-100 focus:outline-none rounded text-slate-655 dark:text-slate-300"
                                />
                              </td>
                              <td className="p-1 border border-slate-200 dark:border-slate-850">
                                <input
                                  type="text"
                                  value={item.parentEmail}
                                  onChange={(e) => handleTableFieldChange(idx, 'parentEmail', e.target.value)}
                                  className="w-full bg-transparent p-1 focus:bg-slate-100 focus:outline-none rounded font-mono"
                                />
                              </td>
                              <td className="p-1 border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 text-center">
                                <input
                                  type="text"
                                  value={item.regNo || ''}
                                  onChange={(e) => handleTableFieldChange(idx, 'regNo', e.target.value)}
                                  className="w-full bg-transparent p-1 focus:bg-slate-100 focus:outline-none rounded font-mono text-amber-500 font-bold text-center"
                                  placeholder="Auto-assigned"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {onboardPreview.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-850/60 flex justify-end gap-3" id="excel-commit-bar">
                    <span className="text-[11px] text-slate-450 self-center">
                      Ready to add <strong className="text-amber-500 font-mono">{onboardPreview.length}</strong> new pupil users.
                    </span>
                    <button
                      id="commit-onboard-action-btn"
                      onClick={handleCommitOnboarding}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 font-semibold text-white text-xs rounded-xl transition shadow-md cursor-pointer"
                    >
                      Verify Logs & Import Registry
                    </button>
                  </div>
                )}

              </div>
            </div>

            {/* Managed Pupils List Summary */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-6" id="bulk-registry-view">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b border-slate-100 dark:border-slate-855 pb-3">
                <div>
                  <h4 className="font-sans font-bold text-sm text-slate-905 dark:text-white">Registered Nazareth Pupil Base & Credentials</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Displaying pupils registered in {selectedPupilClass}</p>
                </div>
                <div className="flex items-center gap-3">
                  {pupils.filter(std => std.classLevel === selectedPupilClass).length > 0 && (
                    <button
                      id="delete-all-class-pupils-btn"
                      onClick={handleDeleteAllPupilsInClass}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
                    >
                      Delete All {selectedPupilClass}
                    </button>
                  )}
                  <select
                    id="class-filter-select"
                    value={selectedPupilClass}
                    onChange={(e) => {
                      setSelectedPupilClass(e.target.value as ClassLevel);
                      setSelectedPupilIds([]);
                    }}
                    className="bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 rounded-lg py-1.5 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    {CLASS_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Select All Toolbar and Bulk Actions Drawer */}
              {pupils.filter(std => std.classLevel === selectedPupilClass).length > 0 && (
                <div className="mb-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-150 dark:border-slate-855 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={
                          pupils.filter(std => std.classLevel === selectedPupilClass).length > 0 &&
                          pupils.filter(std => std.classLevel === selectedPupilClass).every(std => selectedPupilIds.includes(std.id))
                        }
                        onChange={() => handleToggleSelectAllPupils(pupils.filter(std => std.classLevel === selectedPupilClass))}
                        className="rounded text-[#065f46] focus:ring-0 w-3.5 h-3.5 bg-white border-slate-355 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
                      />
                      <span>Select All Pupils in {selectedPupilClass}</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {pupils.filter(std => std.classLevel === selectedPupilClass && selectedPupilIds.includes(std.id)).length} of {pupils.filter(std => std.classLevel === selectedPupilClass).length} selected
                    </span>
                  </div>

                  {selectedPupilIds.filter(id => pupils.some(p => p.id === id && p.classLevel === selectedPupilClass)).length > 0 && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-left animate-fade-in" id="bulk-action-panel">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#065f46] dark:text-emerald-400">
                          {selectedPupilIds.filter(id => pupils.some(p => p.id === id && p.classLevel === selectedPupilClass)).length} pupils selected
                        </span>
                        <button
                          onClick={() => {
                            const classPupilIds = pupils.filter(p => p.classLevel === selectedPupilClass).map(p => p.id);
                            setSelectedPupilIds(prev => prev.filter(id => !classPupilIds.includes(id)));
                          }}
                          className="text-slate-500 hover:text-slate-855 dark:hover:text-white underline cursor-pointer"
                        >
                          Deselect class
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Move selected to:</span>
                        <select
                          value=""
                          onChange={(e) => {
                            const targetClass = e.target.value as ClassLevel;
                            if (targetClass) {
                              handleMoveSelectedPupils(targetClass);
                            }
                          }}
                          className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-2.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                          <option value="" disabled>Select Class...</option>
                          {CLASS_LEVELS.filter(lvl => lvl !== selectedPupilClass).map((lvl) => (
                            <option key={lvl} value={lvl}>{lvl}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {pupils.filter(std => std.classLevel === selectedPupilClass).length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-sans text-xs flex flex-col items-center justify-center gap-2">
                  <span>📂</span>
                  <div>No pupils registered in {selectedPupilClass} yet.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {pupils
                    .filter(std => std.classLevel === selectedPupilClass)
                    .map((std) => (
                      <div key={std.id} className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-955 border space-y-1.5 shadow-sm text-left relative group transition duration-150 ${
                        selectedPupilIds.includes(std.id) ? 'border-emerald-500/50 dark:border-emerald-500/40 ring-1 ring-emerald-500/35 bg-emerald-50/10' : 'border-slate-150 dark:border-slate-855'
                      }`}>
                        <span className="absolute top-3 right-3 text-[9px] font-mono bg-amber-500/10 text-amber-500 font-bold px-1.5 py-0.5 rounded">
                          {std.classLevel}
                        </span>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete pupil ${std.firstName} ${std.surname}?`)) {
                              handleDeletePupil(std.id);
                            }
                          }}
                          className="absolute bottom-3 right-3 p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                          title="Delete Pupil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedPupilIds.includes(std.id)}
                            onChange={() => handleToggleSelectPupil(std.id)}
                            className="rounded text-[#065f46] focus:ring-0 w-3.5 h-3.5 bg-white border-slate-350 dark:bg-slate-800 dark:border-slate-700 cursor-pointer shrink-0"
                          />
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate pr-14" title={`${std.firstName} ${std.surname}`}>
                            {std.firstName} {std.surname}
                          </div>
                        </div>
                        <div className="text-[10px] space-y-0.5 text-slate-500 dark:text-slate-455">
                          <div>Login User: <span className="font-bold font-mono text-slate-900 dark:text-white capitalize">{std.surname}</span></div>
                          <div>Login Pass: <span className="font-bold font-mono text-emerald-500 select-all">{std.regNo}</span></div>
                          <div>Parent: <span className="italic">{std.parentName} ({std.parentEmail})</span></div>
                        </div>
                        <div className="flex gap-1.5 pt-2 mt-2 border-t border-slate-100 dark:border-slate-850">
                          <button
                            type="button"
                            onClick={() => onImpersonate && onImpersonate('pupil', std)}
                            className="flex-1 py-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-950 dark:text-emerald-300 font-extrabold text-[9px] rounded-lg transition text-center cursor-pointer"
                          >
                            View Pupil
                          </button>
                          <button
                            type="button"
                            onClick={() => onImpersonate && onImpersonate('parent', std)}
                            className="flex-1 py-1 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:hover:bg-indigo-950 dark:text-indigo-300 font-extrabold text-[9px] rounded-lg transition text-center cursor-pointer"
                          >
                            View Parent
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}              {/* 4. ORDERS & LEDGER TAB */}
        {activeTab === 'orders' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-6 space-y-4" id="admin-orders-tab">
            <div className="border-b border-slate-100 dark:border-slate-850 pb-3 text-left">
              <h3 className="font-sans font-bold text-base text-slate-900 dark:text-white">Central Registrar Bookshop Ledger</h3>
              <p className="text-xs text-slate-500 mt-1">Review pupil invoices, monitor payment statuses, and adjust desk dispatch approvals.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-955 text-slate-600 dark:text-slate-150">
                  <tr>
                    <th className="p-3 font-bold rounded-l-lg">Invoice No</th>
                    <th className="p-3 font-bold">Pupil (Class)</th>
                    <th className="p-3 font-bold">Items Purchased</th>
                    <th className="p-3 font-bold">Subtotal</th>
                    <th className="p-3 font-bold">Payment Method</th>
                    <th className="p-3 font-bold">Dispatch State</th>
                    <th className="p-3 text-right font-bold rounded-r-lg">Manage Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/40">
                      <td className="p-3 font-mono font-bold text-amber-500">
                        {ord.invoiceNo}
                        <span className="block font-normal text-[9px] text-slate-400 mt-0.5">
                          {new Date(ord.date).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-905 dark:text-white">{ord.pupilName}</div>
                        <div className="text-slate-400 font-mono text-[10px]">{ord.pupilRegNo} &bull; {ord.classLevel}</div>
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between gap-4 py-0.5 border-b border-dashed border-slate-100 dark:border-slate-800/60 last:border-b-0">
                              <span className="font-medium">{it.title}</span>
                              <span className="text-[#065f46] font-bold font-mono shrink-0">x{it.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                        ₦{ord.totalAmount.toFixed(2)}
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          {ord.paymentMethod === 'bank' ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="p-0.5 bg-amber-50 rounded text-xs">🏦</span>
                                <span className="text-[10px] font-black text-amber-800 dark:text-amber-400">Bank Transfer</span>
                              </div>
                              {ord.paymentReceiptUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingReceipt({ url: ord.paymentReceiptUrl || '', filename: ord.receiptFileName || 'receipt_doc.png' })}
                                  className="inline-flex items-center gap-1 text-[9px] text-emerald-650 hover:text-emerald-855 font-extrabold cursor-pointer hover:underline mt-1 bg-emerald-50 p-1 rounded-md border border-emerald-100"
                                >
                                  📁 View Receipt
                                </button>
                              ) : (
                                <span className="block text-[9px] text-rose-550 font-medium italic">
                                  No Receipt Yet
                                </span>
                              )}
                            </div>
                          ) : ord.paymentMethod === 'online' ? (
                            <div className="flex items-center gap-1.5">
                              <span className="p-0.5 bg-emerald-50 text-emerald-700 rounded text-xs">💳</span>
                              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">Online Payment</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="p-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">🪑</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Pay at Desk</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold block w-fit ${ord.status === 'Completed' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' :
                          ord.status === 'Cancelled' ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300' :
                            ord.status === 'Ready for Pickup' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                              'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-500 animate-pulse'
                          }`}>
                          {ord.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end flex-wrap max-w-[170px] ml-auto">
                          {ord.paymentMethod === 'bank' && ord.paymentReceiptUrl && ord.status !== 'Ready for Pickup' && ord.status !== 'Completed' && (
                            <button
                              id={`approve-bank-pay-${ord.id}`}
                              onClick={() => handleUpdateOrderStatus(ord.id, 'Ready for Pickup')}
                              className="p-1 px-2 bg-amber-500 hover:bg-amber-600 text-white font-black rounded text-[10px] cursor-pointer shadow-xs transition"
                              title="Confirm Bank receipt and authorize pick up"
                            >
                              Approve Pay
                            </button>
                          )}
                          <button
                            id={`approve-order-${ord.id}`}
                            onClick={() => handleUpdateOrderStatus(ord.id, 'Ready for Pickup')}
                            className="p-1 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[10px] cursor-pointer transition"
                            title="Set Ready for Pickup"
                          >
                            Ready
                          </button>
                          <button
                            id={`complete-order-${ord.id}`}
                            onClick={() => handleUpdateOrderStatus(ord.id, 'Completed')}
                            className="p-1 px-2 bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold hover:opacity-90 rounded text-[10px] cursor-pointer transition"
                            title="Complete Handout release"
                          >
                            Release
                          </button>
                          {ord.status !== 'Cancelled' && (
                            <button
                              id={`cancel-order-${ord.id}`}
                              onClick={() => handleDeleteOrder(ord.id)}
                              className="p-1 px-1 border border-rose-500/30 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded text-[10px] cursor-pointer transition"
                              title="Cancel invoice"
                            >
                              Annull
                            </button>
                          )}
                          <button
                            id={`delete-order-${ord.id}`}
                            onClick={() => handleDeleteOrderPermanently(ord.id)}
                            className="p-1 px-2 border border-rose-600 text-rose-500 hover:bg-rose-600 hover:text-white rounded text-[10px] cursor-pointer transition font-bold"
                            title="Delete invoice permanently"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-450">
                        No financial or material sales ledger transactions reported.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* 5. SALES ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-6" id="admin-analytics-tab">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Sales by Class level segment */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-6 text-left">
                <h4 className="font-sans font-bold text-sm text-slate-900 dark:text-white mb-1">Textbooks Distributed by Section Level</h4>
                <p className="text-xs text-slate-550 mb-6">Aggregate dollars sold across Nazareth academic blocks.</p>

                {/* Draw custom high-fidelity SVG chart bars */}
                <div className="relative h-60 w-full flex items-end gap-3 px-2 border-b border-slate-200 dark:border-slate-800 pb-1" id="svg-sales-chart">
                  {CLASS_LEVELS.map((lvl, index) => {
                    // Compute total sales for this class level
                    const amount = orders
                      .filter(o => o.classLevel === lvl && o.status !== 'Cancelled')
                      .reduce((sum, o) => sum + o.totalAmount, 0);

                    // Normalize height (max 100%)
                    const maxPossible = 100;
                    const displayPercent = Math.min(100, Math.max(10, (amount / maxPossible) * 100));

                    return (
                      <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group">
                        {/* Hover Amount Tooltip */}
                        <span className="hidden group-hover:block absolute bottom-[85%] bg-slate-955 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-lg">
                          ₦{amount.toFixed(2)}
                        </span>

                        <div
                          style={{ height: `${displayPercent}%` }}
                          className={`w-full rounded-t-md transition-all duration-555 ${index % 2 === 0 ? 'bg-amber-500 group-hover:bg-amber-600' : 'bg-slate-900 dark:bg-slate-300 group-hover:bg-indigo-650'
                            }`}
                        />
                        <span className="text-[8px] font-mono text-slate-450 truncate max-w-[45px] text-center mt-2 uppercase tracking-tight">
                          {lvl.substring(0, 5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-3">
                  <span>Y-Axis: Material Requisition Weight (₦)</span>
                  <span>X-Axis: School Class Grades</span>
                </div>
              </div>

              {/* Operations Analytics block */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-6 space-y-4 text-left">
                <h4 className="font-sans font-bold text-sm text-slate-900 dark:text-white">Academic Materials Sales Performance Table</h4>
                <p className="text-xs text-slate-500">Live school store performance summaries for active periods.</p>

                <div className="space-y-3">
                  {CLASS_LEVELS.map((lvl, idx) => {
                    const classOrders = orders.filter(o => o.classLevel === lvl && o.status !== 'Cancelled');
                    const classSum = classOrders.reduce((sum, o) => sum + o.totalAmount, 0);
                    const classPupilCount = pupils.filter(p => p.classLevel === lvl).length;

                    return (
                      <div key={idx} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-850/60">
                        <span className="font-bold text-slate-800 dark:text-slate-150">{lvl}</span>
                        <div className="flex gap-4 font-mono font-bold">
                          <span className="text-xs text-slate-400">{classPupilCount} pupils</span>
                          <span className="text-amber-500">₦{classSum.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 6. CONTACT MESSAGES TAB */}
        {activeTab === 'contacts' && (
          <div className="space-y-6" id="admin-contacts-tab-content">
            {/* Contacts Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase font-bold tracking-wider text-slate-500">Total Submissions</div>
                  <div className="text-3xl font-black font-mono text-slate-900 dark:text-white mt-1.5">{contacts.length}</div>
                </div>
                <span className="text-2xl p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl">📩</span>
              </div>
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase font-bold tracking-wider text-amber-600">Pending Actions</div>
                  <div className="text-3xl font-black font-mono text-amber-600 dark:text-amber-500 mt-1.5">
                    {contacts.filter(c => c.status === 'Pending').length}
                  </div>
                </div>
                <span className="text-2xl p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-2xl">⏳</span>
              </div>
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase font-bold tracking-wider text-emerald-600">Resolved Messages</div>
                  <div className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-500 mt-1.5">
                    {contacts.filter(c => c.status === 'Resolved').length}
                  </div>
                </div>
                <span className="text-2xl p-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl">✅</span>
              </div>
            </div>

            {/* Split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left pane: Contacts List */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 space-y-4 text-left">
                <div className="flex flex-col gap-3">
                  <h4 className="font-sans font-bold text-sm text-slate-900 dark:text-white">Form Submissions Inbox</h4>
                  
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search name, email, message..."
                      value={searchContactTerm}
                      onChange={(e) => setSearchContactTerm(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  {/* Status Filters */}
                  <div className="flex flex-wrap gap-1.5 bg-slate-50 dark:bg-slate-955 p-1 rounded-xl border border-slate-100 dark:border-slate-850">
                    {(['All', 'Pending', 'Read', 'Resolved'] as const).map((filter) => {
                      const count = filter === 'All' ? contacts.length : contacts.filter(c => c.status === filter).length;
                      return (
                        <button
                          key={filter}
                          onClick={() => setContactFilter(filter)}
                          className={`flex-1 py-1.5 px-2.5 rounded-lg text-[10px] font-bold transition whitespace-nowrap cursor-pointer ${
                            contactFilter === filter
                              ? 'bg-[#065f46] text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          {filter} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* List Container */}
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {contacts
                    .filter((c) => {
                      const matchesSearch = 
                        c.name.toLowerCase().includes(searchContactTerm.toLowerCase()) ||
                        c.email.toLowerCase().includes(searchContactTerm.toLowerCase()) ||
                        c.phone.toLowerCase().includes(searchContactTerm.toLowerCase()) ||
                        c.message.toLowerCase().includes(searchContactTerm.toLowerCase());
                      const matchesFilter = contactFilter === 'All' || c.status === contactFilter;
                      return matchesSearch && matchesFilter;
                    })
                    .map((contact) => {
                      const isSelected = selectedContactId === contact.id;
                      const snippet = contact.message.length > 80 ? contact.message.substring(0, 80) + '...' : contact.message;
                      
                      let statusBadgeClass = '';
                      if (contact.status === 'Pending') statusBadgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/40';
                      if (contact.status === 'Read') statusBadgeClass = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/40';
                      if (contact.status === 'Resolved') statusBadgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/40';

                      return (
                        <div
                          key={contact.id}
                          onClick={() => setSelectedContactId(contact.id)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition text-left space-y-2 relative group hover:shadow-xs ${
                            isSelected
                              ? 'border-[#065f46] bg-emerald-50/10 dark:bg-emerald-950/15 shadow-xs'
                              : 'border-slate-150 dark:border-slate-850 hover:bg-slate-55 dark:hover:bg-slate-850/60'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2 pr-2">
                            <div className="font-bold text-xs text-slate-905 dark:text-white truncate max-w-[130px]" title={contact.name}>
                              {contact.name}
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider shrink-0 ${statusBadgeClass}`}>
                              {contact.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-455 font-mono truncate">
                            {contact.email}
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-350 line-clamp-2 leading-relaxed">
                            {snippet}
                          </p>
                          <div className="text-[9px] text-slate-400 text-right">
                            {new Date(contact.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </div>
                      );
                    })}

                  {contacts.filter((c) => {
                    const matchesSearch = 
                      c.name.toLowerCase().includes(searchContactTerm.toLowerCase()) ||
                      c.email.toLowerCase().includes(searchContactTerm.toLowerCase()) ||
                      c.phone.toLowerCase().includes(searchContactTerm.toLowerCase()) ||
                      c.message.toLowerCase().includes(searchContactTerm.toLowerCase());
                    const matchesFilter = contactFilter === 'All' || c.status === contactFilter;
                    return matchesSearch && matchesFilter;
                  }).length === 0 && (
                    <div className="p-8 text-center text-slate-400 font-sans text-xs flex flex-col items-center justify-center gap-2 border border-dashed border-slate-205 dark:border-slate-800 rounded-2xl bg-slate-50/40 dark:bg-slate-900/40">
                      <span>📩</span>
                      <div>No contact messages match your selection.</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right pane: Message details */}
              <div className="lg:col-span-7">
                {contacts.find(c => c.id === selectedContactId) ? (() => {
                  const activeContact = contacts.find(c => c.id === selectedContactId)!;
                  return (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-6 text-left space-y-6 animate-fade-in shadow-xs">
                      {/* Header */}
                      <div className="border-b border-slate-100 dark:border-slate-850 pb-4 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h4 className="font-sans font-bold text-base text-slate-900 dark:text-white leading-tight">
                            Message from {activeContact.name}
                          </h4>
                          <p className="text-[10px] text-slate-450 mt-1">
                            Received on {new Date(activeContact.timestamp).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'medium' })}
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteContact(activeContact.id)}
                            className="p-2 border border-slate-200 dark:border-slate-800 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition cursor-pointer"
                            title="Delete message permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Metadata Coordinates grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">Email Coordinates</span>
                          <a
                            href={`mailto:${activeContact.email}`}
                            className="font-bold text-slate-800 dark:text-slate-205 hover:underline hover:text-[#065f46] transition"
                          >
                            {activeContact.email}
                          </a>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">Telephone Coordinates</span>
                          <span className="font-bold text-slate-850 dark:text-slate-205 font-mono">
                            {activeContact.phone || 'No phone provided'}
                          </span>
                        </div>
                      </div>

                      {/* Message Body */}
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Message Text Body</span>
                        <div className="p-4 bg-slate-50/50 dark:bg-slate-955/30 rounded-2xl border border-slate-100 dark:border-slate-850/60 text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                          {activeContact.message}
                        </div>
                      </div>

                      {/* Actions and Status Switches */}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-850 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-col gap-1.5 text-xs text-left">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Change Inquiry Status</span>
                          <div className="flex gap-1.5 bg-slate-50 dark:bg-slate-955 p-1 rounded-xl border border-slate-150 dark:border-slate-800">
                            {(['Pending', 'Read', 'Resolved'] as const).map((status) => (
                              <button
                                key={status}
                                onClick={() => handleUpdateContactStatus(activeContact.id, status)}
                                className={`py-1 px-3 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                  activeContact.status === status
                                    ? 'bg-[#065f46] text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-805 dark:hover:text-slate-200'
                                }`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </div>

                        <a
                          href={`mailto:${activeContact.email}?subject=Nazareth School Inquiry - Re: Contact Form Submission&body=Hello ${activeContact.name},%0D%0A%0D%0AThank you for reaching out to Nazareth School Registrar faculty.%0D%0A%0D%0ARegarding your message:%0D%0A"${activeContact.message}"%0D%0A%0D%0A`}
                          className="py-2.5 px-4 bg-[#065f46] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition hover:shadow-md cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" /> Draft Email Reply
                        </a>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-4 h-[350px]">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-805 flex items-center justify-center text-2xl text-slate-400 select-none animate-pulse">
                      📬
                    </div>
                    <div>
                      <h5 className="font-sans font-bold text-slate-700 dark:text-slate-300 text-sm">No Message Inspected</h5>
                      <p className="text-[11px] text-slate-450 mt-1 max-w-xs mx-auto">
                        Select a contact form message from the sidebar list to inspect the full contents, change inquiry workflow states, or draft an email response.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </main>

      {/* GDPR Audit Drawer Component */}
      {gdprAuditOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-end z-50 p-4" id="gdpr-audit-drawer-overlay">
          <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-850 max-w-md w-full h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div className="space-y-6 text-left">
              <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-850 pb-4">
                <h4 className="font-sans font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-base">
                  <UserPlus className="text-amber-500" /> Nazareth GDPR sandbox Control
                </h4>
                <button
                  onClick={() => setGdprAuditOpen(false)}
                  className="p-1 font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <p className="text-slate-500 leading-relaxed text-[12px]">
                  Institutional compliance checklist under the General Data Protection Regulation (GDPR) for Nazareth School Registry:
                </p>

                <div className="space-y-2.5 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-850 text-[11px]">
                  <div className="flex gap-2">
                    <span className="text-emerald-500">&#10003;</span>
                    <div>
                      <strong>Right to Portability (Art 20)</strong>
                      <p className="text-slate-450 mt-0.5">Allowing faculty and parents to download raw credential snapshots instantly.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-emerald-500">&#10003;</span>
                    <div>
                      <strong>Right of Access (Art 15)</strong>
                      <p className="text-slate-450 mt-0.5">Students check invoice histories. No tracking coordinates are pushed out.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-emerald-500">&#10003;</span>
                    <div>
                      <strong>Right to Erasure (Art 17)</strong>
                      <p className="text-slate-450 mt-0.5">Institutional purge option resets local tracking arrays permanently.</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-rose-500/5 rounded-lg border border-rose-500/10 text-[11px] text-rose-400">
                  ⚠️ Purging the system cleanses local registers instantly. Make sure you back up critical ledgers.
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-150 dark:border-slate-850 pt-4" id="gdpr-drawer-controls">
              <button
                id="gdpr-download-backup-btn"
                onClick={handleDownloadBackup}
                className="w-full py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 hover:opacity-90 transition"
              >
                Download Data Backup (.JSON)
              </button>
              <button
                id="gdpr-purge-system-btn"
                onClick={handleSystemPurge}
                className="w-full py-2.5 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 text-rose-400 hover:text-white font-bold text-xs rounded-xl transition"
              >
                Reset & Purge All Storage
              </button>
              <button
                onClick={() => setGdprAuditOpen(false)}
                className="w-full py-2 text-slate-500 hover:text-slate-900 text-xs text-center"
              >
                Close Audit Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Receipt modal in AdminDashboard */}
      {viewingReceipt && (
        <div id="receipt-preview-backdrop" className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-800">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full space-y-4 relative shadow-2xl">
            <button
              onClick={() => setViewingReceipt(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-left space-y-1.5 pb-2 border-b border-slate-100">
              <h3 className="font-sans font-bold text-base text-slate-900 flex items-center gap-2">
                <span>📁</span> Bank Payment Deposit Receipt
              </h3>
              <p className="text-[11px] text-slate-405 font-mono truncate">{viewingReceipt.filename}</p>
            </div>

            <div className="flex justify-center bg-slate-50 rounded-2xl overflow-hidden p-2 border border-slate-100">
              {viewingReceipt.url.startsWith('data:application/pdf') || viewingReceipt.filename.endsWith('.pdf') ? (
                <div className="p-8 text-center space-y-2">
                  <span className="text-4xl">📄</span>
                  <p className="font-bold text-xs text-slate-800">PDF Document Registered</p>
                  <a href={viewingReceipt.url} download={viewingReceipt.filename} className="inline-block py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-850 rounded text-[10px] font-bold">
                    Download PDF Receipt Document to Verify
                  </a>
                </div>
              ) : (
                <img
                  src={viewingReceipt.url}
                  alt="Receipt Preview"
                  className="max-h-96 w-auto object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setViewingReceipt(null)}
                className="py-2 px-4 bg-slate-100 text-slate-705 hover:bg-slate-200 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
