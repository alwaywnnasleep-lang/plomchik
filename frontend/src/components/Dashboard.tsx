import { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, CheckCircle2, Clock, ListTodo, 
  TrendingUp, Users, FileWarning, ShieldCheck, 
  Target, ChevronRight
} from 'lucide-react';
import type { Task } from '@/types';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';

interface DashboardProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void; // Добавили возможность кликать на задачи
}

export function Dashboard({ tasks = [], onTaskClick }: DashboardProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const loadUsers = async () => {
      try {
        let page = 1;
        let allUsers: any[] = [];
        let hasNext = true;
        
        // Надежно вытягиваем ВСЕХ пользователей, чтобы имена точно отобразились
        while (hasNext) {
          const response = await api.request(`/users/?page=${page}`).catch(() => null);
          if (!response) break;
          
          if (Array.isArray(response)) {
            allUsers = response;
            break;
          } else if (response.results) {
            allUsers = [...allUsers, ...response.results];
            hasNext = !!response.next;
            page++;
          } else {
            break;
          }
        }
        if (isMounted) setUsers(allUsers);
      } catch (error) {
        console.error('Failed to load users:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadUsers();
    return () => { isMounted = false; };
  }, []);

  // Базовые метрики
  const total = tasks.length;
  const done = tasks.filter(t => String(t.status).toLowerCase() === 'done').length;
  const inProgress = tasks.filter(t => ['in_progress', 'review'].includes(String(t.status).toLowerCase())).length;
  
  const critical = tasks.filter(t => 
    String(t.priority).toLowerCase() === 'critical' && 
    String(t.status).toLowerCase() !== 'done'
  ).length;
  
  const overdue = tasks.filter(t => {
    if (!t.deadline || String(t.status).toLowerCase() === 'done') return false;
    return new Date(t.deadline) < new Date();
  }).length;

  // Задачи текущего пользователя
  const myActiveTasks = useMemo(() => {
    if (!user) return 0;
    return tasks.filter(t => {
      const isMine = String(t.assigneeId || (t as any).assigned_to) === String(user.id);
      const isDone = String(t.status).toLowerCase() === 'done';
      return isMine && !isDone;
    }).length;
  }, [tasks, user]);

  const stats = [
    { label: 'Всего задач', value: total, icon: ListTodo, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: 'В производстве', value: inProgress, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: 'Выполнено', value: done, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Критичные', value: critical, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
    { label: 'Просрочено', value: overdue, icon: FileWarning, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: 'Штат (чел.)', value: users.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
  ];

  const priorityCounts = {
    critical: tasks.filter(t => String(t.priority).toLowerCase() === 'critical').length,
    high: tasks.filter(t => String(t.priority).toLowerCase() === 'high').length,
    medium: tasks.filter(t => String(t.priority).toLowerCase() === 'medium').length,
    low: tasks.filter(t => String(t.priority).toLowerCase() === 'low').length,
  };

  const statusLabels: Record<string, string> = {
    planned: 'Запланировано',
    todo: 'Ожидают начала',
    in_progress: 'В работе',
    review: 'На проверке',
    done: 'Завершено',
  };

  const statusCounts = Object.entries(statusLabels).map(([key, label]) => ({
    key,
    label,
    count: tasks.filter(t => String(t.status).toLowerCase() === key).length,
  }));

  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            Панель управления
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Оперативная сводка по войсковой части</p>
        </div>
        
        <div className="flex items-center gap-4">
          {myActiveTasks > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors">
              <Target size={18} className="text-blue-600" />
              <div className="text-sm">
                <span className="text-slate-600">Мои задачи: </span>
                <span className="font-bold text-blue-700">{myActiveTasks}</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
            <ShieldCheck size={18} className="text-emerald-600" />
            <span className="text-sm font-bold text-emerald-700">Система активна</span>
          </div>
        </div>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map(s => (
          <div key={s.label} className={cn("bg-white rounded-2xl border p-4 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md", s.border)}>
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg, s.color)}>
                <s.icon size={20} />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-800">{s.value}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* РАСПРЕДЕЛЕНИЕ ПО СТАТУСУ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-500" />
            Воронка задач
          </h3>
          <div className="space-y-4">
            {statusCounts.map(s => (
              <div key={s.key} className="group">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-600 font-medium group-hover:text-blue-600 transition-colors">{s.label}</span>
                  <span className="font-bold text-slate-800">{s.count}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      s.key === 'done' ? 'bg-emerald-500' : 
                      s.key === 'in_progress' ? 'bg-amber-500' :
                      s.key === 'review' ? 'bg-pink-500' : 'bg-blue-500'
                    )}
                    style={{ width: `${total > 0 ? (s.count / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ПРИОРИТЕТЫ И ВЫПОЛНЕНИЕ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Уровни приоритета
          </h3>
          <div className="space-y-4 flex-1">
            {[
              { key: 'critical', label: 'Критический', color: 'bg-red-500', count: priorityCounts.critical },
              { key: 'high', label: 'Высокий', color: 'bg-orange-500', count: priorityCounts.high },
              { key: 'medium', label: 'Средний', color: 'bg-amber-500', count: priorityCounts.medium },
              { key: 'low', label: 'Низкий', color: 'bg-emerald-500', count: priorityCounts.low },
            ].map(p => (
              <div key={p.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                <div className={`w-3.5 h-3.5 rounded-md ${p.color} shadow-sm`} />
                <span className="text-sm font-medium text-slate-700 flex-1">{p.label}</span>
                <span className="text-base font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{p.count}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Общий прогресс</div>
              <div className="text-sm text-slate-500">Завершено задач</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-emerald-600">{completionRate}%</div>
            </div>
          </div>
        </div>

        {/* БЛИЖАЙШИЕ ДЕДЛАЙНЫ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Clock size={18} className="text-red-500" />
            Ближайшие дедлайны
          </h3>
          <div className="space-y-3">
            {tasks
              .filter(t => String(t.status).toLowerCase() !== 'done' && t.deadline)
              .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
              .slice(0, 5)
              .map(t => {
                const assignedId = t.assigneeId || (t as any).assigned_to;
                const assignee = users.find(u => String(u.id) === String(assignedId));
                
                const dDate = new Date(t.deadline);
                const isOverdue = dDate < new Date();
                const isToday = dDate.toDateString() === new Date().toDateString();

                return (
                  <div 
                    key={t.id} 
                    onClick={() => onTaskClick && onTaskClick(t.id)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer group",
                      isOverdue ? "bg-red-50/50 border-red-100 hover:bg-red-50" : 
                      isToday ? "bg-amber-50/50 border-amber-100 hover:bg-amber-50" : 
                      "bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm"
                    )}
                  >
                    <div className={cn(
                      "mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm",
                      t.priority === 'critical' ? 'bg-red-500' :
                      t.priority === 'high' ? 'bg-orange-500' :
                      t.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                    )} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                        {t.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 truncate">
                        {assignee ? `${assignee.rank || ''} ${assignee.full_name || assignee.fullName || ''}` : 'Не назначен'}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1">
                      <div className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-md", 
                        isOverdue ? 'bg-red-100 text-red-700' : 
                        isToday ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      )}>
                        {isOverdue ? 'Просрочено' : isToday ? 'Сегодня' : dDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                      </div>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                );
              })}
              
              {tasks.filter(t => String(t.status).toLowerCase() !== 'done' && t.deadline).length === 0 && (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
                  <p className="text-sm text-slate-500 font-medium">Нет горящих дедлайнов</p>
                </div>
              )}
          </div>
        </div>
        
      </div>
    </div>
  );
}