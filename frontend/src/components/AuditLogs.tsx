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

const RANK_TRANSLATIONS: Record<string, string> = {
  private: 'Рядовой', corporal: 'Ефрейтор', sergeant: 'Сержант', staff_sergeant: 'Старшина',
  warrant_officer: 'Прапорщик', lieutenant: 'Лейтенант', sr_lieutenant: 'Ст. лейтенант',
  captain: 'Капитан', major: 'Майор', lt_colonel: 'Подполковник', colonel: 'Полковник',
};

function translateRank(rank: string): string {
  if (!rank) return '';
  return RANK_TRANSLATIONS[rank] || rank;
}

function getSafeFullName(u: any): string {
  if (!u) return 'Неизвестный сотрудник';
  if (u.fullName) return u.fullName;
  if (u.full_name) return u.full_name;
  if (u.last_name || u.first_name) return `${u.last_name || ''} ${u.first_name || ''} ${u.patronymic || ''}`.trim();
  return 'Неизвестный сотрудник';
}

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
        api.getAllUsers()
      ]);
      
      const flatLogs = Array.isArray(logsData) ? logsData : ((logsData as any)?.results || []);
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
    return <div className="text-center py-8 text-sm text-slate-500 font-bold uppercase tracking-wider">Загрузка журнала событий...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 uppercase tracking-widest">Журнал событий</h1>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">Отслеживание всех действий в системе</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap bg-white p-3 rounded-md border border-slate-200 shadow-sm">
        <Filter size={16} className="text-slate-400 mr-1" />
        <button
          onClick={() => setFilterCat('all')}
          className={cn(
            'text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-md transition-colors',
            filterCat === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
          )}
        >
          Все события
        </button>
        {Object.entries(categoryConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setFilterCat(key)}
            className={cn(
              'text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-md transition-colors flex items-center gap-1.5',
              filterCat === key ? `${config.bg} ${config.color} border shadow-sm` : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            )}
          >
            <config.icon size={14} />
            {config.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Время</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Категория</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Действие</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Пользователь</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Детали (JSON)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? (
                filtered
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((log: any) => {
                    const config = categoryConfig[log.category] || categoryConfig.auth;
                    const userObj = users.find(u => String(u.id) === String(log.user));
                    const Icon = config.icon;
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('ru-RU')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm border', config.bg, config.color)}>
                            <Icon size={12} />
                            {config.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-bold text-slate-700">{log.action}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {userObj ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 flex-shrink-0">
                                <User size={12} />
                              </div>
                              <span className="text-xs font-bold text-slate-700">
                                {translateRank(userObj.rank)} {getSafeFullName(userObj)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-sm">Система</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[10px] text-slate-500 max-w-xs truncate font-mono bg-slate-50/50 rounded-sm" title={JSON.stringify(log.details)}>
                          {JSON.stringify(log.details)}
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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