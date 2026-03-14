import { useState, useEffect } from 'react';
import { 
  User, Shield, Key, Calendar, Award, Star, 
  CheckCircle, AlertTriangle, Edit2, Save, X, Lock,
  BarChart3, Activity, Briefcase, Medal
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { cn } from '@/utils/cn';

export function Profile() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'stats'>('profile');
  const [editMode, setEditMode] = useState(false);
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
    try {
      const tasks = await api.getTasks({ assigned_to: user?.id.toString() });
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
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await api.updateUser(user?.id, formData);
      setMessage({ type: 'success', text: 'Профиль успешно обновлен' });
      setEditMode(false);
      // Обновляем данные пользователя
      window.location.reload();
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка при обновлении профиля' });
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

  if (!user) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  const getInitials = () => {
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = () => {
    const colors = [
      'bg-red-600', 'bg-blue-600', 'bg-green-700', 'bg-purple-600', 
      'bg-amber-600', 'bg-pink-600', 'bg-indigo-600', 'bg-teal-600'
    ];
    const index = (user.id || 0) % colors.length;
    return colors[index];
  };

  const getRankDisplay = (rank: string) => {
    const ranks: Record<string, string> = {
      'private': 'Рядовой',
      'corporal': 'Ефрейтор',
      'sergeant': 'Сержант',
      'staff_sergeant': 'Старшина',
      'warrant_officer': 'Прапорщик',
      'lieutenant': 'Лейтенант',
      'sr_lieutenant': 'Старший лейтенант',
      'captain': 'Капитан',
      'major': 'Майор',
      'lt_colonel': 'Подполковник',
      'colonel': 'Полковник',
    };
    return ranks[rank] || rank;
  };

  const getRoleDisplay = (role: string) => {
    const roles: Record<string, string> = {
      'commander': 'Командир части',
      'deputy_commander': 'Заместитель командира',
      'department_head': 'Начальник отдела',
      'group_head': 'Начальник группы',
      'subordinate': 'Подчиненный',
    };
    return roles[role] || role;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Профиль</h1>
          <p className="text-sm text-slate-500 mt-1">Личные данные и служебная информация</p>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors relative',
            activeTab === 'profile' 
              ? 'text-green-700 border-b-2 border-green-700' 
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <User size={16} className="inline mr-2" />
          Профиль
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors relative',
            activeTab === 'security' 
              ? 'text-green-700 border-b-2 border-green-700' 
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Shield size={16} className="inline mr-2" />
          Безопасность
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors relative',
            activeTab === 'stats' 
              ? 'text-green-700 border-b-2 border-green-700' 
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <BarChart3 size={16} className="inline mr-2" />
          Статистика
        </button>
      </div>

      {/* Сообщения */}
      {message.text && (
        <div className={cn(
          'p-3 rounded-lg text-sm',
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        )}>
          {message.text}
        </div>
      )}

      {/* Вкладка профиля */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Левая колонка - аватар и основная информация */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <div className={cn(
                'w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-4xl font-bold border-4 border-green-200',
                getAvatarColor()
              )}>
                {getInitials()}
              </div>
              <h2 className="text-xl font-bold text-slate-800">
                {user.last_name} {user.first_name} {user.patronymic}
              </h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Medal size={16} className="text-amber-500" />
                <p className="text-green-700 font-medium">{getRankDisplay(user.rank)}</p>
              </div>
              <div className="flex items-center justify-center gap-2 mt-1">
                <Briefcase size={16} className="text-blue-500" />
                <p className="text-sm text-slate-600">{user.position}</p>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Shield size={14} className="text-green-700" />
                  <span className="text-slate-600">Уровень допуска:</span>
                  <span className="font-bold text-slate-800">{user.clearance_level}</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm mt-2">
                  <Award size={14} className="text-amber-500" />
                  <span className="text-slate-600">Роль:</span>
                  <span className="font-medium text-slate-800">{getRoleDisplay(user.role)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Activity size={16} className="text-green-700" />
                Краткая статистика
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Всего задач</span>
                  <span className="font-medium text-slate-800">{userStats.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Выполнено</span>
                  <span className="font-medium text-green-700">{userStats.completed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">В работе</span>
                  <span className="font-medium text-blue-600">{userStats.inProgress}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Просрочено</span>
                  <span className="font-medium text-red-600">{userStats.overdue}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Правая колонка - служебные данные */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">Служебная информация</h3>
                {!editMode ? (
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1 px-3 py-1 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <Edit2 size={14} />
                    Редактировать
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditMode(false)}
                      className="flex items-center gap-1 px-3 py-1 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      <X size={14} />
                      Отмена
                    </button>
                    <button
                      onClick={handleProfileUpdate}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50"
                    >
                      <Save size={14} />
                      Сохранить
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Фамилия</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
                      />
                    ) : (
                      <div className="text-sm text-slate-700 font-medium">{user.last_name || '—'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Имя</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
                      />
                    ) : (
                      <div className="text-sm text-slate-700 font-medium">{user.first_name || '—'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Отчество</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={formData.patronymic}
                        onChange={(e) => setFormData({ ...formData, patronymic: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
                      />
                    ) : (
                      <div className="text-sm text-slate-700 font-medium">{user.patronymic || '—'}</div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Звание</label>
                    <div className="text-sm text-slate-700 font-medium">{getRankDisplay(user.rank)}</div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Должность</label>
                    <div className="text-sm text-slate-700 font-medium">{user.position}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Роль в системе</label>
                    <div className="text-sm text-slate-700 font-medium">{getRoleDisplay(user.role)}</div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Дата регистрации</label>
                    <div className="text-sm text-slate-700 flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400" />
                      {user.date_joined ? new Date(user.date_joined).toLocaleDateString('ru-RU') : '—'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Уровень допуска</label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                            level <= user.clearance_level
                              ? 'bg-green-700 text-white'
                              : 'bg-slate-200 text-slate-400'
                          )}
                        >
                          {level}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Вкладка безопасности */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Key size={16} className="text-green-700" />
              Смена пароля
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Текущий пароль</label>
                <input
                  type="password"
                  value={passwordData.old_password}
                  onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Новый пароль</label>
                <input
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Подтверждение пароля</label>
                <input
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
                />
              </div>
              <button
                onClick={handlePasswordChange}
                disabled={loading}
                className="w-full py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50"
              >
                {loading ? 'Смена...' : 'Изменить пароль'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Shield size={16} className="text-green-700" />
              Параметры безопасности
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Lock size={16} className="text-green-700" />
                  <span className="text-sm text-slate-700">Таймаут сессии</span>
                </div>
                <span className="text-sm font-medium text-slate-800">30 минут</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-green-700" />
                  <span className="text-sm text-slate-700">Последний вход</span>
                </div>
                <span className="text-sm text-slate-600">
                  {user.last_login ? new Date(user.last_login).toLocaleString('ru-RU') : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-amber-500" />
                  <span className="text-sm text-slate-700">Уровень допуска</span>
                </div>
                <span className="text-sm font-bold text-green-700">{user.clearance_level}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Вкладка статистики */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-600 mb-2">
                <Activity size={18} />
                <span className="text-sm">Всего задач</span>
              </div>
              <div className="text-3xl font-bold text-slate-800">{userStats.total}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <CheckCircle size={18} />
                <span className="text-sm">Выполнено</span>
              </div>
              <div className="text-3xl font-bold text-green-700">{userStats.completed}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Activity size={18} />
                <span className="text-sm">В работе</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">{userStats.inProgress}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertTriangle size={18} />
                <span className="text-sm">Просрочено</span>
              </div>
              <div className="text-3xl font-bold text-red-600">{userStats.overdue}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Последние задачи</h3>
            <div className="space-y-2">
              {userTasks.slice(0, 5).map((task: any) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{task.title}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {task.status === 'done' ? 'Выполнена' : 
                       task.status === 'in_progress' ? 'В работе' : 
                       task.status === 'todo' ? 'К выполнению' : 'Запланирована'}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : '—'}
                  </div>
                </div>
              ))}
              {userTasks.length === 0 && (
                <div className="text-center py-8 text-slate-400">Нет задач</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}