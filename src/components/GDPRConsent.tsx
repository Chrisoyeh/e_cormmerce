import React, { useState, useEffect } from 'react';
import { Shield, Eye, Database, Check, X, ArrowRight } from 'lucide-react';

export const GDPRConsent: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState({
    sessionLogs: true,
    purchaseTracking: true,
    parentAccess: true,
  });

  useEffect(() => {
    const consent = localStorage.getItem('nazareth_gdpr_consent');
    if (!consent) {
      // Show immediately if first time
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('nazareth_gdpr_consent', JSON.stringify({
      accepted: true,
      timestamp: new Date().toISOString(),
      preferences: { sessionLogs: true, purchaseTracking: true, parentAccess: true }
    }));
    setVisible(false);
  };

  const handleSaveCustom = () => {
    localStorage.setItem('nazareth_gdpr_consent', JSON.stringify({
      accepted: true,
      timestamp: new Date().toISOString(),
      preferences
    }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      id="gdpr-cookie-consent-banner"
      className="fixed bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-md bg-slate-900 border border-slate-700 text-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden transform transition-all duration-300"
    >
      <div className="p-5" id="gdpr-body">
        <div className="flex gap-3 items-start" id="gdpr-header">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 mt-0.5">
            <Shield className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-sans font-semibold text-sm tracking-tight text-white">
              GDPR & Privacy Consent &mdash; Nazareth School Festac
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              We value your data rights under general data protection frameworks. We require consent to save student shopping records, parent notification logs, and custom billing details.
            </p>
          </div>
        </div>

        {showDetails && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-3" id="gdpr-preferences-customizer">
            <p className="text-[11px] text-amber-400 font-mono">
              Nazareth School Festac stores 100% of your records locally inside sandbox storage. No third parties have access.
            </p>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs cursor-pointer p-1.5 hover:bg-slate-800 rounded">
                <span className="flex items-center gap-1.5 font-medium text-slate-200">
                  <Database className="w-3.5 h-3.5 text-slate-400" /> Session Logs (Surname Auth)
                </span>
                <input
                  type="checkbox"
                  checked={preferences.sessionLogs}
                  onChange={(e) => setPreferences({ ...preferences, sessionLogs: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-0 w-4 h-4 bg-slate-800 border-slate-700"
                />
              </label>

              <label className="flex items-center justify-between text-xs cursor-pointer p-1.5 hover:bg-slate-800 rounded">
                <span className="flex items-center gap-1.5 font-medium text-slate-200">
                  <Eye className="w-3.5 h-3.5 text-slate-400" /> Bookshop History (Order tracking)
                </span>
                <input
                  type="checkbox"
                  checked={preferences.purchaseTracking}
                  disabled
                  className="rounded text-amber-500 opacity-60 w-4 h-4 bg-slate-800 border-slate-700 cursor-not-allowed"
                />
              </label>

              <label className="flex items-center justify-between text-xs cursor-pointer p-1.5 hover:bg-slate-800 rounded">
                <span className="flex items-center gap-1.5 font-medium text-slate-200">
                  <Shield className="w-3.5 h-3.5 text-slate-400" /> Parental Report Linkage
                </span>
                <input
                  type="checkbox"
                  checked={preferences.parentAccess}
                  onChange={(e) => setPreferences({ ...preferences, parentAccess: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-0 w-4 h-4 bg-slate-800 border-slate-700"
                />
              </label>
            </div>
            <div className="text-[10px] text-slate-400">
              By completing authentication, you accept the transmission of order state to Nazareth School Festac bookkeepers.
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 items-center justify-between border-t border-slate-800/60 pt-4" id="gdpr-controls">
          <button
            id="gdpr-customize-btn"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1"
          >
            {showDetails ? 'Hide details' : 'Customize preferences...'}
          </button>
          <div className="flex gap-2">
            {showDetails ? (
              <button
                id="gdpr-save-custom-btn"
                onClick={handleSaveCustom}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
              >
                Save Choice
              </button>
            ) : (
              <button
                id="gdpr-decline-all-btn"
                onClick={() => setVisible(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium transition"
              >
                Close
              </button>
            )}
            <button
              id="gdpr-accept-all-btn"
              onClick={handleAcceptAll}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-lg text-xs transition flex items-center gap-1"
            >
              Accept All <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
