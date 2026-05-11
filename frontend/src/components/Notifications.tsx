import { useState, useEffect } from 'react';
import { 
  Bell, CheckCheck, AlertTriangle, UserPlus, Network, 
  Trash2, Target, Users, BellRing 
} from 'lucide-react';
import type { Notification } from '@/types';
import { cn } from '@/utils/cn';
import api from '@/services/api';

// Экспортируем функцию, чтобы её можно было вызывать из других компонентов (например, из Календаря при сохранении)
export const triggerPushNotification = (title: string, body?: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
};

interface NotificationsProps {
  notifications: Notification[];
  onNotificationsChange: (n: Notification[]) => void;
}

// Расширенная конфигурация с цветами для Мероприятий (Синий) и Задач (Оранжевый)
const typeConfig: Record<string, { icon: any; color: string; bg: string; unreadBg: string; unreadBorder: string; dot: string }> = {
  task_added: { icon: Target, color: 'text-orange-600', bg: 'bg-orange-100', unreadBg: 'bg-orange-50', unreadBorder: 'border-orange-300', dot: 'bg-orange-600' },
  event_added: { icon: Users, color: 'text-blue-600', bg: 'bg-blue-100', unreadBg: 'bg-blue-50', unreadBorder: 'border-blue-300', dot: 'bg-blue-600' },
  task_assigned: { icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-50', unreadBg: 'bg-blue-50/50', unreadBorder: 'border-blue-300', dot: 'bg-blue-500' },
  deadline_approaching: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', unreadBg: 'bg-amber-50/50', unreadBorder: 'border-amber-300', dot: 'bg-amber-500' },
  task_completed: { icon: CheckCheck, color: 'text-green-700', bg: 'bg-green-50', unreadBg: 'bg-green-50/50', unreadBorder: 'border-green-300', dot: 'bg-green-700' },
  structure_changed: { icon: Network, color: 'text-purple-500', bg: 'bg-purple-50', unreadBg: 'bg-purple-50/50', unreadBorder: 'border-purple-300', dot: 'bg-purple-500' },
  security_alert: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', unreadBg: 'bg-red-50/50', unreadBorder: 'border-red-300', dot: 'bg-red-500' },
  default: { icon: Bell, color: 'text-slate-500', bg: 'bg-slate-100', unreadBg: 'bg-slate-50', unreadBorder: 'border-slate-300', dot: 'bg-slate-500' }
};

export function Notifications({ notifications, onNotificationsChange }: NotificationsProps) {
  const [loading, setLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  
  const unread = notifications.filter(n => !n.read);

  useEffect(() => {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('Ваш браузер не поддерживает Push-уведомления');
      return;
    }
    const permission = await Notification.requestPermission();
    setPushEnabled(permission === 'granted');
    if (permission === 'granted') {
      new Notification('Уведомления включены', { body: 'Теперь вы будете получать напоминания о задачах и мероприятиях.' });
    }
  };

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 uppercase tracking-widest">Уведомления</h1>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
            {unread.length > 0 ? `${unread.length} непрочитанных` : 'Все прочитано'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {!pushEnabled && (
            <button
              onClick={requestPushPermission}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-white text-green-700 border border-green-600 rounded-md hover:bg-green-50 shadow-sm"
            >
              <BellRing size={14} />
              Включить Push
            </button>
          )}

          {unread.length > 0 && (
            <button
              onClick={markAllRead}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 shadow-sm"
            >
              <CheckCheck size={14} />
              Прочитать все
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-md border border-slate-200 p-10 text-center">
            <Bell size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Нет уведомлений</p>
          </div>
        ) : (
          notifications
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map(n => {
              const config = typeConfig[n.type] || typeConfig.default;
              const Icon = config.icon;
              
              return (
                <div
                  key={n.id}
                  className={cn(
                    'bg-white rounded-md border p-3 flex items-start gap-3 group shadow-sm',
                    n.read ? 'border-slate-200' : `${config.unreadBorder} ${config.unreadBg}`
                  )}
                >
                  <div className={cn('w-8 h-8 rounded flex items-center justify-center flex-shrink-0', config.bg)}>
                    <Icon size={16} className={config.color} />
                  </div>
                  
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className={cn('text-xs', n.read ? 'text-slate-600' : 'text-slate-800 font-bold')}>
                      {n.message}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                      {new Date(n.timestamp).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    {!n.read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="p-1.5 text-slate-400 hover:text-green-700 rounded-sm hover:bg-slate-100"
                        title="Прочитать"
                      >
                        <CheckCheck size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(n.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-sm hover:bg-slate-100"
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  {!n.read && (
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-2", config.dot)} />
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}