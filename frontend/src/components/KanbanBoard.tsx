import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar, Plus, X, AlertTriangle, Tag, MessageCircle, Send, Paperclip,
  Image, FileText, Download, Edit2, Trash2, CheckCircle, Upload, Paperclip as PaperclipIcon, 
  UserPlus, Users, RefreshCw, Save, Clock, Filter, Archive, ArrowLeft
} from 'lucide-react';
import type { Task, TaskStatus, Priority, User as UserType, TaskFile } from '@/types';
import { cn } from '@/utils/cn';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { parseSafeDate } from './AutoPlan';
import { useSearchParams } from 'react-router-dom';

const columns: { id: TaskStatus; label: string; color: string; bg: string }[] = [
  { id: 'todo', label: 'К выполнению', color: 'border-blue-400', bg: 'bg-blue-50' },
  { id: 'in_progress', label: 'В работе', color: 'border-amber-400', bg: 'bg-amber-50' },
  { id: 'review', label: 'На проверке', color: 'border-purple-400', bg: 'bg-purple-50' },
  { id: 'done', label: 'Выполнено', color: 'border-green-700', bg: 'bg-green-50' },
];

const priorityConfig: Record<Priority, { label: string; color: string; bg: string }> = {
  critical: { label: 'Критический', color: 'text-red-700', bg: 'bg-red-100' },
  high: { label: 'Высокий', color: 'text-orange-700', bg: 'bg-orange-100' },
  medium: { label: 'Средний', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  low: { label: 'Низкий', color: 'text-blue-700', bg: 'bg-blue-100' },
};

const normalizeTask = (backendTask: any): Task => {
  let parsedTags: string[] = [];
  if (Array.isArray(backendTask.tags)) {
    parsedTags = backendTask.tags;
  } else if (typeof backendTask.tags === 'string') {
    try {
      parsedTags = JSON.parse(backendTask.tags.replace(/'/g, '"'));
    } catch {
      parsedTags = backendTask.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    }
  }

  return {
    ...backendTask,
    id: backendTask.id?.toString(),
    title: backendTask.title || 'Без названия',
    description: backendTask.description || '',
    status: (backendTask.status || 'todo').toLowerCase() as TaskStatus,
    priority: (backendTask.priority || 'medium').toLowerCase() as Priority,
    assigneeId: backendTask.assigned_to?.toString() || backendTask.assigneeId || '',
    creatorId: backendTask.created_by?.toString() || backendTask.creatorId || '',
    unitId: backendTask.org_unit?.toString() || backendTask.unitId || '',
    tags: parsedTags,
    createdAt: backendTask.created_at || backendTask.createdAt || new Date().toISOString(),
    deadline: backendTask.deadline || '',
    start_date: backendTask.start_date || '',
    end_date: backendTask.end_date || '',
    subtasks: backendTask.subtasks || [],
    comments: backendTask.comments || [],
    attachments: backendTask.attachments || [],
    submission: backendTask.submission || null,
    is_archived: backendTask.is_archived === true || String(backendTask.is_archived).toLowerCase() === 'true',
    is_milestone: backendTask.is_milestone === true || String(backendTask.is_milestone).toLowerCase() === 'true',
  } as Task;
};

export function KanbanBoard({ tasks, onTasksChange, searchQuery }: any) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveSort, setArchiveSort] = useState<string>('date_desc');
  
  const [users, setUsers] = useState<UserType[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  const [filters, setFilters] = useState({ unit: 'all', onlyMyTasks: false, deadline: 'all' });
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [extraUsers, setExtraUsers] = useState<Record<string, any>>({});

  const onTasksChangeRef = useRef(onTasksChange);
  const draggedTaskRef = useRef(draggedTask);
  
  useEffect(() => { onTasksChangeRef.current = onTasksChange; }, [onTasksChange]);
  useEffect(() => { draggedTaskRef.current = draggedTask; }, [draggedTask]);

  useEffect(() => {
    api.getAllUsers().then((res: any) => {
      setUsers(Array.isArray(res) ? res : (res.results || []));
    }).catch(console.error);

    api.getAvailableUnits().then((res: any) => {
      setUnits(Array.isArray(res) ? res : (res.results || []));
    }).catch(console.error);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//localhost:8000/ws/tasks/`;
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWs = () => {
      ws = new WebSocket(wsUrl);
      ws.onmessage = async (event) => {
        if (draggedTaskRef.current) return; 
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'task_update') {
            const response: any = await api.getTasks();
            const rawTasks = Array.isArray(response) ? response : (response.results || []);
            const freshTasks = rawTasks.map(normalizeTask);
            onTasksChangeRef.current(freshTasks);
            setSelectedTask(prev => prev ? freshTasks.find((t: Task) => t.id === prev.id) || null : null);
          }
        } catch (e) {
          console.error('WebSocket Error:', e);
        }
      };
      ws.onclose = () => { reconnectTimeout = setTimeout(connectWs, 3000); };
      ws.onerror = () => { ws.close(); };
    };

    connectWs();
    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []); 

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    return tasks.filter((t: Task) => {
      const matchesSearch = searchQuery === '' ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.tags && t.tags.some(tag => String(tag).toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesUnit = filters.unit === 'all' || t.unitId === filters.unit;
      const matchesMy = !filters.onlyMyTasks || t.assigneeId === user?.id?.toString() || t.creatorId === user?.id?.toString();
      
      let matchesDeadline = true;
      if (filters.deadline !== 'all') {
        const taskDate = parseSafeDate(t.deadline);
        if (!taskDate) {
          matchesDeadline = false;
        } else {
          const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
          
          if (filters.deadline === 'overdue') {
            matchesDeadline = taskDate < now && t.status !== 'done';
          } else if (filters.deadline === 'today') {
            matchesDeadline = taskDay.getTime() === today.getTime() && t.status !== 'done';
          } else if (filters.deadline === 'week') {
            matchesDeadline = taskDay >= today && taskDay <= nextWeek && t.status !== 'done';
          }
        }
      }

      return matchesSearch && matchesUnit && matchesMy && matchesDeadline;
    });
  }, [tasks, searchQuery, filters, user?.id]);

  const activeFiltersCount = (filters.unit !== 'all' ? 1 : 0) + (filters.onlyMyTasks ? 1 : 0) + (filters.deadline !== 'all' ? 1 : 0);

  useEffect(() => {
    const idsToFetch = new Set<string>();
    filteredTasks.forEach((t: Task) => {
      if (t.assigneeId && !users.some(u => String(u.id) === t.assigneeId) && !extraUsers[t.assigneeId]) {
        idsToFetch.add(t.assigneeId);
      }
      if (t.creatorId && !users.some(u => String(u.id) === t.creatorId) && !extraUsers[t.creatorId]) {
        idsToFetch.add(t.creatorId);
      }
    });

    if (idsToFetch.size > 0) {
      idsToFetch.forEach(id => {
        setExtraUsers(prev => {
          if (prev[id]) return prev;
          api.getUser(Number(id))
            .then(userObj => setExtraUsers(current => ({ ...current, [id]: userObj })))
            .catch(() => setExtraUsers(current => ({ ...current, [id]: { _error: true } })));
          return { ...prev, [id]: { _fetching: true } };
        });
      });
    }
  }, [filteredTasks, users]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = tasks.find((t: Task) => t.id === taskId);
    if (!task || task.status === status) {
      setDraggedTask(null);
      return;
    }

    const isLeader = ['commander', 'deputy_commander', 'department_head', 'group_head'].includes(user?.role || '');
    const isCreator = task.creatorId === user?.id?.toString();

    if (!isLeader && !isCreator && (status === 'review' || status === 'done')) {
      alert('Вы не можете вручную перевести задачу на проверку или в "Выполнено". Откройте её и прикрепите отчет во вкладке "Выполнение".');
      setDraggedTask(null);
      return;
    }

    if (!task.assigneeId && (status === 'review' || status === 'done')) {
      alert('Нельзя отправить на проверку или завершить задачу, у которой нет исполнителя.');
      setDraggedTask(null);
      return;
    }

    const updatedTasks = tasks.map((t: Task) => t.id === taskId ? { ...t, status } : t);
    onTasksChange(updatedTasks);
    setDraggedTask(null);

    try {
      await api.moveTask(parseInt(taskId), status, 0);
    } catch (error) {
      onTasksChange(tasks); 
      alert('Ошибка при перемещении задачи.');
    }
  };

  const handleAddTask = async (task: Omit<Task, 'id' | 'createdAt'>, files: File[]) => {
    try {
      const taskData: any = {
        title: task.title,
        description: task.description || '',
        status: 'todo',
        priority: task.priority,
      };

      if (task.assigneeId) taskData.assigned_to = parseInt(task.assigneeId);
      if (task.unitId) taskData.org_unit = parseInt(task.unitId);
      else throw new Error('Не выбрано подразделение');
      
      if (task.deadline) taskData.deadline = task.deadline;
      if (task.tags && task.tags.length > 0) taskData.tags = task.tags;

      const createdTaskRaw = await api.createTask(taskData);

      if (files.length > 0) {
        for (const file of files) {
          await api.uploadTaskFile(parseInt(createdTaskRaw.id), file, 'attachment');
        }
      }

      const response: any = await api.getTasks();
      const rawTasks = Array.isArray(response) ? response : (response.results || []);
      const freshTasks = rawTasks.map(normalizeTask);
      
      onTasksChange(freshTasks);
      setShowAddModal(false);
    } catch (error: any) {
      console.error('Failed to create task:', error);
      alert(error.message || 'Ошибка при создании задачи.');
    }
  };

  const handleToggleArchive = async (taskId: string, archive: boolean) => {
    try {
      await api.updateTask(parseInt(taskId), { is_archived: archive });
      const updatedTasks = tasks.map((t: Task) => t.id === taskId ? { ...t, is_archived: archive } : t);
      onTasksChange(updatedTasks);
      setSelectedTask(null);
    } catch (error) {
      alert('Ошибка при изменении статуса архива');
    }
  };

  if (showArchive) {
    let archiveList = tasks.filter((t: Task) => t.is_archived);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      archiveList = archiveList.filter((t: Task) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.tags && t.tags.some(tag => String(tag).toLowerCase().includes(q)))
      );
    }

    archiveList.sort((a: Task, b: Task) => {
      if (archiveSort === 'date_desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (archiveSort === 'date_asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (archiveSort === 'deadline_asc') {
        const d1 = parseSafeDate(a.deadline)?.getTime() || Infinity;
        const d2 = parseSafeDate(b.deadline)?.getTime() || Infinity;
        return d1 - d2;
      } else if (archiveSort === 'deadline_desc') {
        const d1 = parseSafeDate(a.deadline)?.getTime() || 0;
        const d2 = parseSafeDate(b.deadline)?.getTime() || 0;
        return d2 - d1;
      } else if (archiveSort === 'title_asc') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return (
      <div className="space-y-4 relative bg-white border border-slate-200 rounded-md shadow-sm p-6 min-h-[600px]">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowArchive(false)}
              className="p-1.5 border border-slate-200 text-slate-500 rounded hover:bg-slate-50"
              title="Вернуться к доске"
            >
              <ArrowLeft size={16} />
            </button>
            <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Archive size={18} className="text-slate-500" />
              Архив задач
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={archiveSort}
              onChange={e => setArchiveSort(e.target.value)}
              className="text-xs font-bold uppercase tracking-wider border border-slate-200 rounded px-3 py-2 bg-slate-50 text-slate-600 focus:outline-none focus:border-green-600 cursor-pointer"
            >
              <option value="date_desc">По созданию (Новые)</option>
              <option value="date_asc">По созданию (Старые)</option>
              <option value="deadline_asc">По срокам (Ближайшие)</option>
              <option value="deadline_desc">По срокам (Поздние)</option>
              <option value="title_asc">По алфавиту (А-Я)</option>
            </select>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Всего: {archiveList.length}
            </span>
          </div>
        </div>

        {archiveList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">ID</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Задача</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Сроки</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Подразделение</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Создана</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {archiveList.map((task: Task) => {
                  const unit = units.find((u: any) => String(u.id) === String(task.unitId));
                  const parsedDeadline = parseSafeDate(task.deadline);
                  return (
                    <tr key={task.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono">#{task.id}</td>
                      <td className="py-3 px-4">
                        <button 
                          onClick={() => setSelectedTask(task)}
                          className="font-bold text-slate-700 hover:text-green-600 text-left"
                        >
                          {task.title}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-600">
                        {parsedDeadline ? parsedDeadline.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-600">{unit?.name || '—'}</td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-600">
                        {new Date(task.createdAt).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button 
                          onClick={() => handleToggleArchive(task.id, false)}
                          className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border border-slate-300 text-slate-600 rounded hover:bg-slate-100"
                        >
                          Вернуть
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Archive size={48} className="text-slate-300 mb-4" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Архив пуст</h3>
            <p className="text-xs font-medium text-slate-400 mt-2">Не найдено задач, соответствующих фильтрам.</p>
          </div>
        )}

        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            users={users}
            units={units}
            currentUser={user}
            onClose={() => setSelectedTask(null)}
            onUpdate={(updated) => {
              onTasksChange(tasks.map((t: Task) => t.id === updated.id ? updated : t));
              setSelectedTask(updated);
            }}
            onDelete={async (id) => {
              try {
                await api.deleteTask(parseInt(id));
                onTasksChange(tasks.filter((t: Task) => t.id !== id));
                setSelectedTask(null);
              } catch (error) {
                alert('Ошибка при удалении задачи');
              }
            }}
            onToggleArchive={handleToggleArchive}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Активных задач: {filteredTasks.filter((t: Task) => !t.is_archived && !t.is_milestone && !(t.tags || []).some(tag => String(tag).toLowerCase() === 'мероприятие')).length}
        </span>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowArchive(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 rounded-md shadow-sm"
          >
            <Archive size={14} />
            Архив
          </button>

          <div className="relative">
            <button 
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)} 
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded-md shadow-sm",
                activeFiltersCount > 0 
                  ? "bg-green-50 border-green-200 text-green-700" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Filter size={14} />
              Фильтры
              {activeFiltersCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 bg-green-600 text-white text-[9px] rounded-full ml-1">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {isFilterPanelOpen && (
              <div className="absolute right-0 top-full mt-2 w-[300px] bg-white rounded-md shadow-xl border border-slate-200 p-5 z-50">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Параметры</h3>
                  {activeFiltersCount > 0 && (
                    <button 
                      onClick={() => setFilters({ unit: 'all', onlyMyTasks: false, deadline: 'all' })}
                      className="text-[10px] font-bold uppercase text-red-500 hover:text-red-700"
                    >
                      Сбросить
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Подразделение</label>
                    <select
                      value={filters.unit}
                      onChange={e => setFilters({ ...filters, unit: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded px-3 py-2 bg-slate-50 hover:bg-white focus:outline-none focus:border-green-500"
                    >
                      <option value="all">Все подразделения</option>
                      {units.map((u: any) => (
                        <option key={u.id} value={u.id.toString()}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Сроки</label>
                    <select
                      value={filters.deadline}
                      onChange={e => setFilters({ ...filters, deadline: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded px-3 py-2 bg-slate-50 hover:bg-white focus:outline-none focus:border-green-500"
                    >
                      <option value="all">Всё время</option>
                      <option value="overdue">⚠️ Просроченные</option>
                      <option value="today">🔥 Сегодня</option>
                      <option value="week">📅 На этой неделе</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer p-2 -ml-2 hover:bg-slate-50 rounded">
                    <input 
                      type="checkbox" 
                      checked={filters.onlyMyTasks}
                      onChange={e => setFilters({ ...filters, onlyMyTasks: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-600"
                    />
                    <span className="text-xs font-bold uppercase text-slate-600">Мои задачи</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={() => setShowAddModal(true)} 
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-md hover:bg-green-700 shadow-sm"
          >
            <Plus size={14} /> Новая задача
          </button>
        </div>
      </div>

      {isFilterPanelOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsFilterPanelOpen(false)}></div>
      )}

      {/* ДОСКА С 4 КОЛОНКАМИ */}
      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {columns.map(col => {
          const colTasks = filteredTasks.filter((t: Task) => {
            // ЛОГИКА ФИЛЬТРАЦИИ 1: Полностью скрываем Мероприятия с доски (ориентируемся на тег)
            const isEvent = t.is_milestone || (t.tags || []).some(tag => String(tag).toLowerCase() === 'мероприятие');
            if (isEvent || t.is_archived) return false;
            
            const tStatus = (t.status || 'todo').toLowerCase();
            
            // ЛОГИКА ФИЛЬТРАЦИИ 2: Для колонки "К выполнению" скрываем далекие задачи
            if (col.id === 'todo') {
              const parsedD = parseSafeDate(t.deadline || t.start_date || t.createdAt);
              if (parsedD) {
                 const today = new Date();
                 today.setHours(12, 0, 0, 0);
                 const taskDate = new Date(parsedD);
                 taskDate.setHours(12, 0, 0, 0);
                 
                 const diffDays = Math.ceil((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                 if (diffDays > 2) {
                     return false; // Скрываем, если до дедлайна больше 2 дней
                 }
              }
              return ['todo', 'new', 'pending', 'planned'].includes(tStatus);
            }
            
            return tStatus === col.id;
          });

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className="flex-1 min-w-[320px] max-w-[400px] bg-slate-100/80 rounded-md border border-slate-200 flex flex-col max-h-[80vh]"
            >
              <div className={cn('px-4 py-3 border-b border-slate-200 bg-white rounded-t-md', col.color, 'border-t-4')}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">{col.label}</h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {colTasks.length}
                  </span>
                </div>
              </div>

              <div className="p-2 flex-1 overflow-y-auto space-y-2">
                {colTasks.map((task: Task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    users={users}
                    extraUsers={extraUsers}
                    units={units}
                    onDragStart={(e: any) => handleDragStart(e, task.id)}
                    onClick={() => setSelectedTask(task)}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div className="p-4 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-md">
                    Нет задач
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <AddTaskModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddTask}
          users={users}
          units={units}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          users={users}
          units={units}
          currentUser={user}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updated) => {
            onTasksChange(tasks.map((t: Task) => t.id === updated.id ? updated : t));
            setSelectedTask(updated);
          }}
          onDelete={async (id) => {
            try {
              await api.deleteTask(parseInt(id));
              onTasksChange(tasks.filter((t: Task) => t.id !== id));
              setSelectedTask(null);
            } catch (error: any) {
              if (error.message?.includes('No Task matches')) {
                onTasksChange(tasks.filter((t: Task) => t.id !== id));
                setSelectedTask(null);
              } else {
                alert('Ошибка при удалении задачи');
              }
            }
          }}
          onToggleArchive={handleToggleArchive}
        />
      )}
    </div>
  );
}

function TaskCard({ task, users, extraUsers, units, onDragStart, onClick }: any) {
  const getSafeName = (id: string, fallback: any) => {
    if (!id) return 'Не назначен';
    const user = users.find((u: any) => String(u.id) === id) || extraUsers[id];
    if (user && !user._fetching && !user._error) {
      return user.fullName || user.full_name || `${user.last_name || ''} ${user.first_name || ''}`.trim() || 'Сотрудник';
    }
    if (fallback && fallback.full_name) return fallback.full_name;
    return user?._fetching ? 'Загрузка...' : `ID ${id}`;
  };

  const assigneeName = getSafeName(task.assigneeId, task.assignee);
  const creatorName = getSafeName(task.creatorId, task.creator);
  const unit = units.find((u: any) => String(u.id) === String(task.unitId));

  const parsedDeadline = parseSafeDate(task.deadline);
  const isOverdue = parsedDeadline && parsedDeadline < new Date() && task.status !== 'done';
  
  const pConfig = priorityConfig[task.priority as Priority] || priorityConfig['medium'];
  const isUnassigned = !task.assigneeId;

  const subtasksTotal = task.subtasks?.length || 0;
  const subtasksDone = task.subtasks?.filter((s: any) => s.done).length || 0;
  const subtasksProgress = subtasksTotal > 0 ? (subtasksDone / subtasksTotal) * 100 : 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "bg-white rounded-md border p-3 cursor-grab active:cursor-grabbing hover:border-slate-300 shadow-sm",
        isUnassigned ? "border-dashed border-slate-300 bg-slate-50" : "border-slate-200"
      )}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded truncate max-w-[70%]">
          {unit?.name || 'Подразделение'}
        </span>
        <span className="text-[10px] font-mono text-slate-400 shrink-0">#{task.id}</span>
      </div>

      <h4 className="text-sm font-bold text-slate-800 leading-snug mb-1">{task.title}</h4>
      
      {task.description && (
        <p className="text-[11px] text-slate-500 line-clamp-2 mb-3 leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="bg-slate-50 border border-slate-100 rounded p-2 mb-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Постановщик</div>
          <div className="text-xs font-medium text-slate-700 truncate" title={creatorName}>{creatorName}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Исполнитель</div>
          <div className={cn("text-xs font-medium truncate", isUnassigned ? "text-amber-600" : "text-slate-700")} title={assigneeName}>
            {isUnassigned ? 'Свободная задача' : assigneeName}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', pConfig.bg, pConfig.color)}>
            {pConfig.label}
          </span>
          {task.tags?.slice(0, 2).map((tag: string) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">{tag}</span>
          ))}
        </div>

        {subtasksTotal > 0 && (
          <div className="pt-1">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-bold">
              <span>Подзадачи</span>
              <span>{subtasksDone} / {subtasksTotal}</span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded overflow-hidden">
              <div className="h-full bg-green-600 rounded" style={{ width: `${subtasksProgress}%` }} />
            </div>
          </div>
        )}

        {task.submission && (
          <div className={cn(
            'text-[10px] px-2 py-1 rounded border font-bold flex items-center gap-1.5 mt-1', 
            task.submission.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : 
            task.submission.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 
            'bg-yellow-50 text-yellow-700 border-yellow-200'
          )}>
            {task.submission.status === 'approved' ? <CheckCircle size={12}/> : task.submission.status === 'rejected' ? <X size={12}/> : <Clock size={12}/>}
            {task.submission.status === 'approved' ? 'Отчет принят' : task.submission.status === 'rejected' ? 'Возвращено на доработку' : 'Отчет на проверке'}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
        <div className={cn("flex items-center gap-1.5 text-[11px] font-bold", isOverdue ? "text-red-600" : "text-slate-600")}>
          <Calendar size={12} />
          {parsedDeadline ? parsedDeadline.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Без срока'}
        </div>

        <div className="flex items-center gap-2.5 text-slate-400">
          {task.comments?.length > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-bold"><MessageCircle size={12} />{task.comments.length}</span>
          )}
          {task.attachments?.length > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-bold"><PaperclipIcon size={12} />{task.attachments.length}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskDetailModal({ task, users, units, currentUser, onClose, onUpdate, onDelete, onToggleArchive }: {
  task: Task;
  users: UserType[];
  units: any[];
  currentUser: any;
  onClose: () => void;
  onUpdate: (t: Task) => void;
  onDelete: (id: string) => void;
  onToggleArchive: (id: string, archive: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'submission' | 'attachments'>('details');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editData, setEditData] = useState({
    title: task.title,
    description: task.description,
    priority: task.priority,
    deadline: task.deadline ? (parseSafeDate(task.deadline)?.toISOString().slice(0, 16) || '') : ''
  });

  const assignee = users.find(u => u.id.toString() === task.assigneeId);
  const creator = users.find(u => u.id.toString() === task.creatorId);
  const unit = units.find(u => u.id.toString() === task.unitId);
  const pConfig = priorityConfig[task.priority] || priorityConfig['medium'];

  const isLeader = ['commander', 'deputy_commander', 'department_head', 'group_head'].includes(currentUser?.role || '');
  const isCreator = currentUser?.id?.toString() === task.creatorId?.toString();
  const isAssignee = currentUser?.id?.toString() === task.assigneeId?.toString();
  const isMemberOfTaskUnit = currentUser?.org_unit?.toString() === task.unitId?.toString();
  const isUnassigned = !task.assigneeId;
  const canClaim = isUnassigned && isMemberOfTaskUnit;
  const unitUsers = users.filter(u => u.org_unit?.toString() === task.unitId?.toString());

  const allowedStatuses = columns.filter(col => {
    if (!task.assigneeId && ['review', 'done'].includes(col.id)) return false;
    if (isLeader || isCreator) return true;
    if (isAssignee) {
      return ['todo', 'in_progress'].includes(col.id); 
    }
    return false;
  });

  const handleClaimOrAssign = async (userId: string) => {
    setIsAssigning(true);
    try {
      await api.updateTask(parseInt(task.id), { 
        assigned_to: userId ? parseInt(userId) : null,
        status: 'in_progress' 
      });
    } catch (e) {
      console.error(e);
      alert('Ошибка при назначении задачи');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSaveEditTask = async () => {
    try {
      await api.updateTask(parseInt(task.id), {
        title: editData.title,
        description: editData.description,
        priority: editData.priority,
        deadline: editData.deadline
      });
      setIsEditingTask(false);
    } catch (error) {
      alert('Ошибка при сохранении задачи');
    }
  };

  const getAssigneeFullName = (user: any) => {
    return user.fullName || user.full_name || `${user.last_name || ''} ${user.first_name || ''}`.trim() || 'Сотрудник';
  };

  const getAssigneeInitials = (user: any) => {
    const fullName = getAssigneeFullName(user);
    return fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderFileList = (files: TaskFile[]) => {
    if (!files || files.length === 0) return <p className="text-sm text-slate-500">Нет вложений</p>;
    return (
      <div className="space-y-2">
        {files.map(file => {
          const fileName = file.fileName || file.filename || 'Файл';
          const fileUrl = file.fileUrl || file.file;
          return (
            <div key={file.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-md">
              {fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
                <Image size={16} className="text-slate-400" />
              ) : (
                <FileText size={16} className="text-slate-400" />
              )}
              <span className="text-sm text-slate-600 flex-1 truncate">{fileName}</span>
              {fileUrl && (
                <a href={fileUrl} download={fileName} className="p-1 hover:bg-slate-200 rounded" target="_blank" rel="noopener noreferrer">
                  <Download size={14} className="text-slate-500" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const parsedModalDeadline = parseSafeDate(task.deadline);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-md w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 pb-2 border-b border-slate-200">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded', pConfig.bg, pConfig.color)}>
                  {pConfig.label}
                </span>
                {task.is_archived && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600 flex items-center gap-1">
                    <Archive size={12} /> Архив
                  </span>
                )}
                <span className="text-xs text-slate-400 font-mono">#{String(task.id || '').slice(0, 6)}</span>
              </div>
              
              {isEditingTask ? (
                <input 
                  value={editData.title}
                  onChange={e => setEditData({...editData, title: e.target.value})}
                  className="w-full text-lg font-bold border-b-2 border-green-600 bg-slate-50 px-2 py-1 outline-none mb-2"
                />
              ) : (
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  {task.title}
                  {(isCreator || isLeader) && (
                    <button 
                      onClick={() => setIsEditingTask(true)} 
                      className="text-slate-300 hover:text-green-600"
                      title="Редактировать"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                </h2>
              )}
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          <div className="flex gap-4 mt-4 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('details')}
              className={cn(
                'pb-2 text-xs uppercase tracking-wider font-bold relative whitespace-nowrap',
                activeTab === 'details' ? 'text-green-700 border-b-2 border-green-700' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              Детали
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={cn(
                'pb-2 text-xs uppercase tracking-wider font-bold relative flex items-center gap-1 whitespace-nowrap',
                activeTab === 'comments' ? 'text-green-700 border-b-2 border-green-700' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              Обсуждение
              {task.comments && task.comments.length > 0 && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded ml-1">
                  {task.comments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('attachments')}
              className={cn(
                'pb-2 text-xs uppercase tracking-wider font-bold relative flex items-center gap-1 whitespace-nowrap',
                activeTab === 'attachments' ? 'text-green-700 border-b-2 border-green-700' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <PaperclipIcon size={14} />
              Вложения
              {task.attachments && task.attachments.length > 0 && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded ml-1">
                  {task.attachments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('submission')}
              className={cn(
                'pb-2 text-xs uppercase tracking-wider font-bold relative flex items-center gap-1 whitespace-nowrap',
                activeTab === 'submission' ? 'text-green-700 border-b-2 border-green-700' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <CheckCircle size={14} />
              Выполнение
              {task.submission && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded ml-1',
                  task.submission.status === 'approved' ? 'bg-green-100 text-green-700' :
                  task.submission.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                )}>
                  {task.submission.status === 'approved' ? '✓' :
                   task.submission.status === 'rejected' ? '✗' : '?'}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="space-y-4">
              
              {isEditingTask ? (
                <div className="space-y-4 mb-6 bg-slate-50 p-4 rounded-md border border-slate-200">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Описание</label>
                    <textarea 
                      value={editData.description}
                      onChange={e => setEditData({...editData, description: e.target.value})}
                      className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 outline-none focus:border-green-600"
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Приоритет</label>
                      <select 
                        value={editData.priority}
                        onChange={e => setEditData({...editData, priority: e.target.value as Priority})}
                        className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 outline-none focus:border-green-600"
                      >
                        <option value="critical">Критический</option>
                        <option value="high">Высокий</option>
                        <option value="medium">Средний</option>
                        <option value="low">Низкий</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Дедлайн</label>
                      <input 
                        type="datetime-local"
                        value={editData.deadline}
                        onChange={e => setEditData({...editData, deadline: e.target.value})}
                        className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 outline-none focus:border-green-600"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSaveEditTask} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-md text-xs font-bold uppercase tracking-wider hover:bg-green-700">
                      <Save size={14} /> Сохранить
                    </button>
                    <button onClick={() => setIsEditingTask(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-slate-50">
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600 mb-6">{task.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Исполнитель</div>
                  
                  {isLeader ? (
                    <div className="space-y-2">
                      <select 
                        disabled={isAssigning}
                        value={task.assigneeId || ''}
                        onChange={(e) => handleClaimOrAssign(e.target.value)} 
                        className="text-sm border border-slate-200 rounded-md px-2 py-1.5 outline-none w-full bg-slate-50 hover:bg-white focus:border-green-600"
                      >
                        <option value="">Не назначен (Свободная)</option>
                        {unitUsers.map(u => (
                          <option key={u.id} value={u.id.toString()}>
                            {u.rank} {getAssigneeFullName(u)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {assignee ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded bg-green-600 flex items-center justify-center text-white text-xs font-bold">
                            {getAssigneeInitials(assignee)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-700">{getAssigneeFullName(assignee)}</div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{assignee.rank}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-sm text-slate-500 flex items-center gap-2 bg-white p-2 rounded-md border border-dashed border-slate-300">
                            <AlertTriangle size={16} className="text-amber-500" />
                            Свободная задача
                          </div>
                          {canClaim && (
                             <button 
                               disabled={isAssigning}
                               onClick={() => handleClaimOrAssign(currentUser.id.toString())}
                               className="w-full text-xs uppercase tracking-wider bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-bold flex items-center justify-center gap-2"
                             >
                               <UserPlus size={14} /> Взять в работу
                             </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Постановщик</div>
                  <div className="flex items-center gap-2">
                    {creator ? (
                      <>
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ backgroundColor: `hsl(${parseInt(creator.id.toString()) * 100 % 360}, 40%, 40%)` }}
                        >
                          {getAssigneeInitials(creator)}
                        </div>
                        <span className="text-sm font-medium text-slate-700">{creator.rank} {getAssigneeFullName(creator)}</span>
                      </>
                    ) : <span className="text-sm font-medium text-slate-500">Система</span>}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Подразделение</div>
                  <span className="text-sm text-slate-700 font-medium flex items-center gap-1.5">
                    <Users size={14} className="text-slate-400" />
                    {unit?.name || '—'}
                  </span>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Дедлайн</div>
                  <span className={cn(
                    "text-sm font-bold flex items-center gap-1.5",
                    parsedModalDeadline && parsedModalDeadline < new Date() && task.status !== 'done' ? "text-red-600" : "text-slate-700"
                  )}>
                    <Calendar size={12} />
                    {parsedModalDeadline ? parsedModalDeadline.toLocaleString('ru-RU', {
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : 'Без срока'}
                  </span>
                </div>
              </div>

              {task.tags.length > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Метки</div>
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {task.subtasks && task.subtasks.length > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Подзадачи</div>
                  <div className="space-y-1.5">
                    {task.subtasks.map(st => (
                      <label key={st.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={st.done}
                          onChange={async () => {}}
                          className="rounded border-slate-300 text-green-600 focus:ring-green-600"
                        />
                        <span className={cn('text-sm font-medium', st.done ? 'line-through text-slate-400' : 'text-slate-700')}>{st.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {allowedStatuses.length > 0 && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Изменить статус вручную</div>
                  <div className="flex flex-wrap gap-1.5">
                    {allowedStatuses.map(col => (
                      <button
                        key={col.id}
                        onClick={async () => {
                          await api.moveTask(parseInt(task.id), col.id, 0);
                        }}
                        className={cn(
                          'text-xs uppercase tracking-wider font-bold px-3 py-1.5 rounded-md border',
                          (task.status === col.id || (task.status === 'planned' && col.id === 'todo'))
                            ? 'border-green-600 bg-green-50 text-green-800'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        )}
                      >
                        {col.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <TaskComments
              taskId={task.id}
              comments={task.comments || []}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'attachments' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Вложения задачи</h3>
              {renderFileList(task.attachments || [])}
            </div>
          )}

          {activeTab === 'submission' && (
            <TaskSubmission
              task={task}
            />
          )}
        </div>

        <div className="p-6 pt-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Создано: {new Date(task.createdAt).toLocaleDateString('ru-RU')}
            </div>

            {(isLeader || isCreator) && (
              <>
                <div className="w-px h-4 bg-slate-300"></div>
                {task.is_archived ? (
                  <button 
                    onClick={() => onToggleArchive(task.id, false)}
                    className="text-[10px] font-bold uppercase tracking-wider text-green-600 hover:text-green-800 flex items-center gap-1"
                  >
                    <RefreshCw size={12} /> Вернуть из архива
                  </button>
                ) : (
                  task.status === 'done' && (
                    <button 
                      onClick={() => onToggleArchive(task.id, true)}
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 flex items-center gap-1"
                    >
                      <Archive size={12} /> Убрать в архив
                    </button>
                  )
                )}
              </>
            )}
          </div>

          <div>
            {showConfirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Удалить задачу?</span>
                <button
                  onClick={() => onDelete(task.id)}
                  className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Да
                </button>
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  className="text-xs font-bold uppercase tracking-wider px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 bg-white"
                >
                  Нет
                </button>
              </div>
            ) : (
              isLeader && (
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-600 flex items-center gap-1"
                >
                  <Trash2 size={12} /> Удалить
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskComments({ taskId, comments, currentUser }: {
  taskId: string;
  comments: any[];
  currentUser: any;
}) {
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSendComment = async () => {
    if (!newComment.trim() && attachments.length === 0) return;
    setIsSending(true);

    try {
      const createdComment = await api.addComment(taskId, newComment);

      for (const file of attachments) {
        await api.uploadCommentFile(taskId, createdComment.id, file);
      }

      setNewComment('');
      setAttachments([]);
      setShowAttachmentMenu(false);
    } catch (error) {
      alert('Не удалось отправить комментарий');
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await api.deleteTaskComment(parseInt(commentId));
    } catch (error) {
      alert('Ошибка при удалении комментария');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
    setShowAttachmentMenu(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  const startEditing = (comment: any) => {
    setEditingCommentId(comment.id);
    setEditText(comment.text);
  };

  const saveEdit = async () => {
    if (editingCommentId && editText.trim()) {
      try {
        await api.updateTaskComment(parseInt(editingCommentId), editText);
        setEditingCommentId(null);
        setEditText('');
      } catch (error) {
        alert('Ошибка сохранения');
      }
    }
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditText('');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  const renderFileList = (files: { id: string; url: string; fileUrl?: string; file?: string; name?: string; filename?: string; type?: string }[]) => {
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {files.map((att) => {
          const fileUrl = att.url || att.fileUrl || att.file || '';
          const fileName = att.name || att.filename || 'Файл';
          return (
            <div key={att.id} className="flex items-center gap-1 bg-slate-50 rounded-md px-2 py-1 border border-slate-200">
              {fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <Image size={12} className="text-slate-400" />
              ) : (
                <FileText size={12} className="text-slate-400" />
              )}
              <span className="text-xs text-slate-600 max-w-[100px] truncate">{fileName}</span>
              <a href={fileUrl} download={fileName} className="ml-1 p-0.5 hover:bg-slate-200 rounded" target="_blank" rel="noopener noreferrer">
                <Download size={10} className="text-slate-500" />
              </a>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {comments.map((comment: any) => {
          const fullName = comment.userFullName || comment.user_full_name || 'Неизвестно';
          const rank = comment.userRank || comment.user_rank || '';
          const date = comment.createdAt || comment.created_at;
          const authorId = comment.userId?.toString() || comment.user?.toString();
          const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

          return (
            <div key={comment.id} className="group relative">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                    {initials}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-800">
                      {rank} {fullName}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {formatDate(date)}
                    </span>
                  </div>

                  {editingCommentId === comment.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-600"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700">Сохранить</button>
                        <button onClick={cancelEdit} className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 border border-slate-200 rounded hover:bg-slate-50">Отмена</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.text}</p>
                      {comment.attachments && comment.attachments.length > 0 && renderFileList(comment.attachments)}
                    </>
                  )}
                </div>

                {authorId === currentUser?.id?.toString() && !editingCommentId && (
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                    <button onClick={() => startEditing(comment)} className="p-1 text-slate-400 hover:text-green-600 rounded">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => handleDelete(comment.id)} className="p-1 text-slate-400 hover:text-red-600 rounded">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={commentsEndRef} />
      </div>

      <div className="relative">
        {attachments.length > 0 && (
          <div className="mb-3 p-3 bg-slate-50 rounded-md border border-slate-200">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-2">
              <Paperclip size={12} />
              Прикреплённые файлы:
            </div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center gap-1 bg-white rounded-md px-2 py-1 border border-slate-200">
                  {file.type.startsWith('image/') ? <Image size={12} className="text-slate-400" /> : <FileText size={12} className="text-slate-400" />}
                  <span className="text-xs text-slate-600 max-w-[150px] truncate">{file.name}</span>
                  <button onClick={() => removeAttachment(index)} className="ml-1 p-0.5 hover:bg-slate-100 rounded">
                    <X size={10} className="text-slate-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Напишите комментарий..."
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-600 resize-none min-h-[80px]"
          />

          <div className="flex flex-col gap-1">
            <div className="relative">
              <button onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} className="p-2 text-slate-400 hover:text-green-600 hover:bg-slate-50 rounded-md">
                <Paperclip size={18} />
              </button>

              {showAttachmentMenu && (
                <div className="absolute bottom-full right-0 mb-1 bg-white rounded-md shadow-lg border border-slate-200 py-1 min-w-[150px] z-10">
                  <button onClick={() => fileInputRef.current?.click()} className="w-full px-3 py-2 text-xs font-bold uppercase tracking-wider text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                    <FileText size={14} /> Документ
                  </button>
                  <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'image/*'; fileInputRef.current.click(); } }} className="w-full px-3 py-2 text-xs font-bold uppercase tracking-wider text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                    <Image size={14} /> Изображение
                  </button>
                </div>
              )}
            </div>

            <button onClick={handleSendComment} disabled={isSending || (!newComment.trim() && attachments.length === 0)} className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
              <Send size={18} />
            </button>
          </div>
        </div>

        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
      </div>

      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Enter для отправки • Shift+Enter для новой строки
      </div>
    </div>
  );
}

function TaskSubmission({ task }: { task: Task }) {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAssignee = user?.id?.toString() === task.assigneeId?.toString();
  const isCreator = user?.id?.toString() === task.creatorId?.toString();
  const isCommander = ['commander', 'deputy_commander', 'department_head', 'group_head'].includes(user?.role || '');
  
  const canSubmit = isAssignee && (task.status === 'in_progress' || task.status === 'todo');
  const canReview = (isCreator || isCommander) && task.status === 'review';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.submitTask(parseInt(task.id), comment);
      for (const file of files) {
        await api.uploadTaskFile(parseInt(task.id), file, 'submission');
      }
      setFiles([]);
      setComment('');
    } catch (error) {
      alert('Ошибка при отправке отчета');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    setSubmitting(true);
    try {
      await api.updateTask(parseInt(task.id), { status: 'in_progress' });
    } catch (error) {
      alert('Не удалось отозвать задание.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewAction = async (approve: boolean) => {
    if (!canReview) return;
    setSubmitting(true);
    try {
      if (approve) {
        await api.approveTask(parseInt(task.id), reviewComment);
      } else {
        await api.rejectTask(parseInt(task.id), reviewComment);
      }

      for (const file of reviewFiles) {
        await api.uploadTaskFile(parseInt(task.id), file, 'submission');
      }

      setReviewComment('');
      setReviewFiles([]);
    } catch (error) {
      alert('Ошибка при сохранении решения');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <CheckCircle size={18} className="text-slate-600" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Результаты работы</h3>
      </div>

      {task.submission && (
        <div className={cn(
          'p-4 rounded-md border-l-4',
          task.submission.status === 'approved' ? 'bg-green-50 border-green-500' :
          task.submission.status === 'rejected' ? 'bg-red-50 border-red-500' :
          'bg-amber-50 border-amber-500'
        )}>
          <div className="flex items-center justify-between mb-3">
             <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Текущий статус отчета</span>
             <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-white border border-slate-200 shadow-sm">
               {task.submission.status === 'approved' ? '✅ Принят' :
                task.submission.status === 'rejected' ? '❌ Возвращен' : '⏳ Ожидает проверки'}
             </span>
          </div>

          <p className="text-sm font-medium text-slate-700 bg-white/70 p-3 rounded-md mb-3 border border-white">
            {task.submission.comment || 'Без комментария'}
          </p>

          {task.submission.files && task.submission.files.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {task.submission.files.map((f: any) => (
                <a key={f.id} href={f.file || f.fileUrl} target="_blank" className="flex items-center gap-2 p-2 bg-white rounded-md border border-slate-200 hover:border-slate-400">
                  <FileText size={14} className="text-slate-500" />
                  <span className="text-xs font-bold uppercase tracking-wider truncate flex-1">{f.filename || f.fileName || 'Документ'}</span>
                  <Download size={12} className="text-slate-400" />
                </a>
              ))}
            </div>
          )}

          {task.submission.reviewComment && (
            <div className="mt-3 p-3 bg-white border border-slate-200 rounded-md text-sm shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1">Вердикт проверяющего:</span>
              <p className="text-slate-600 font-medium">{task.submission.reviewComment}</p>
            </div>
          )}
          
          {isAssignee && task.status === 'review' && (
             <div className="mt-4 pt-4 border-t border-amber-200">
               <button onClick={handleWithdraw} disabled={submitting} className="w-full py-2 bg-white border border-amber-300 text-amber-700 rounded-md hover:bg-amber-100 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                 <RefreshCw size={14} /> Отозвать с проверки
               </button>
             </div>
          )}
        </div>
      )}

      {canSubmit && (
        <div className="bg-slate-50 p-5 rounded-md border border-slate-200">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Прикрепить документы</label>
          <div className="flex gap-2 mb-4">
             <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md hover:bg-slate-100 text-xs font-bold uppercase tracking-wider">
               <Upload size={14} /> Выбрать файлы
             </button>
             <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
          </div>

          {files.length > 0 && (
            <div className="mb-4 space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-white rounded-md text-xs font-bold uppercase tracking-wider border border-slate-200">
                  <span className="truncate pr-4">{f.name}</span>
                  <button onClick={() => removeFile(i)} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Напишите краткий комментарий к выполненной работе..."
            className="w-full p-3 text-sm border border-slate-200 rounded-md focus:border-green-500 outline-none h-24 mb-4"
          />

          <button onClick={handleSubmit} disabled={submitting || (files.length === 0 && !comment.trim())} className="w-full py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
            {submitting ? 'Отправка...' : <><Send size={14} /> Сдать задание</>}
          </button>
        </div>
      )}

      {canReview && (
        <div className="bg-slate-50 p-5 rounded-md border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 text-center">Проверка выполнения</label>
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Ваш вердикт или замечания для доработки..."
            className="w-full p-3 text-sm border border-slate-300 rounded-md focus:border-green-600 outline-none h-24 mb-4"
          />
          <div className="flex gap-3">
            <button onClick={() => handleReviewAction(true)} disabled={submitting} className="flex-1 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
              <CheckCircle size={14} /> Принять
            </button>
            <button onClick={() => handleReviewAction(false)} disabled={submitting || !reviewComment.trim()} className="flex-1 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50" title="Для возврата нужен комментарий">
              <X size={14} /> Доработка
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddTaskModal({ onClose, onAdd, users, units }: {
  onClose: () => void;
  onAdd: (task: Omit<Task, 'id' | 'createdAt'>, files: File[]) => Promise<void>;
  users: UserType[];
  units: any[];
}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const defaultDeadline = `${year}-${month}-${day}T${hours}:${minutes}`;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [tagsInput, setTagsInput] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const filteredUsers = selectedUnitId
    ? users.filter(u => u.org_unit?.toString() === selectedUnitId)
    : [];

  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId);
    setSelectedUserId('');
  };

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    const user = users.find(u => u.id.toString() === userId);
    if (user?.org_unit) {
      setSelectedUnitId(user.org_unit.toString());
    }
  };

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachmentFiles(prev => [...prev, ...files]);
  };

  const removeAttachmentFile = (index: number) => {
    setAttachmentFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedUnitId) return;

    setSubmitting(true);
    try {
      await onAdd({
        title,
        description,
        priority,
        status: 'todo',
        assigneeId: selectedUserId,
        creatorId: '',
        unitId: selectedUnitId,
        deadline,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        subtasks: [],
      }, attachmentFiles);
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Новая задача</h2>
            <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Название *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-500"
                placeholder="Введите название задачи"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Описание</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-500 resize-none"
                placeholder="Описание задачи"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Приоритет</label>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-500">
                <option value="critical">Критический</option>
                <option value="high">Высокий</option>
                <option value="medium">Средний</option>
                <option value="low">Низкий</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Подразделение *</label>
              <select
                value={selectedUnitId}
                onChange={e => handleUnitChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-500"
                required
              >
                <option value="">Выберите подразделение</option>
                {units.map((u: any) => (
                  <option key={u.id} value={u.id.toString()}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Исполнитель (необязательно)</label>
              <select
                value={selectedUserId}
                onChange={e => handleUserChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-500"
                disabled={!selectedUnitId}
              >
                <option value="">Не назначен (задача на подразделение)</option>
                {filteredUsers.map(u => (
                  <option key={u.id} value={u.id.toString()}>
                    {u.rank} {u.fullName || `${(u as any).last_name || ''} ${(u as any).first_name || ''}`.trim()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Вложения</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => document.getElementById('task-attachments')?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider border border-slate-200 rounded-md hover:bg-slate-50"
                >
                  <Upload size={14} /> Выбрать файлы
                </button>
                <input id="task-attachments" type="file" onChange={handleAttachmentSelect} className="hidden" multiple />
              </div>
              {attachmentFiles.length > 0 && (
                <div className="mt-2 space-y-2">
                  {attachmentFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-md">
                      {file.type?.startsWith('image/') ? <Image size={16} className="text-slate-400" /> : <FileText size={16} className="text-slate-400" />}
                      <span className="text-sm text-slate-600 flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-slate-400">{formatFileSize(file.size)}</span>
                      <button type="button" onClick={() => removeAttachmentFile(index)} className="p-1 hover:bg-slate-200 rounded">
                        <X size={14} className="text-slate-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Дедлайн</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Метки (через запятую)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-green-500"
                placeholder="план, отчет"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-200 rounded-md hover:bg-slate-50">
              Отмена
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              {submitting ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}