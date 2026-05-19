import { useState, useEffect } from 'react';
import { 
  User, Shield, Key, Save, Briefcase, Medal, 
  Lock, Activity, BarChart3, Calendar 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { cn } from '@/utils/cn';

const RANK_TRANSLATIONS: Record<string, string> = {
  private: 'Рядовой', corporal: 'Ефрейтор', sergeant: 'Сержант', staff_sergeant: 'Старшина',
  warrant_officer: 'Прапорщик', lieutenant: 'Лейтенант', sr_lieutenant: 'Ст. лейтенант',
  captain: 'Капитан', major: 'Майор', lt_colonel: 'Подполковник', colonel: 'Полковник',
};

const ROLE_TRANSLATIONS: Record<string, string> = {
  commander: 'Командир части', deputy_commander: 'Заместитель командира',
  department_head: 'Начальник отдела', group_head: 'Начальник группы', subordinate: 'Подчиненный',
};

export function Profile() {
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    patronymic: '',
  });
  
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [userStats, setUserStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        patronymic: user.patronymic || '',
      });
      loadUserTasks();
    }
  }, [user]);

  const loadUserTasks = async () => {
    if (!user || typeof user.id === 'undefined') return;
    try {
      // ИСПРАВЛЕНИЕ: Явно указываем тип any, чтобы избежать ошибки TS
      const tasks: any = await api.getTasks({ assigned_to: String(user.id) });
      const tasksArray = Array.isArray(tasks) ? tasks : (tasks.results || []);
      setUserTasks(tasksArray);
      
      const stats = {
        total: tasksArray.length,
        completed: tasksArray.filter((t: any) => t.status === 'done').length,
        inProgress: tasksArray.filter((t: any) => t.status === 'in_progress').length,
        overdue: tasksArray.filter((t: any) => 
          new Date(t.deadline) < new Date() && t.status !== 'done'
        ).length,
      };
      setUserStats(stats);
    } catch (error) {
      console.error('Failed to load user tasks:', error);
    }
  };

  const handleProfileUpdate = async () => {
    if (!user || typeof user.id === 'undefined') return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await api.updateUser(user.id, formData);
      setMessage({ type: 'success', text: 'Данные успешно обновлены' });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка при сохранении данных' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: 'error', text: 'Пароли не совпадают' });
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await api.changePassword(
        passwordData.old_password,
        passwordData.new_password,
        passwordData.confirm_password
      );
      setMessage({ type: 'success', text: 'Пароль успешно изменен' });
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Ошибка при смене пароля' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="p-6 text-sm text-slate-500 font-bold uppercase tracking-wider">Загрузка...</div>;

  const getInitials = () => `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800 uppercase tracking-widest">Учетная запись</h1>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
            Настройки профиля, безопасности и личная статистика
          </p>
        </div>
      </div>

      {message.text && (
        <div className={cn(
          'p-3 rounded-sm text-[11px] font-bold uppercase tracking-wider border shadow-sm',
          message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        )}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        
        {/* КАРТОЧКА СОТРУДНИКА (Левая колонка) */}
        <div className="md:col-span-1 bg-white border border-slate-200 rounded-sm p-6 shadow-sm flex flex-col items-center text-center sticky top-20">
          <div className="w-24 h-24 rounded-sm mb-4 flex items-center justify-center text-white text-3xl font-bold bg-slate-800">
            {getInitials()}
          </div>
          
          <h2 className="text-lg font-bold text-slate-800 leading-tight">
            {user.last_name} {user.first_name} {user.patronymic}
          </h2>
          
          <div className="flex flex-col gap-2 mt-4 w-full">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-2 rounded-sm text-sm">
              <Medal size={16} className="text-amber-500 shrink-0" />
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">{RANK_TRANSLATIONS[user.rank] || user.rank}</span>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-2 rounded-sm text-sm">
              <Briefcase size={16} className="text-blue-500 shrink-0" />
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">{user.position || '—'}</span>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-2 rounded-sm text-sm">
              <Shield size={16} className="text-green-600 shrink-0" />
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Допуск: Уровень {user.clearance_level}</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-2 rounded-sm text-sm">
              <User size={16} className="text-purple-500 shrink-0" />
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">{ROLE_TRANSLATIONS[user.role] || user.role}</span>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-2 rounded-sm text-sm mt-2 border-t-2 border-t-slate-200">
              <Activity size={16} className="text-slate-400 shrink-0" />
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                В системе с: {'date_joined' in user && (user as any).date_joined ? new Date((user as any).date_joined).toLocaleDateString('ru-RU') : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* НАСТРОЙКИ И СТАТИСТИКА (Правая колонка, занимает 2/3 ширины) */}
        <div className="md:col-span-2 space-y-4">
          
          {/* ЛИЧНЫЕ ДАННЫЕ */}
          <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
              <User size={16} className="text-green-700" />
              Редактирование данных
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Фамилия</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-sm focus:outline-none focus:border-green-600 bg-slate-50 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Имя</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-sm focus:outline-none focus:border-green-600 bg-slate-50 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Отчество</label>
                <input
                  type="text"
                  value={formData.patronymic}
                  onChange={(e) => setFormData({ ...formData, patronymic: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-sm focus:outline-none focus:border-green-600 bg-slate-50 focus:bg-white transition-colors"
                />
              </div>
            </div>
            
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                onClick={handleProfileUpdate}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-sm hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Save size={14} /> Сохранить данные
              </button>
            </div>
          </div>

          {/* БЕЗОПАСНОСТЬ */}
          <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Key size={16} className="text-green-700" />
              Смена пароля
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Текущий пароль</label>
                <input
                  type="password"
                  value={passwordData.old_password}
                  onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-sm focus:outline-none focus:border-green-600 bg-slate-50 focus:bg-white transition-colors font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Новый пароль</label>
                <input
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-sm focus:outline-none focus:border-green-600 bg-slate-50 focus:bg-white transition-colors font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Повторите пароль</label>
                <input
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-sm focus:outline-none focus:border-green-600 bg-slate-50 focus:bg-white transition-colors font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-slate-100 pt-4 gap-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Lock size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Сессия: Активна (защищена)</span>
              </div>
              <button
                onClick={handlePasswordChange}
                disabled={loading || !passwordData.old_password || !passwordData.new_password}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 text-xs font-bold uppercase tracking-wider bg-slate-800 text-white rounded-sm hover:bg-slate-900 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Shield size={14} /> Обновить пароль
              </button>
            </div>
          </div>

          {/* СТАТИСТИКА ПОЛЬЗОВАТЕЛЯ */}
          <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
              <BarChart3 size={16} className="text-blue-600" />
              Личная статистика задач
            </h3>
            
            {/* Плашки с цифрами */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 shadow-sm text-center transition-transform hover:-translate-y-0.5">
                <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Всего</div>
                <div className="text-2xl font-black text-slate-800">{userStats.total}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-sm p-3 shadow-sm text-center transition-transform hover:-translate-y-0.5">
                <div className="text-[9px] text-green-700 uppercase font-bold tracking-wider mb-1">Выполнено</div>
                <div className="text-2xl font-black text-green-700">{userStats.completed}</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 shadow-sm text-center transition-transform hover:-translate-y-0.5">
                <div className="text-[9px] text-blue-700 uppercase font-bold tracking-wider mb-1">В работе</div>
                <div className="text-2xl font-black text-blue-700">{userStats.inProgress}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-sm p-3 shadow-sm text-center transition-transform hover:-translate-y-0.5">
                <div className="text-[9px] text-red-700 uppercase font-bold tracking-wider mb-1">Просрочено</div>
                <div className="text-2xl font-black text-red-700">{userStats.overdue}</div>
              </div>
            </div>

            {/* Последние задачи */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Последние назначенные задачи</h4>
              <div className="space-y-2">
                {userTasks.slice(0, 5).map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-sm hover:border-slate-300 transition-colors shadow-sm">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-sm font-bold text-slate-700 truncate" title={task.title}>{task.title}</div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mt-1">
                        {task.status === 'done' ? <span className="text-green-600">Выполнена</span> : 
                         task.status === 'in_progress' ? <span className="text-amber-600">В работе</span> : 
                         task.status === 'todo' ? 'К выполнению' : 'Запланирована'}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5 whitespace-nowrap bg-slate-50 px-2 py-1 border border-slate-100 rounded-sm">
                      <Calendar size={12} />
                      {task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : 'Без срока'}
                    </div>
                  </div>
                ))}
                
                {userTasks.length === 0 && (
                  <div className="text-center py-8 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-2 border-dashed border-slate-200 rounded-sm bg-slate-50">
                    На данный момент у вас нет назначенных задач
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}