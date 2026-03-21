import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { OrgStructure } from '@/components/OrgStructure';
import { AutoPlan } from '@/components/AutoPlan';
import { Notifications } from '@/components/Notifications';
import { AuditLogs } from '@/components/AuditLogs';
import { SecurityPanel } from '@/components/SecurityPanel';
import { DocsPage } from '@/components/DocsPage';
import { Login } from '@/components/Login';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import type { Task, Notification, OrgUnit, TaskFile } from '@/types';
import { cn } from '@/utils/cn';
import { Profile } from '@/components/Profile';
import { TaskManagement } from '@/components/TaskManagement';

function App() {
  const { user, loading, isAuthenticated } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

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
        api.getOrgTree(),
        api.getUnreadCount(),
      ]);

      console.log('Tasks data:', tasksData);
      console.log('Units tree data:', unitsData);

      // Обработка пагинированных ответов
      const tasksList = Array.isArray(tasksData) ? tasksData : (tasksData.results || []);
      const notifsList = Array.isArray(notifsData) ? notifsData : (notifsData.results || []);
      const unitsList = Array.isArray(unitsData) ? unitsData : (unitsData.results || []);

      setTasks(transformTasks(tasksList));
      setNotifications(transformNotifications(notifsList));
      setUnits(unitsList);
      setUnreadCount(unreadData?.unread_count || 0);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const transformTasks = (apiTasks: any[]): Task[] => {
    return apiTasks.map(t => ({
      id: t.id.toString(),
      title: t.title,
      description: t.description || '',
      status: t.status,
      priority: t.priority,
      assigneeId: t.assigned_to?.toString() || '',
      creatorId: t.created_by?.toString() || '',
      unitId: t.org_unit?.toString() || '',
      deadline: t.deadline || '',
      createdAt: t.created_at,
      tags: t.tags || [],
      subtasks: (t.subtasks || []).map((st: any) => ({
        id: st.id.toString(),
        title: st.title,
        done: st.status === 'done',
      })),
      comments: (t.comments || []).map((c: any) => ({
        id: c.id.toString(),
        taskId: c.task.toString(),
        userId: c.user?.toString() || '',
        userFullName: c.user_full_name || '',
        userRank: c.user_rank || '',
        text: c.text,
        createdAt: c.created_at,
        attachments: (c.attachments || []).map((att: any) => ({
          id: att.id.toString(),
          url: att.file,
          name: att.filename,
          type: att.file?.split('.').pop(),
        })),
      })),
      attachments: (t.attachments || []).map((att: any): TaskFile => ({
        id: att.id.toString(),
        fileName: att.filename || att.fileName || 'Файл',
        fileUrl: att.file,
        uploadedBy: att.uploaded_by,
        uploadedByName: att.uploaded_by_name,
        createdAt: att.created_at,
      })),
      submission: t.submission ? {
        id: t.submission.id.toString(),
        status: t.submission.status,
        comment: t.submission.comment,
        submittedAt: t.submission.submitted_at,
        reviewedBy: t.submission.reviewed_by,
        reviewedAt: t.submission.reviewed_at,
        reviewComment: t.submission.review_comment,
        files: (t.submission.files || []).map((f: any): TaskFile => ({
          id: f.id.toString(),
          fileName: f.filename || f.fileName || 'Файл',
          fileUrl: f.file,
        })),
        reviewFiles: (t.submission.review_files || []).map((f: any): TaskFile => ({
          id: f.id.toString(),
          fileName: f.filename || f.fileName || 'Файл',
          fileUrl: f.file,
        })),
      } : undefined,
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

  const handleTasksGenerated = useCallback(async (newTasks: Task[]) => {
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
            avatarColor: '#2563eb',
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
            <Route path="/profile" element={<Profile />} />
            <Route path="/tasks" element={
              <TaskManagement 
                tasks={tasks} 
                onTasksChange={setTasks} 
                searchQuery={searchQuery} 
              />
            } />
            <Route path="/kanban" element={<Navigate to="/tasks" replace />} />
            <Route path="/statistics" element={<Navigate to="/tasks" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;