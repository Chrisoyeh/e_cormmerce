import React from 'react';
import { Bell, BellOff, Check, Trash2, MailCheck, AlertTriangle, Calendar } from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
  roleFilter: 'admin' | 'pupil' | 'parent';
  recipientId?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAsRead,
  onClearAll,
  roleFilter,
  recipientId = 'all',
}) => {
  // Filter notifications relevant to current viewed role
  const filtered = notifications.filter((notif) => {
    if (notif.role !== roleFilter) return false;
    if (notif.recipientId && notif.recipientId !== 'all' && notif.recipientId !== recipientId) {
      return false;
    }
    return true;
  });

  const unreadCount = filtered.filter((n) => !n.read).length;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden w-full max-w-sm" id="notification-center-widget">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-950 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center" id="notif-header">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="w-4 h-4 text-amber-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[8px] px-1 rounded-full animate-bounce">
                {unreadCount}
              </span>
            )}
          </div>
          <span className="font-sans font-bold text-xs text-slate-800 dark:text-slate-200">
            System & Report Notifications
          </span>
        </div>
        {filtered.length > 0 && (
          <button
            id="clear-all-notifications-btn"
            onClick={onClearAll}
            className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition"
            title="Clear verified reports"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850/60" id="notif-list">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2" id="notif-empty">
            <BellOff className="w-6 h-6 text-slate-300" />
            No new activity or report emails.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`p-3 text-xs transition relative group ${
                item.read ? 'bg-white dark:bg-slate-900 opacity-80' : 'bg-amber-500/5 dark:bg-amber-500/2 border-l-2 border-amber-500'
              }`}
            >
              <div className="flex gap-2.5 items-start">
                {item.type === 'report_delivery' && (
                  <span className="p-1 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded inline-block">
                    <MailCheck className="w-3.5 h-3.5" />
                  </span>
                )}
                {item.type === 'success' && (
                  <span className="p-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded inline-block">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
                {item.type === 'warning' && (
                  <span className="p-1 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded inline-block">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </span>
                )}
                {item.type === 'info' && (
                  <span className="p-1 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded inline-block">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                )}

                <div className="space-y-1 flex-1">
                  <div className="flex justify-between items-baseline">
                    <h5 className="font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                      {item.title}
                    </h5>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 leading-normal text-[11px]">
                    {item.message}
                  </p>
                  {!item.read && (
                    <button
                      id={`mark-read-btn-${item.id}`}
                      onClick={() => onMarkAsRead(item.id)}
                      className="text-[10px] text-amber-600 dark:text-amber-500 hover:text-amber-700 font-medium pt-1 flex items-center gap-0.5"
                    >
                      <Check className="w-3 h-3" /> Mark as read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
