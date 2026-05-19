import { useState, useEffect, useMemo } from 'react';
import { 
  Bell, CheckCheck, AlertTriangle, UserPlus, Network, 
  Trash2, Target, Users, BellRing, Plus, Clock, Link, Save, X
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import type { Notification, Task } from '@/types';
import { cn } from '@/utils/cn';
import api from '@/services/api';

// Экспортируем функцию Push-уведомлений
export const triggerPushNotification = (title: string, body?: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
};

// ==========================================
// ОСНОВНОЙ КОМПОНЕНТ: ЦЕНТР УВЕДОМЛЕНИЙ
// ==========================================

interface NotificationsCenterProps {
  notifications: Notification[];
  onNotificationsChange: (n: Notification[]) => void;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

export function Notifications({ notifications, onNotificationsChange, tasks, onTasksChange }: NotificationsCenterProps) {
  const [activeTab, setActiveTab] = useState<'notifications' | 'reminders'>('notifications');
  const unreadCount = notifications.filter(n => !n.read).length;

  // НОВОЕ: Подключение WebSocket для мгновенных уведомлений
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Предполагаем, что эндпоинт называется /ws/notifications/ (настрой в Django Channels)
    const wsUrl = `${protocol}//localhost:8000/ws/notifications/`;
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWs = () => {
      ws = new WebSocket(wsUrl);
      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          // Когда получаем сигнал об обновлении, запрашиваем свежие уведомления
          if (data.type === 'notification' || data.type === 'update') {
            const res: any = await api.getNotifications();
            const notifsList = Array.isArray(res) ? res : (res.results || []);
            const formatted = notifsList.map((n: any) => ({
              id: n.id.toString(),
              type: n.notification_type || n.type || 'default',
              message: n.message,
              timestamp: n.created_at || n.timestamp,
              read: n.is_read || n.read,
              taskId: n.related_task?.toString() || n.taskId,
            }));
            onNotificationsChange(formatted);
            
            // Если пришло новое непрочитанное уведомление — показываем Push
            if (data.message) {
              triggerPushNotification('Новое уведомление', data.message);
            }
          }
        } catch (e) {
          console.error('WebSocket Error:', e);
        }
      };
      ws.onclose = () => { reconnectTimeout = setTimeout(connectWs, 3000); };
      ws.onerror = () => { ws.close(); };
    };

    connectWs();
    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [onNotificationsChange]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300 relative">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-md border border-slate-200">
          <button
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "px-6 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-2", 
              activeTab === 'notifications' ? "bg-green-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
            )}
          >
            <Bell size={14} />
            Уведомления
            {unreadCount > 0 && (
              <span className={cn("px-1.5 py-0.5 rounded-full text-[10px]", activeTab === 'notifications' ? "bg-white text-green-700" : "bg-red-500 text-white")}>
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={cn(
              "px-6 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-2", 
              activeTab === 'reminders' ? "bg-green-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
            )}
          >
            <Clock size={14} />
            Напоминания
          </button>
        </div>
      </div>

      <div className="pt-2">
        {activeTab === 'notifications' && (
          <NotificationsList notifications={notifications} onNotificationsChange={onNotificationsChange} />
        )}
        {activeTab === 'reminders' && (
          <RemindersList tasks={tasks} onTasksChange={onTasksChange} />
        )}
      </div>
    </div>
  );
}

// ==========================================
// КОМПОНЕНТ 1: СПИСОК УВЕДОМЛЕНИЙ
// ==========================================

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

