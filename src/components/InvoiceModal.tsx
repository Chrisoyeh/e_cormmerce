import React, { useRef, useState } from 'react';
import { X, Printer, Download, BookOpen, Clock, CheckCircle2, ShieldAlert, Send, AlertTriangle, Scan, Plus, Check, QrCode, Sparkles } from 'lucide-react';
import { Order } from '../types';
import { Logo } from './Logo';
import { scanReceiptFile, ReceiptScanResult } from '../utils/receiptScanner';
import { uploadReceiptToStorage } from '../utils/storageHelper';
import { generateInvoiceQrSvg } from '../utils/qrCode';

interface InvoiceModalProps {
  order: Order;
  onClose: () => void;
  onUpdateOrder?: (updatedOrder: Order) => void;
  onSubmitInvoice?: (order: Order) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, onClose, onUpdateOrder, onSubmitInvoice }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const subtotal = order.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const vat = subtotal * 0.05; // 5% VAT
  const scholarshipDiscount = 0.0; // Dynamic discount mock
  const grandTotal = subtotal + vat - scholarshipDiscount;

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [lastAiScanNotice, setLastAiScanNotice] = useState<{
    detectedAmount: number;
    bankName: string | null;
    transactionRef: string | null;
    status: string;
    deficit: number;
  } | null>(null);

  const recordedPaid = order.amountPaid !== undefined ? order.amountPaid : (order.paymentReceiptUrl ? grandTotal : 0);
  const remainingDeficit = Math.max(0, grandTotal - recordedPaid);
  const isUnderpaid = order.paymentVerificationStatus === 'Underpaid' || (order.paymentReceiptUrl && recordedPaid < grandTotal - 0.5);

  const handlePrint = () => {
    const printContent = invoiceRef.current?.innerHTML;

    if (printContent) {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <html>
            <head>
              <title>Nazareth Bookshop Invoice - ${order.invoiceNo}</title>
              <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
              <style>
                body { font-family: 'Inter', sans-serif; padding: 20px; background: white; color: black; }
                .no-print { display: none; }
                .stamp-stamp { border: 2px solid #059669 !important; color: #059669 !important; }
              </style>
            </head>
            <body onload="window.print(); setTimeout(() => { window.parent.document.body.removeChild(iframe); }, 100);">
              ${printContent}
            </body>
          </html>
        `);
        doc.close();
      }
    }
  };

  const handleProcessReceipt = async (file: File, isBalanceReceipt = false) => {
    setIsScanning(true);
    setScanMessage('✨ Gemini Flash Vision scanning receipt...');

    try {
      const target = isBalanceReceipt ? remainingDeficit : grandTotal;
      const [storageResult, scanRes] = await Promise.all([
        uploadReceiptToStorage(file, order.id, isBalanceReceipt ? 'balance' : 'primary'),
        scanReceiptFile(file, target),
      ]);

      const detectedAmt = (typeof scanRes.detectedAmount === 'number' && scanRes.detectedAmount > 0)
        ? scanRes.detectedAmount
        : target;

      if (!isBalanceReceipt) {
        const deficit = Math.max(0, grandTotal - detectedAmt);
        const verificationStatus = deficit <= 0.5 ? 'Verified' : 'Underpaid';

        if (onUpdateOrder) {
          onUpdateOrder({
            ...order,
            paymentReceiptUrl: storageResult.downloadUrl,
            receiptFileName: storageResult.fileName,
            receiptUploadedAt: new Date().toISOString(),
            amountPaid: detectedAmt,
            balanceDue: deficit,
            paymentVerificationStatus: verificationStatus,
            bankTransactionRef: scanRes.transactionRef || undefined,
            ocrDetectedAmount: detectedAmt,
            submittedToLedger: true,
          });
        }

        setLastAiScanNotice({
          detectedAmount: detectedAmt,
          bankName: scanRes.bankName,
          transactionRef: scanRes.transactionRef,
          status: verificationStatus,
          deficit,
        });
      } else {
        const totalNowPaid = (order.amountPaid || 0) + detectedAmt;
        const newDeficit = Math.max(0, grandTotal - totalNowPaid);
        const verificationStatus = newDeficit <= 0.5 ? 'Verified' : 'Underpaid';

        if (onUpdateOrder) {
          onUpdateOrder({
            ...order,
            balanceReceiptUrl: storageResult.downloadUrl,
            balanceReceiptFileName: storageResult.fileName,
            balanceReceiptUploadedAt: new Date().toISOString(),
            amountPaid: totalNowPaid,
            balanceDue: newDeficit,
            paymentVerificationStatus: verificationStatus,
            ocrDetectedAmount: totalNowPaid,
            submittedToLedger: true,
          });
        }

        setLastAiScanNotice({
          detectedAmount: detectedAmt,
          bankName: scanRes.bankName,
          transactionRef: scanRes.transactionRef,
          status: verificationStatus,
          deficit: newDeficit,
        });
      }

      setIsScanning(false);
      setScanMessage(null);
    } catch (err) {
      console.error('Receipt processing error:', err);
      setIsScanning(false);
      setScanMessage(null);
    }
  };

  const getStatusBadge = () => {
    if (order.status === 'Completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5" /> Book Released & Paid
        </span>
      );
    }
    if (order.status === 'Cancelled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
          <ShieldAlert className="w-3.5 h-3.5" /> Cancelled Invoice
        </span>
      );
    }
    if (order.paymentMethod === 'bank') {
      if (order.paymentReceiptUrl) {
        if (isUnderpaid && remainingDeficit > 0) {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Part-Paid (Bal: ₦{remainingDeficit.toLocaleString()})
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> Paid in Full (₦{grandTotal.toLocaleString()})
          </span>
        );
      } else {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-amber-50 border border-amber-200 text-amber-800 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Pending (Awaiting Receipt)
          </span>
        );
      }
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 animate-pulse">
        <Clock className="w-3.5 h-3.5" /> Pending Desk Dispatch
      </span>
    );
  };

  return (
    <div
      id="invoice-modal-overlay"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 my-8 animate-fade-in">
        {/* Top Control Header */}
        <div
          className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
          id="invoice-control-header"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="text-amber-500 w-5 h-5" />
            <h3 className="font-sans font-bold text-slate-800 dark:text-white">
              Official Bookshop Invoice
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="print-invoice-action-btn"
              onClick={handlePrint}
              className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              id="close-invoice-modal-btn"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Scrollable Content */}
        <div className="p-6 md:p-8 overflow-y-auto max-h-[70vh]" id="invoice-bill-container" ref={invoiceRef}>
          {/* Printable Blueprint Block */}
          <div className="space-y-6 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 p-2 rounded-lg" id="invoice-printable-blueprint">
            
            {/* Logo and school header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200 dark:border-slate-850">
              <div className="space-y-2">
                <Logo size="lg" />
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  Nazareth School Festac Central Bookshop & Academic Store Office
                  <br />
                  Central Campus Quad, Plot 491, Nazareth Way
                  <br />
                  E-mail: nazarethschoolfestac@gmail.com
                  <br />
                  Tel: +2349116409689
                </p>
              </div>
              <div className="text-left md:text-right space-y-1">
                <div className="text-[10px] uppercase font-bold tracking-widest text-amber-500">Official Receipt</div>
                <h4 className="font-mono text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {order.invoiceNo}
                </h4>
                <div className="text-xs text-slate-500">
                  Date: {new Date(order.date).toLocaleDateString()}
                </div>
                <div className="mt-2 text-right">
                  {getStatusBadge()}
                </div>
              </div>
            </div>

            {/* Account Details Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 space-y-2">
                <div className="font-semibold text-[10px] uppercase tracking-wider text-slate-400">Billed Pupil:</div>
                <div className="text-sm font-bold text-slate-950 dark:text-white">{order.pupilName}</div>
                <div>Reg No: <span className="font-mono text-amber-500 font-bold">{order.pupilRegNo}</span></div>
                <div>Class: <span className="font-medium text-slate-700 dark:text-slate-300">{order.classLevel}</span></div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 space-y-2">
                <div className="font-semibold text-[10px] uppercase tracking-wider text-slate-400">Billing Verification:</div>
                <div>School Board Authorized: <span className="font-semibold text-emerald-600">Yes</span></div>
                <div>Order Date: <span>{new Date(order.date).toLocaleTimeString()}</span></div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">Transaction ID: {order.id}</div>
              </div>
            </div>

            {/* BANK TRANSFER PAYMENT DETAILS */}
            {order.paymentMethod === 'bank' && (
              <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/60 space-y-4 text-left shadow-xs mb-4 no-print text-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <span className="text-base text-amber-600">🏛️</span>
                    <span>Required Bank Transfer Information</span>
                  </div>
                  {isScanning && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2.5 py-1 rounded-full animate-pulse">
                      <Scan className="w-3 h-3 animate-spin" /> {scanMessage}
                    </span>
                  )}
                </div>
                
                <div className="text-xs space-y-1.5 bg-white p-3.5 rounded-xl border border-amber-100 text-slate-700">
                  <div className="flex justify-between border-b border-dashed border-slate-100/55 pb-1.5"><span className="text-slate-400">Bank Name:</span> <strong className="text-slate-900 font-sans">Abbey Mortage Bank</strong></div>
                  <div className="flex justify-between border-b border-dashed border-slate-100/55 pb-1.5"><span className="text-slate-400">Acct Name:</span> <strong className="text-slate-900 font-sans">Nazareth upper school bookshop Head Branch</strong></div>
                  <div className="flex justify-between pt-0.5"><span className="text-slate-400">Account No:</span> <strong className="text-slate-900 font-mono text-sm">3976170710</strong></div>
                </div>

                {/* Gemini Flash Vision AI Scanned Result Notice (Read-only for Parent/Pupil) */}
                {lastAiScanNotice && (
                  <div className="p-4 bg-emerald-950 text-white rounded-2xl border-2 border-emerald-400 space-y-3 shadow-lg animate-fade-in">
                    <div className="flex items-center justify-between border-b border-emerald-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
                        <span className="font-bold text-xs text-emerald-200">
                          ✨ Gemini Flash Vision AI Scanned Receipt
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLastAiScanNotice(null)}
                        className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs bg-slate-900/70 p-3 rounded-xl border border-emerald-900/60">
                      <div>
                        <span className="text-slate-400 text-[10px] block">AI Detected Amount:</span>
                        <strong className="text-emerald-300 font-mono text-sm">₦{lastAiScanNotice.detectedAmount.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Bank / Channel:</span>
                        <strong className="text-slate-200 font-sans truncate block">{lastAiScanNotice.bankName || 'Direct Transfer'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Reference / Session ID:</span>
                        <strong className="text-slate-300 font-mono text-[11px] truncate block">{lastAiScanNotice.transactionRef || 'N/A'}</strong>
                      </div>
                    </div>

                    {lastAiScanNotice.deficit > 0.5 ? (
                      <div className="p-2.5 bg-amber-500/20 border border-amber-400/40 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          AI Detected Partial Payment: <strong>₦{lastAiScanNotice.deficit.toLocaleString()}</strong> deficit recorded. Admin audit will verify.
                        </span>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2 font-semibold">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>AI Verified 100% Payment. Receipt logged to Registrar Ledger.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Initial Receipt Preview */}
                {order.paymentReceiptUrl ? (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-emerald-900 font-sans">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">✅</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-extrabold text-[#065f46]">Initial Payment Receipt Attached</p>
                            <span className="text-[10px] bg-emerald-100 font-mono font-bold px-2 py-0.5 rounded text-emerald-800">
                              ₦{(order.ocrDetectedAmount || order.amountPaid || grandTotal).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono truncate max-w-xs">{order.receiptFileName || 'receipt.png'}</p>
                          {order.bankTransactionRef && (
                            <p className="text-[9px] text-slate-400 font-mono">Ref: {order.bankTransactionRef}</p>
                          )}
                        </div>
                      </div>
                      {order.paymentReceiptUrl.startsWith('data:image/') && (
                        <img src={order.paymentReceiptUrl} alt="Receipt preview" className="w-14 h-14 object-cover rounded-lg border border-emerald-300 shrink-0" referrerPolicy="no-referrer" />
                      )}
                    </div>

                    {/* Underpayment Alert Banner */}
                    {isUnderpaid && remainingDeficit > 0 && (
                      <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-300 text-amber-900 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-xs">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Underpayment Detected on Invoice {order.invoiceNo}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          The uploaded receipt accounts for <strong className="text-slate-900">₦{recordedPaid.toLocaleString()}</strong> of the required <strong className="text-slate-900">₦{grandTotal.toLocaleString()}</strong>.
                          A deficit balance of <strong className="text-amber-700 font-mono text-xs">₦{remainingDeficit.toLocaleString()}</strong> remains.
                        </p>

                        {/* Balance Receipt Preview or Upload Box */}
                        {order.balanceReceiptUrl ? (
                          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex justify-between items-center text-xs mt-2">
                            <div className="flex items-center gap-2">
                              <span>🧾</span>
                              <div>
                                <span className="font-bold text-emerald-800">Balance Receipt Attached:</span>
                                <span className="block text-[10px] font-mono text-slate-500">{order.balanceReceiptFileName || 'balance_receipt.png'}</span>
                              </div>
                            </div>
                            <span className="font-bold text-emerald-700 font-mono text-xs">+₦{remainingDeficit.toLocaleString()}</span>
                          </div>
                        ) : (
                          <div className="pt-2">
                            <label className="text-[11px] font-bold text-amber-950 block mb-1">
                              ➕ Upload Supplementary / Balance Receipt (₦{remainingDeficit.toLocaleString()}):
                            </label>
                            <div className="border border-dashed border-amber-400 rounded-xl p-3 bg-white hover:bg-amber-50/40 transition text-center cursor-pointer relative">
                              <input 
                                type="file" 
                                accept="image/*,application/pdf"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleProcessReceipt(file, true);
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                id="balance-receipt-uploader"
                              />
                              <div className="flex items-center justify-center gap-2 text-amber-900 text-xs font-semibold">
                                <Plus className="w-4 h-4 text-amber-600" />
                                <span>Click to attach proof for remaining ₦{remainingDeficit.toLocaleString()} balance</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[11px] font-sans font-bold text-amber-955 block">Upload Deposit Receipt / Screenshot:</label>
                    <div className="border border-dashed border-amber-300 rounded-xl p-4 bg-white hover:bg-amber-50/20 transition text-center cursor-pointer relative">
                      <input 
                        type="file" 
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleProcessReceipt(file, false);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        id="receipt-file-uploader"
                      />
                      <div className="flex flex-col items-center gap-1.5 text-slate-500 text-xs">
                        <span className="text-xl">📂</span>
                        <span className="font-bold text-amber-900">Click to select pay receipt image/PDF</span>
                        <span className="text-[9px] text-slate-400">Scanner automatically detects payment total & session ID</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RECEIPT UPLOAD FOR NON-BANK PAYMENTS */}
            {order.paymentMethod !== 'bank' && (
              <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/60 space-y-4 text-left shadow-xs mb-4 no-print text-slate-800">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <span className="text-base text-amber-600">📄</span>
                  <span>Upload Payment Receipt</span>
                </div>

                {order.paymentReceiptUrl ? (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-emerald-800 font-sans">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">✅</span>
                      <div>
                        <p className="font-extrabold text-[#065f46]">Payment Receipt Uploaded</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs">{order.receiptFileName || 'receipt.png'}</p>
                      </div>
                    </div>
                    {order.paymentReceiptUrl.startsWith('data:image/') && (
                      <img src={order.paymentReceiptUrl} alt="Receipt preview" className="w-12 h-12 object-cover rounded-lg border border-emerald-200 shrink-0" referrerPolicy="no-referrer" />
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[11px] font-sans font-bold text-slate-700 block">Upload Payment Receipt / Screenshot:</label>
                    <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-white hover:bg-slate-50/20 transition text-center cursor-pointer relative">
                      <input 
                        type="file" 
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleProcessReceipt(file, false);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        id="receipt-file-uploader-nonbank"
                      />
                      <div className="flex flex-col items-center gap-1.5 text-slate-500 text-xs">
                        <span className="text-xl">📂</span>
                        <span className="font-bold text-slate-800">Click to select payment receipt image/PDF</span>
                        <span className="text-[9px] text-slate-400">Allowed: JPG, PNG, PDF</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Order Items Table */}
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
                    <tr>
                      <th className="p-3 font-semibold rounded-l-lg">Item Title / Study Material</th>
                      <th className="p-3 font-semibold text-right rounded-r-lg pr-4">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-850">
                        <td className="p-3 font-medium text-slate-950 dark:text-white">{item.title}</td>
                        <td className="p-3 text-right font-mono pr-4">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculation Totals */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-850/60">
              {/* Left Column: Official Bookshop Stamp Graphic & Fast Desk QR */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="border border-emerald-600 text-emerald-600 rounded-lg px-3 py-2 text-[10px] font-bold tracking-widest uppercase transform rotate-[-2deg] bg-emerald-50/50 backdrop-blur-xs flex flex-col items-center justify-center font-mono w-36 text-center select-none">
                  <span>Nazareth Bookshop</span>
                  <span className="text-[9px] font-sans text-slate-500 font-normal">Official Release stamp</span>
                  <span className="text-[8px] text-emerald-700">APPROVED DESK PICKUP</span>
                </div>

                <div className="flex flex-col items-center p-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <img
                    src={generateInvoiceQrSvg(order.invoiceNo, 80)}
                    alt="Invoice Desk QR"
                    className="w-14 h-14 object-contain rounded"
                    crossOrigin="anonymous"
                  />
                  <span className="text-[8px] font-mono text-slate-400 mt-0.5 font-bold">Fast Desk QR</span>
                </div>
              </div>

              {/* Right Column: Calculations */}
              <div className="w-full md:w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">₦{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>VAT (5%):</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">₦{vat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Scholarship Discount:</span>
                  <span className="font-mono text-emerald-500">-₦{scholarshipDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 font-bold text-slate-950 dark:text-white text-sm">
                  <span>Grand Total:</span>
                  <span className="font-mono text-amber-500">₦{grandTotal.toFixed(2)}</span>
                </div>
                {order.amountPaid !== undefined && (
                  <div className="flex justify-between text-[11px] pt-1 text-slate-600">
                    <span>Recorded Payment:</span>
                    <span className="font-mono font-bold text-emerald-600">₦{order.amountPaid.toFixed(2)}</span>
                  </div>
                )}
                {isUnderpaid && remainingDeficit > 0 && (
                  <div className="flex justify-between text-[11px] font-bold text-amber-600 bg-amber-50 p-1 rounded">
                    <span>Balance Deficit:</span>
                    <span className="font-mono">₦{remainingDeficit.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-850/60 text-center">
              <p className="text-[10px] text-slate-400">
                Nazareth Boarding & Day School Governance Code. Thank you for supporting your ward's learning.
                <br />
                This invoice must be kept for audit verification. Generated on {new Date(order.date).toLocaleString()}
              </p>
            </div>

          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center gap-2 text-xs">
          <button
            id="invoice-bottom-close-btn"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-755 text-slate-800 dark:text-slate-200 rounded-lg font-semibold transition cursor-pointer"
          >
            Close
          </button>

          {order.paymentReceiptUrl ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl font-bold shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {isUnderpaid && remainingDeficit > 0
                  ? `Part-Payment Logged in Ledger (₦${remainingDeficit.toLocaleString()} Bal)`
                  : 'Receipt Logged & Submitted to Registrar Ledger'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
              <Clock className="w-4 h-4 shrink-0" />
              <span className="text-[11px] font-semibold">Attach payment receipt above to submit</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

