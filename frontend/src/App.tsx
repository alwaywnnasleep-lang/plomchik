import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { KanbanBoard } from '@/components/KanbanBoard';
import { OrgStructure } from '@/components/OrgStructure';
import { AutoPlan } from '@/components/AutoPlan';
import { Notifications } from '@/components/Notifications';
import { AuditLogs } from '@/components/AuditLogs';
import { SecurityPanel } from '@/components/SecurityPanel';
import { DocsPage } from '@/components/DocsPage';
import { Login } from '@/components/Login';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import type { Task, Notification, OrgUnit } from '@/types';
import { cn } from '@/utils/cn';
import { Statistics } from '@/components/Statistics';
import { Profile } from '@/components/Profile';


function App() {
  const { user, loading, isAuthenticated } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Загрузка данных при монтировании
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
  try {
    const [tasksData, notifsData, unitsData, unreadData] = await Promise.all([
      api.getTasks(),
      api.getNotifications(),
      api.getUnits(),
      api.getUnreadCount(),
    ]);
    
    console.log('Tasks data:', tasksData); // Добавьте логи для отладки
    console.log('Units data:', unitsData);
    
    // Проверяем, что данные - это массивы
    setTasks(Array.isArray(tasksData) ? transformTasks(tasksData) : []);
    setNotifications(Array.isArray(notifsData) ? transformNotifications(notifsData) : []);
    setUnits(Array.isArray(unitsData) ? transformUnits(unitsData) : []);
    setUnreadCount(unreadData?.unread_count || 0);
  } catch (error) {
    console.error('Failed to load data:', error);
  }
};

  // Трансформеры данных (адаптеры между API и компонентами)
  const transformTasks = (apiTasks: any[]): Task[] => {
    return apiTasks.map(t => ({
      id: t.id.toString(),
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      assigneeId: t.assigned_to?.toString() || '',
      creatorId: t.created_by?.toString() || '',
      unitId: t.org_unit?.toString() || '',
      deadline: t.deadline || '',
      createdAt: t.created_at,
      tags: t.tags || [],
      subtasks: t.subtasks?.map((st: any) => ({
        id: st.id.toString(),
        title: st.title,
        done: st.status === 'done',
      })) || [],
    }));
  };

  const transformNotifications = (apiNotifs: any[]): Notification[] => {
    return apiNotifs.map(n => ({
      id: n.id.toString(),
      type: n.notification_type,
      message: n.message,
      timestamp: n.created_at,
      read: n.is_read,
      taskId: n.related_task?.toString(),
    }));
  };

  const transformUnits = (apiUnits: any[]): OrgUnit[] => {
    // Рекурсивно преобразуем дерево
    const transformUnit = (u: any): OrgUnit => ({
      id: u.id.toString(),
      name: u.name,
      parentId: u.parent?.toString() || null,
      commanderId: u.commander?.toString() || null,
      type: u.unit_type,
      children: u.children?.map(transformUnit),
    });
    return apiUnits.map(transformUnit);
  };

  const handleTasksGenerated = useCallback(async (newTasks: Task[]) => {
    // Здесь нужно будет отправлять задачи на бэкенд
    setTasks(prev => [...prev, ...newTasks]);
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        unreadCount={unreadCount}
      />
      <div className={cn(
        'transition-all duration-300',
        sidebarCollapsed ? 'ml-16' : 'ml-60'
      )}>
        <Header
          currentUser={{
            id: user?.id.toString() || '',
            fullName: user?.full_name || '',
            rank: user?.rank || '',
            position: user?.position || '',
            unitId: user?.org_unit?.toString() || '',
            avatarColor: '#2563eb', // Можно генерировать на основе id
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          unreadCount={unreadCount}
          onNotificationsClick={() => {}}
        />
        <main className="p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard tasks={tasks} />} />
            <Route path="/kanban" element={
              <KanbanBoard 
                tasks={tasks} 
                onTasksChange={setTasks} 
                searchQuery={searchQuery} 
              />
            } />
            <Route path="/structure" element={
              <OrgStructure units={units} onUnitsChange={setUnits} />
            } />
            <Route path="/autoplan" element={
              <AutoPlan onTasksGenerated={handleTasksGenerated} />
            } />
            <Route path="/notifications" element={
              <Notifications 
                notifications={notifications} 
                onNotificationsChange={setNotifications} 
              />
            } />
            <Route path="/logs" element={<AuditLogs />} />
            <Route path="/security" element={<SecurityPanel />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
            <Route path="/statistics" element={<Statistics tasks={tasks} />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;