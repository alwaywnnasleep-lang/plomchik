import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Kanban, 
  Users, 
  Calendar,
  Bell,
  FileText,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ListTodo // Добавим для задач
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  unreadCount: number;
}

export function Sidebar({ collapsed, onToggle, unreadCount }: SidebarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Дашборд' },
    { path: '/tasks', icon: ListTodo, label: 'Задачи' }, // Объединенный пункт для канбана и статистики
    { path: '/structure', icon: Users, label: 'Оргструктура' },
    { path: '/autoplan', icon: Calendar, label: 'Автоплан' },
    { path: '/notifications', icon: Bell, label: 'Уведомления', badge: unreadCount },
    { path: '/logs', icon: FileText, label: 'Журналы' },
    //{ path: '/security', icon: Shield, label: 'Безопасность' },
    //{ path: '/docs', icon: FileText, label: 'Документы' },
  ];

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-screen bg-slate-900 text-white transition-all duration-300',
      collapsed ? 'w-16' : 'w-60'
    )}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between p-4">
          {!collapsed && <span className="font-bold text-emerald-400">Система мониторинга</span>}
          <button onClick={onToggle} className="p-1 hover:bg-slate-800 rounded">
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }: { isActive: boolean }) => cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-gray-300 hover:bg-emerald-700/50'
              )}
            >
              <item.icon size={20} />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                      {item.badge}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-gray-300 hover:bg-red-600/20 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            {!collapsed && <span>Выход</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}