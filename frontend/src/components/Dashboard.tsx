import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Clock, ListTodo, TrendingUp, Users, FileWarning, ShieldAlert } from 'lucide-react';
import type { Task } from '@/types';
import api from '@/services/api';

interface DashboardProps {
  tasks: Task[];
}

export function Dashboard({ tasks }: DashboardProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersData = await api.getUsers();
      // Обработка пагинированного ответа
      const usersList = Array.isArray(usersData) ? usersData : (usersData.results || []);
      setUsers(usersList);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const critical = tasks.filter(t => t.priority === 'critical' && t.status !== 'done').length;
  const overdue = tasks.filter(t => new Date(t.deadline) < new Date() && t.status !== 'done').length;

  const stats = [
    { label: 'Всего задач', value: total, icon: ListTodo, color: 'bg-blue-500', bg: 'bg-blue-50' },
    { label: 'В работе', value: inProgress, icon: Clock, color: 'bg-amber-500', bg: 'bg-amber-50' },
    { label: 'Выполнено', value: done, icon: CheckCircle2, color: 'bg-green-700', bg: 'bg-green-50' },
    { label: 'Критические', value: critical, icon: AlertTriangle, color: 'bg-red-500', bg: 'bg-red-50' },
    { label: 'Просрочено', value: overdue, icon: FileWarning, color: 'bg-orange-500', bg: 'bg-orange-50' },
    { label: 'Личный состав', value: users.length, icon: Users, color: 'bg-violet-500', bg: 'bg-violet-50' },
  ];

  const priorityCounts = {
    critical: tasks.filter(t => t.priority === 'critical').length,
    high: tasks.filter(t => t.priority === 'high').length,
    medium: tasks.filter(t => t.priority === 'medium').length,
    low: tasks.filter(t => t.priority === 'low').length,
  };

  const statusLabels: Record<string, string> = {
    planned: 'Запланировано',
    todo: 'К выполнению',
    in_progress: 'В работе',
    review: 'На проверке',
    done: 'Выполнено',
  };

  const statusCounts = Object.entries(statusLabels).map(([key, label]) => ({
    key,
    label,
    count: tasks.filter(t => t.status === key).length,
  }));

  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Панель управления</h1>
          <p className="text-sm text-slate-500 mt-1">Обзор состояния задач в/ч 2103</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
          <ShieldAlert size={16} className="text-green-700" />
          <span className="text-sm font-medium text-green-700">Система защищена</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon size={16} className={s.color.replace('bg-', 'text-')} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800">{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-700" />
            Распределение по статусу
          </h3>
          <div className="space-y-3">
            {statusCounts.map(s => (
              <div key={s.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">{s.label}</span>
                  <span className="font-medium text-slate-800">{s.count}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-700 rounded-full transition-all"
                    style={{ width: `${total > 0 ? (s.count / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            По приоритету
          </h3>
          <div className="space-y-4">
            {[
              { key: 'critical', label: 'Критический', color: 'bg-red-500', count: priorityCounts.critical },
              { key: 'high', label: 'Высокий', color: 'bg-orange-500', count: priorityCounts.high },
              { key: 'medium', label: 'Средний', color: 'bg-yellow-500', count: priorityCounts.medium },
              { key: 'low', label: 'Низкий', color: 'bg-blue-500', count: priorityCounts.low },
            ].map(p => (
              <div key={p.key} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${p.color}`} />
                <span className="text-sm text-slate-600 flex-1">{p.label}</span>
                <span className="text-sm font-bold text-slate-800">{p.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-700">{completionRate}%</div>
              <div className="text-xs text-slate-500 mt-1">Выполнение</div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-blue-500" />
            Ближайшие дедлайны
          </h3>
          <div className="space-y-3">
            {tasks
              .filter(t => t.status !== 'done')
              .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
              .slice(0, 5)
              .map(t => {
                const assignee = users.find(u => u.id.toString() === t.assigneeId);
                const isOverdue = new Date(t.deadline) < new Date();
                return (
                  <div key={t.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      t.priority === 'critical' ? 'bg-red-500' :
                      t.priority === 'high' ? 'bg-orange-500' :
                      t.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 truncate">{t.title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {assignee?.rank} {assignee?.full_name}
                      </div>
                    </div>
                    <div className={`text-[10px] font-medium ${isOverdue ? 'text-red-500' : 'text-slate-500'}`}>
                      {new Date(t.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}