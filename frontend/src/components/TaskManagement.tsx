import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { KanbanBoard } from './KanbanBoard';
import { Statistics } from './Statistics';
import { CalendarBoard } from './CalendarBoard';
import { Download, CheckCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Task } from '@/types';
import { ReportGenerator } from '@/components/ReportGenerator';
import api from '@/services/api';
import { triggerPushNotification } from './Notifications'; 

interface TaskManagementProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  searchQuery: string;
}

export function TaskManagement({ tasks, onTasksChange, searchQuery }: TaskManagementProps) {
  // ПОДКЛЮЧАЕМ ПАРАМЕТРЫ URL
  const [searchParams, setSearchParams] = useSearchParams();
  
  // СТРОГО ЧИТАЕМ ТЕКУЩИЙ ВИД ИЗ URL (по умолчанию kanban)
  const viewMode = searchParams.get('view') || 'kanban';
  
  const [showReportModal, setShowReportModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК
  const handleViewChange = (mode: string) => {
    setSearchParams(prev => {
      prev.set('view', mode);
      // Очищаем хвосты от календаря при уходе с него, чтобы не захламлять URL
      if (mode !== 'calendar') {
        prev.delete('calView');
        prev.delete('date');
        prev.delete('taskId');
      }
      return prev;
    });
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredTasks = useMemo(() => {
    const visibleTasks = tasks.filter(t => !t.tags?.includes('Напоминание'));

    if (!searchQuery) return visibleTasks;
    
    const query = searchQuery.toLowerCase();
    return visibleTasks.filter(t =>
      t.title.toLowerCase().includes(query) ||
      (t.description && t.description.toLowerCase().includes(query)) ||
      (t.tags && t.tags.some(tag => tag.toLowerCase().includes(query)))
    );
  }, [tasks, searchQuery]);

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];
    const now = Date.now();

    tasks.forEach(task => {
      const isStandalone = task.tags?.includes('Напоминание');
      const rTimeRaw = (task as any).reminder_time || (isStandalone ? task.deadline : null);
      
      if (rTimeRaw) {
        const rTime = new Date(rTimeRaw).getTime();
        const timeToWait = rTime - now;

        if (timeToWait > 0 && timeToWait <= 86400000) {
          const tId = setTimeout(() => {
            triggerPushNotification('🔔 Напоминание', task.title);
            showNotification(`Напоминание: ${task.title}`);
          }, timeToWait);
          timeouts.push(tId);
        }
      }
    });

    return () => timeouts.forEach(clearTimeout);
  }, [tasks]);

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      await api.updateTask(parseInt(taskId), updates);
      onTasksChange(tasks.map(t => t.id === taskId ? { ...t, ...updates } : t));
      showNotification('Изменения сохранены');
    } catch (error) {
      console.error(error);
      showNotification('Ошибка при сохранении', 'error');
    }
  };

  const handleTaskAdd = async (taskData: Partial<Task>) => {
    try {
      const createdTask = await api.createTask(taskData);
      const newTask: Task = {
        ...taskData,
        id: createdTask.id?.toString() || Date.now().toString(),
        createdAt: new Date().toISOString(),
      } as Task;
      
      onTasksChange([...tasks, newTask]);
      
      const isEvent = taskData.is_milestone || taskData.tags?.includes('Мероприятие');
      showNotification(isEvent ? 'Мероприятие добавлено' : 'Задача создана');
    } catch (error) {
      console.error(error);
      showNotification('Ошибка при создании', 'error');
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    const previousTasks = [...tasks];
    onTasksChange(tasks.filter(t => t.id !== taskId));
    showNotification('Запись успешно удалена');

    try {
      await api.deleteTask(parseInt(taskId));
    } catch (error: any) {
      if (error.message?.includes('JSON') || error.name === 'SyntaxError') {
        return;
      }
      console.error(error);
      onTasksChange(previousTasks);
      showNotification('Ошибка при удалении', 'error');
    }
  };

  return (
    <div className="space-y-4 relative">
      {toast && (
        <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={cn(
            "flex items-center gap-3 px-5 py-3 rounded-md shadow-lg border",
            toast.type === 'success' ? "bg-white border-green-200 text-green-800" : "bg-white border-red-200 text-red-800"
          )}>
            {toast.type === 'success' ? <CheckCheck size={18} className="text-green-600" /> : <AlertTriangle size={18} className="text-red-600" />}
            <span className="text-xs font-bold uppercase tracking-wider">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-md border border-slate-200">
          <button
            onClick={() => handleViewChange('kanban')}
            className={cn("px-6 py-2 text-xs font-bold uppercase tracking-wider rounded", viewMode === 'kanban' ? "bg-green-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50")}
          >
            Канбан
          </button>
          <button
            onClick={() => handleViewChange('stats')}
            className={cn("px-6 py-2 text-xs font-bold uppercase tracking-wider rounded", viewMode === 'stats' ? "bg-green-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50")}
          >
            Статистика
          </button>
          <button
            onClick={() => handleViewChange('calendar')}
            className={cn("px-6 py-2 text-xs font-bold uppercase tracking-wider rounded", viewMode === 'calendar' ? "bg-green-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50")}
          >
            Календарь
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-md hover:bg-green-700 shadow-sm"
          >
            <Download size={14} /> Отчёт
          </button>
        </div>
      </div>

      <div className="pt-2">
        {viewMode === 'kanban' && <KanbanBoard tasks={filteredTasks} onTasksChange={onTasksChange} searchQuery={searchQuery} />}
        {viewMode === 'stats' && <Statistics tasks={filteredTasks} />}
        {viewMode === 'calendar' && (
          <div className="h-[750px]">
            <CalendarBoard tasks={filteredTasks} onTaskUpdate={handleTaskUpdate} onTaskAdd={handleTaskAdd} onTaskDelete={handleTaskDelete} />
          </div>
        )}
      </div>

      {showReportModal && <ReportGenerator onClose={() => setShowReportModal(false)} />}
    </div>
  );
}