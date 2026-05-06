import { useState, useEffect } from 'react';
import { Shield, Users, ListTodo, LogIn, Filter, User } from 'lucide-react';
import { cn } from '@/utils/cn';
import api from '@/services/api';

const categoryConfig: Record<string, { label: string; icon: typeof Shield; color: string; bg: string }> = {
  auth: { label: 'Авторизация', icon: LogIn, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
  tasks: { label: 'Задачи', icon: ListTodo, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  structure: { label: 'Структура', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
  security: { label: 'Безопасность', icon: Shield, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
  documents: { label: 'Документы', icon: ListTodo, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
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
      // Запрашиваем логи и полный список пользователей параллельно
      const [logsData, usersData] = await Promise.all([
        api.getAuditLogs(),
        api.getAllUsers()
      ]);
      
      // Безопасное извлечение для логов (избегаем TS ошибки)
      const flatLogs = Array.isArray(logsData) ? logsData : ((logsData as any)?.results || []);
      
      // Метод getAllUsers уже гарантированно возвращает массив, дополнительных проверок не нужно
      const flatUsers = usersData || [];
      
      setLogs(flatLogs);
      setUsers(flatUsers);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filterCat === 'all' ? logs : logs.filter(l => l.category === filterCat);

  if (loading) {
    return <div className="text-center py-8 text-sm text-slate-500">Загрузка журнала событий...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Журнал событий</h1>
          <p className="text-sm text-slate-500 mt-1">Отслеживание всех действий в системе</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap bg-white p-3 rounded-md border border-slate-200 shadow-sm">
        <Filter size={16} className="text-slate-400 mr-1" />
        <button
          onClick={() => setFilterCat('all')}
          className={cn(
            'text-xs px-4 py-1.5 rounded border transition-colors font-medium',
            filterCat === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          )}
        >
          Все события
        </button>
        {Object.entries(categoryConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setFilterCat(key)}
            className={cn(
              'text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-1.5 font-medium',
              filterCat === key ? `${config.bg} ${config.color} border-current shadow-sm` : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            <config.icon size={14} />
            {config.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Время</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Категория</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Действие</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Пользователь</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Детали (JSON)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((log: any) => {
                    const config = categoryConfig[log.category] || categoryConfig.auth;
                    const userObj = users.find(u => u.id === log.user);
                    const Icon = config.icon;
                    return (
                      <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('ru-RU')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={cn('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border', config.bg, config.color)}>
                            <Icon size={12} />
                            {config.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-800">{log.action}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {userObj ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
                                <User size={12} />
                              </div>
                              <span className="text-xs font-medium text-slate-700">{userObj.full_name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Система</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate font-mono bg-slate-50/50" title={JSON.stringify(log.details)}>
                          {JSON.stringify(log.details)}
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Нет записей в журнале событий
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