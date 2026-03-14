import { useState, useRef, useEffect } from 'react';
import { Bell, Search, Shield, Lock, User, Settings, LogOut, ChevronDown, BarChart3, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { User as UserType } from '@/types';
import { cn } from '@/utils/cn';

interface HeaderProps {
  currentUser: UserType;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  unreadCount: number;
  onNotificationsClick: () => void;
}

export function Header({ currentUser, searchQuery, onSearchChange, unreadCount, onNotificationsClick }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
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
    return currentUser.fullName.split(' ').map(n => n[0]).join('');
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск задач, пользователей..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30 focus:border-green-700 bg-slate-50"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
          <Lock size={12} className="text-green-700" />
          <span className="text-[11px] font-medium text-green-700">TLS 1.3</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-full">
          <Shield size={12} className="text-blue-600" />
          <span className="text-[11px] font-medium text-blue-700">AES-256</span>
        </div>

        <button
          onClick={onNotificationsClick}
          className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Профиль с выпадающим меню */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 pl-3 border-l border-slate-200 hover:bg-slate-50 py-1 pr-2 rounded-lg transition-colors"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: currentUser.avatarColor }}
            >
              {getInitials()}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-medium text-slate-700">{currentUser.rank} {currentUser.fullName}</div>
              <div className="text-[10px] text-slate-400">{currentUser.position}</div>
            </div>
            <ChevronDown size={14} className={cn('text-slate-400 transition-transform', menuOpen && 'rotate-180')} />
          </button>

          {/* Выпадающее меню */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-sm font-medium text-slate-800">{currentUser.rank} {currentUser.fullName}</div>
                <div className="text-xs text-slate-500 mt-0.5">{currentUser.position}</div>
              </div>
              
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/profile');
                }}
                className="w-full px-4 py-2 text-sm text-left text-slate-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
              >
                <User size={14} />
                Мой профиль
              </button>
              
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/profile?tab=stats');
                }}
                className="w-full px-4 py-2 text-sm text-left text-slate-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
              >
                <BarChart3 size={14} />
                Моя статистика
              </button>
              
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/profile?tab=security');
                }}
                className="w-full px-4 py-2 text-sm text-left text-slate-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
              >
                <Key size={14} />
                Безопасность
              </button>
              
              <div className="border-t border-slate-100 my-1"></div>
              
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/settings');
                }}
                className="w-full px-4 py-2 text-sm text-left text-slate-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
              >
                <Settings size={14} />
                Настройки
              </button>
              
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut size={14} />
                Выход
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}