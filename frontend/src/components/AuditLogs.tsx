import { useState, useEffect } from 'react';
import { Shield, Users, ListTodo, LogIn, Filter } from 'lucide-react';
import { cn } from '@/utils/cn';
import api from '@/services/api';

const categoryConfig: Record<string, { label: string; icon: typeof Shield; color: string; bg: string }> = {
  auth: { label: 'Авторизация', icon: LogIn, color: 'text-blue-500', bg: 'bg-blue-50' },
  tasks: { label: 'Задачи', icon: ListTodo, color: 'text-green-700', bg: 'bg-green-50' },
  structure: { label: 'Структура', icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
  security: { label: 'Безопасность', icon: Shield, color: 'text-red-500', bg: 'bg-red-50' },
  documents: { label: 'Документы', icon: ListTodo, color: 'text-amber-500', bg: 'bg-amber-50' },
};

export function AuditLogs() {
  const [filterCat, setFilterCat] = useState<string>('all');
  const [logs, setLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [logsData, usersData] = await Promise.all([
        api.getAuditLogs(),
        api.getUsers()
      ]);
      setLogs(logsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filterCat === 'all' ? logs : logs.filter(l => l.category === filterCat);

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Журнал событий</h1>
          <p className="text-sm text-slate-500 mt-1">Логирование всех действий в системе</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-slate-400" />
        <button
          onClick={() => setFilterCat('all')}
          className={cn(
            'text-xs px-3 py-1 rounded-full border transition-colors',
            filterCat === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          )}
        >
          Все
        </button>
        {Object.entries(categoryConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setFilterCat(key)}
            className={cn(
              'text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1',
              filterCat === key ? `${config.bg} ${config.color} border-current` : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            <config.icon size={12} />
            {config.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Время</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Категория</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Действие</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Пользователь</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Детали</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((log: any) => {
                    const config = categoryConfig[log.category] || categoryConfig.auth;
                    const user = users.find(u => u.id === log.user);
                    const Icon = config.icon;
                    return (
                      <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('ru-RU')}
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full', config.bg, config.color)}>
                            <Icon size={10} />
                            {config.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-700">{log.action}</td>
                        <td className="py-3 px-4">
                          {user && (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                                style={{ backgroundColor: `hsl(${user.id * 100 % 360}, 70%, 50%)` }}
                              >
                                {user.full_name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                              </div>
                              <span className="text-xs text-slate-600">{user.full_name}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate">
                          {JSON.stringify(log.details)}
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    Нет записей в журнале
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}