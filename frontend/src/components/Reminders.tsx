import { useState, useMemo } from 'react';
import { Bell, Plus, Trash2, X, Clock, Link, Save } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import type { Task } from '@/types';
import api from '@/services/api';
import { cn } from '@/utils/cn';
import { triggerPushNotification } from './Notifications';

interface RemindersProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

export function Reminders({ tasks, onTasksChange }: RemindersProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  // Надежный сбор напоминаний (используем теги и deadline, если бэкенд не сохранил reminder_time)
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
    
    // 1. ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ: Сразу убираем из интерфейса
    if (isStandalone) {
      onTasksChange(tasks.filter(t => t.id !== task.id));
    } else {
      onTasksChange(tasks.map(t => t.id === task.id ? { ...t, reminder_time: null } : t));
    }

    // 2. Фоновый запрос на сервер
    try {
      if (isStandalone) {
        await api.deleteTask(parseInt(task.id));
      } else {
        await api.updateTask(parseInt(task.id), { reminder_time: null } as any);
      }
    } catch (error: any) {
      // Если это наша ошибка с парсингом пустого JSON, просто игнорируем её
      if (error.message?.includes('JSON') || error.name === 'SyntaxError') {
        return;
      }
      
      console.error('Ошибка при удалении напоминания:', error);
      // При реальной ошибке можно было бы вернуть задачу обратно, но пока просто покажем алерт
      alert('Произошла ошибка при связи с сервером');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800 uppercase tracking-widest">Напоминания</h1>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
            Запланированные уведомления
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-sm hover:bg-green-700 shadow-sm"
        >
          <Plus size={14} /> Создать
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden min-h-[500px]">
        {reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-center">
            <Bell size={48} className="text-slate-200 mb-4" />
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
                  <tr key={r.id} className={cn("hover:bg-slate-50", isPast && "opacity-60")}>
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
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-sm">
                          Самостоятельное
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded-sm border border-blue-200 flex items-center gap-1 w-max">
                          <Link size={10} /> Задача / Мероприятие
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteReminder(r)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-sm"
                        title="Удалить напоминание"
                      >
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
                  deadline: data.time, // Дублируем в дедлайн для надежности
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
      <div className="bg-white rounded-sm w-full max-w-md overflow-hidden flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Bell size={16} className="text-slate-500" />
            Создать напоминание
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-sm">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
              Текст напоминания (необязательно, если выбрана задача)
            </label>
            <input 
              type="text" 
              value={text}
              onChange={e => setText(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-sm px-3 py-2 outline-none focus:border-green-600 bg-white"
              placeholder="Введите текст..."
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
              Привязать к задаче (необязательно)
            </label>
            <select 
              value={linkedTaskId}
              onChange={e => setLinkedTaskId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-sm px-3 py-2 outline-none focus:border-green-600 bg-white"
            >
              <option value="">-- Самостоятельное напоминание --</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
              Дата и точное время (24 часа) *
            </label>
            <input 
              type="datetime-local" 
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-sm px-3 py-2 outline-none focus:border-green-600 bg-white"
              required
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-200 rounded-sm hover:bg-slate-50 text-slate-600"
            >
              Отмена
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-sm hover:bg-green-700 flex items-center gap-2 shadow-sm"
            >
              <Save size={14} /> Запланировать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}