import { useState, useEffect } from 'react';
import { Bell, CheckCheck, AlertTriangle, UserPlus, Network, MessageSquare, Trash2 } from 'lucide-react';
import type { Notification } from '@/types';
import { cn } from '@/utils/cn';
import api from '@/services/api';

interface NotificationsProps {
  notifications: Notification[];
  onNotificationsChange: (n: Notification[]) => void;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  task_assigned: { icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-50' },
  deadline_approaching: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
  task_completed: { icon: CheckCheck, color: 'text-green-700', bg: 'bg-green-50' },
  structure_changed: { icon: Network, color: 'text-purple-500', bg: 'bg-purple-50' },
  security_alert: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
};

export function Notifications({ notifications, onNotificationsChange }: NotificationsProps) {
  const [loading, setLoading] = useState(false);
  const unread = notifications.filter(n => !n.read);

  const markAllRead = async () => {
    setLoading(true);
    try {
      await api.markAllNotificationsRead();
      onNotificationsChange(notifications.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      await api.markNotificationRead(parseInt(id));
      onNotificationsChange(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.deleteNotification(parseInt(id));
      onNotificationsChange(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Уведомления</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unread.length > 0 ? `${unread.length} непрочитанных` : 'Все прочитано'}
          </p>
        </div>
        {unread.length > 0 && (
          <button
            onClick={markAllRead}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 border border-green-200 rounded-lg hover:bg-green-50 disabled:opacity-50"
          >
            <CheckCheck size={14} />
            Прочитать все
          </button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Bell size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">Нет уведомлений</p>
          </div>
        ) : (
          notifications
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map(n => {
              const config = typeConfig[n.type] || typeConfig.task_assigned;
              const Icon = config.icon;
              return (
                <div
                  key={n.id}
                  className={cn(
                    'bg-white rounded-xl border p-4 flex items-start gap-3 group transition-colors',
                    n.read ? 'border-slate-200' : 'border-green-200 bg-green-50/30'
                  )}
                >
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', config.bg)}>
                    <Icon size={16} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm', n.read ? 'text-slate-600' : 'text-slate-800 font-medium')}>
                      {n.message}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(n.timestamp).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="p-1 text-slate-400 hover:text-green-700 rounded"
                        title="Прочитано"
                      >
                        <CheckCheck size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(n.id)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded"
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 bg-green-700 rounded-full flex-shrink-0 mt-2" />
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}