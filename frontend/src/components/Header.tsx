import { useState, useRef, useEffect } from 'react';
import { 
  Bell, Search, Shield, Lock, User, Settings, LogOut, 
  ChevronDown, BarChart3, Key, BellPlus, X, Save, Clock 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { User as UserType } from '@/types';
import { cn } from '@/utils/cn';
import { translateRank } from '@/utils/rank';
import api from '@/services/api';
import { triggerPushNotification } from './Notifications';

interface HeaderProps {
  currentUser: UserType;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  unreadCount: number;
  onNotificationsClick: () => void;
}

export function Header({ currentUser, searchQuery, onSearchChange, unreadCount, onNotificationsClick }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showQuickReminder, setShowQuickReminder] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = () => {
    if (!currentUser.fullName) return '';
    return currentUser.fullName.split(' ').map(n => n[0]).join('');
  };

  const handleCreateQuickReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderTime || !reminderText.trim()) return;

    try {
      await api.createTask({
        title: reminderText,
        status: 'todo',
        priority: 'medium',
        reminder_time: reminderTime,
        deadline: reminderTime, 
        tags: ['Напоминание']
      } as any);

      const timeToWait = new Date(reminderTime).getTime() - Date.now();
      if (timeToWait > 0) {
        setTimeout(() => triggerPushNotification('🔔 Напоминание', reminderText), timeToWait);
      }

      setShowQuickReminder(false);
      setReminderText('');
      setReminderTime('');
      
      // Чтобы напоминание сразу появилось на всех страницах, делаем мягкую перезагрузку
      window.location.reload(); 
    } catch (error) {
      console.error('Ошибка при создании быстрого напоминания:', error);
      alert('Ошибка при создании напоминания');
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40 relative">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск задач, пользователей..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-sm outline-none focus:border-green-700 bg-slate-50"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-sm">
          <Lock size={12} className="text-green-700" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-green-700">TLS 1.3</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-sm">
          <Shield size={12} className="text-blue-600" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">AES-256</span>
        </div>

        <button
          onClick={() => setShowQuickReminder(true)}
          title="Быстрое напоминание"
          className="p-2 text-slate-500 hover:text-green-700 hover:bg-green-50 rounded-sm border border-transparent hover:border-green-200 transition-colors"
        >
          <BellPlus size={18} />
        </button>

        <button
          onClick={onNotificationsClick}
          title="Системные уведомления"
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-sm border border-transparent hover:border-slate-200 transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-sm flex items-center justify-center border border-white">
              {unreadCount}
            </span>
          )}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 pl-3 border-l border-slate-200 hover:bg-slate-50 py-1 pr-2 rounded-sm transition-colors"
          >
            <div
              className="w-8 h-8 rounded-sm flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: currentUser.avatarColor }}
            >
              {getInitials()}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700"> 
                {translateRank(currentUser.rank)} {currentUser.fullName}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{currentUser.position}</div>
            </div>
            <ChevronDown size={14} className={cn('text-slate-400 transition-transform', menuOpen && 'rotate-180')} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-sm shadow-xl border border-slate-200 py-1 z-50">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-800">{currentUser.rank} {currentUser.fullName}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">{currentUser.position}</div>
              </div>
              
              <button
                onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                className="w-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-left text-slate-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
              >
                <User size={14} /> Мой профиль
              </button>
              
              <button
                onClick={() => { setMenuOpen(false); navigate('/profile?tab=stats'); }}
                className="w-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-left text-slate-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
              >
                <BarChart3 size={14} /> Моя статистика
              </button>

              <button
                onClick={() => { setMenuOpen(false); navigate('/reminders'); }}
                className="w-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-left text-slate-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
              >
                <Bell size={14} /> Мои напоминания
              </button>
              
              <button
                onClick={() => { setMenuOpen(false); navigate('/profile?tab=security'); }}
                className="w-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-left text-slate-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
              >
                <Key size={14} /> Безопасность
              </button>
              
              <div className="border-t border-slate-100 my-1"></div>
              
              <button
                onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                className="w-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-left text-slate-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
              >
                <Settings size={14} /> Настройки
              </button>
              
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut size={14} /> Выход
              </button>
            </div>
          )}
        </div>
      </div>

      {showQuickReminder && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => setShowQuickReminder(false)}>
          <div className="bg-white rounded-sm w-full max-w-sm overflow-hidden flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Clock size={16} className="text-slate-500" />
                Быстрое напоминание
              </h2>
              <button onClick={() => setShowQuickReminder(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-sm">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateQuickReminder} className="p-4 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">О чем напомнить?</label>
                <input 
                  type="text" 
                  value={reminderText}
                  onChange={e => setReminderText(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-sm px-3 py-2 outline-none focus:border-green-600 bg-white"
                  placeholder="Текст напоминания..."
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Дата и точное время (24ч)</label>
                <input 
                  type="datetime-local" 
                  value={reminderTime}
                  onChange={e => setReminderTime(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-sm px-3 py-2 outline-none focus:border-green-600 bg-white"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 mt-2">
                <button 
                  type="button" 
                  onClick={() => setShowQuickReminder(false)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-200 rounded-sm hover:bg-slate-50 text-slate-600"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-sm hover:bg-green-700 flex items-center gap-2 shadow-sm"
                >
                  <Save size={14} /> Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}