function NotificationsList({ notifications, onNotificationsChange }: { notifications: Notification[]; onNotificationsChange: (n: Notification[]) => void; }) {
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
      new Notification('Уведомления включены', { body: 'Теперь вы будете получать системные оповещения.' });
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
      <div className="flex justify-end gap-2 mb-4">
        {!pushEnabled && (
          <button onClick={requestPushPermission} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-white text-green-700 border border-green-600 rounded-md hover:bg-green-50 shadow-sm">
            <BellRing size={14} /> Включить Push
          </button>
        )}
        {unread.length > 0 && (
          <button onClick={markAllRead} disabled={loading} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 shadow-sm">
            <CheckCheck size={14} /> Прочитать все
          </button>
        )}
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
                <div key={n.id} className={cn('bg-white rounded-md border p-3 flex items-start gap-3 group shadow-sm transition-colors', n.read ? 'border-slate-200' : `${config.unreadBorder} ${config.unreadBg}`)}>
                  <div className={cn('w-8 h-8 rounded flex items-center justify-center flex-shrink-0', config.bg)}>
                    <Icon size={16} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className={cn('text-xs', n.read ? 'text-slate-600' : 'text-slate-800 font-bold')}>{n.message}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">{new Date(n.timestamp).toLocaleString('ru-RU')}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    {!n.read && (
                      <button onClick={() => markRead(n.id)} className="p-1.5 text-slate-400 hover:text-green-700 rounded-sm hover:bg-slate-100" title="Прочитать"><CheckCheck size={14} /></button>
                    )}
                    <button onClick={() => deleteNotification(n.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-sm hover:bg-slate-100" title="Удалить"><Trash2 size={14} /></button>
                  </div>
                  {!n.read && <div className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-2", config.dot)} />}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

// ==========================================
// КОМПОНЕНТ 2: СПИСОК НАПОМИНАНИЙ
// ==========================================

function RemindersList({ tasks, onTasksChange }: { tasks: Task[]; onTasksChange: (tasks: Task[]) => void; }) {
  const [showAddModal, setShowAddModal] = useState(false);

  const reminders = useMemo(() => {
    return tasks
      .filter(t => {
        const isStandalone = t.tags?.includes('Напоминание');
        const hasReminderTime = !!(t as any).reminder_time;
        return (isStandalone || hasReminderTime) && !t.is_archived && t.status !== 'done';
      })
      .sort((a, b) => {
        const timeA = (a as any).reminder_time || a.deadline || a.createdAt;
        const timeB = (b as any).reminder_time || b.deadline || b.createdAt;
        return new Date(timeA).getTime() - new Date(timeB).getTime();
      });
  }, [tasks]);

  const handleDeleteReminder = async (task: Task) => {
    const isStandalone = task.tags?.includes('Напоминание');
    if (isStandalone) {
      onTasksChange(tasks.filter(t => t.id !== task.id));
    } else {
      onTasksChange(tasks.map(t => t.id === task.id ? { ...t, reminder_time: null } : t));
    }

    try {
      if (isStandalone) {
        await api.deleteTask(parseInt(task.id));
      } else {
        await api.updateTask(parseInt(task.id), { reminder_time: null } as any);
      }
    } catch (error: any) {
      if (error.message?.includes('JSON') || error.name === 'SyntaxError') return;
      console.error('Ошибка при удалении напоминания:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-md hover:bg-green-700 shadow-sm"
        >
          <Plus size={14} /> Создать напоминание
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden min-h-[400px]">
        {reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-center">
            <Clock size={48} className="text-slate-200 mb-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Нет активных напоминаний</span>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-[150px]">Время</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Текст напоминания</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-[200px]">Привязка</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right w-[100px]">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reminders.map(r => {
                const isStandalone = r.tags?.includes('Напоминание');
                const rTimeRaw = (r as any).reminder_time || r.deadline || r.createdAt;
                const rTime = new Date(rTimeRaw);
                const isPast = rTime.getTime() < Date.now();

                return (
                  <tr key={r.id} className={cn("hover:bg-slate-50 transition-colors", isPast && "opacity-60")}>
                    <td className="py-3 px-4">
                      <div className={cn("text-sm font-bold flex items-center gap-1.5", isPast ? "text-slate-400" : "text-green-700")}>
                        <Clock size={14} />
                        {format(rTime, 'dd.MM.yyyy HH:mm', { locale: ru })}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {r.title}
                    </td>
                    <td className="py-3 px-4">
                      {isStandalone ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-sm">Самостоятельное</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded-sm border border-blue-200 flex items-center gap-1 w-max">
                          <Link size={10} /> К задаче
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleDeleteReminder(r)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-sm" title="Удалить">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <AddReminderModal
          tasks={tasks.filter(t => !t.is_archived && t.status !== 'done' && !t.tags?.includes('Напоминание'))}
          onClose={() => setShowAddModal(false)}
          onAdd={async (data) => {
            try {
              if (data.taskId) {
                await api.updateTask(parseInt(data.taskId), { reminder_time: data.time } as any);
                onTasksChange(tasks.map(t => t.id === data.taskId ? { ...t, reminder_time: data.time } : t));
              } else {
                const newTask = await api.createTask({
                  title: data.text,
                  status: 'todo',
                  priority: 'medium',
                  reminder_time: data.time,
                  deadline: data.time,
                  tags: ['Напоминание']
                } as any);
                onTasksChange([...tasks, { ...newTask, reminder_time: data.time, deadline: data.time, id: newTask.id.toString() } as any]);
              }
              
              const timeToWait = new Date(data.time).getTime() - Date.now();
              if (timeToWait > 0) {
                setTimeout(() => triggerPushNotification('🔔 Напоминание', data.text), timeToWait);
              }
              setShowAddModal(false);
            } catch (error) {
              console.error(error);
              alert('Ошибка при создании напоминания');
            }
          }}
        />
      )}
    </div>
  );
}

function AddReminderModal({ tasks, onClose, onAdd }: { tasks: Task[]; onClose: () => void; onAdd: (data: { text: string; time: string; taskId?: string }) => void }) {
  const [text, setText] = useState('');
  const [time, setTime] = useState('');
  const [linkedTaskId, setLinkedTaskId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!time || (!text.trim() && !linkedTaskId)) return;
    const finalTitle = text.trim() || (linkedTaskId ? tasks.find(t => t.id === linkedTaskId)?.title || 'Напоминание' : 'Напоминание');
    onAdd({ text: finalTitle, time, taskId: linkedTaskId || undefined });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-md w-full max-w-md overflow-hidden flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Clock size={16} className="text-slate-500" /> Создать напоминание
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-sm"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Текст напоминания</label>
            <input type="text" value={text} onChange={e => setText(e.target.value)} className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 outline-none focus:border-green-600 bg-white" placeholder="Введите текст..." />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Привязать к задаче</label>
            <select value={linkedTaskId} onChange={e => setLinkedTaskId(e.target.value)} className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 outline-none focus:border-green-600 bg-white">
              <option value="">-- Самостоятельное напоминание --</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Дата и время *</label>
            <input type="datetime-local" value={time} onChange={e => setTime(e.target.value)} className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 outline-none focus:border-green-600 bg-white" required />
          </div>
          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600">Отмена</button>
            <button type="submit" className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 shadow-sm"><Save size={14} /> Запланировать</button>
          </div>
        </form>
      </div>
    </div>
  );
}