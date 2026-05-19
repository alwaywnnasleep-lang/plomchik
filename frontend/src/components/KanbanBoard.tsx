import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar, Plus, X, AlertTriangle, Tag, MessageCircle, Send, Paperclip,
  Image, FileText, Download, Edit2, Trash2, CheckCircle, Upload, Paperclip as PaperclipIcon, 
  UserPlus, Users, RefreshCw, Save, Clock, Filter, Archive, ArrowLeft, ArrowDownAZ, Shield // <-- Добавлено Shield
} from 'lucide-react';
import type { Task, TaskStatus, Priority, User as UserType, TaskFile } from '@/types';
import { cn } from '@/utils/cn';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { parseSafeDate } from './AutoPlan';
import { useSearchParams } from 'react-router-dom';

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

const columns: { id: TaskStatus; label: string; color: string; bg: string }[] = [
  { id: 'todo', label: 'К выполнению', color: 'border-blue-400', bg: 'bg-blue-50' },
  { id: 'in_progress', label: 'В работе', color: 'border-amber-400', bg: 'bg-amber-50' },
  { id: 'review', label: 'На проверке', color: 'border-purple-400', bg: 'bg-purple-50' },
  { id: 'done', label: 'Выполнено', color: 'border-green-700', bg: 'bg-green-50' },
];

const priorityConfig: Record<Priority, { label: string; color: string; bg: string; weight: number }> = {
  critical: { label: 'Критический', color: 'text-red-700', bg: 'bg-red-100', weight: 4 },
  high: { label: 'Высокий', color: 'text-orange-700', bg: 'bg-orange-100', weight: 3 },
  medium: { label: 'Средний', color: 'text-yellow-700', bg: 'bg-yellow-100', weight: 2 },
  low: { label: 'Низкий', color: 'text-blue-700', bg: 'bg-blue-100', weight: 1 },
};

const formatSubtasksForBackend = (subtasks: any[]) => {
  return subtasks.map((st: any) => {
    const isNew = String(st.id).length > 10;
    return {
      ...(isNew ? {} : { id: parseInt(st.id) }),
      title: st.title,
      status: st.done ? 'done' : 'todo'
    };
  });
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
    subtasks: (backendTask.subtasks || []).map((st: any) => ({
      id: st.id?.toString(),
      title: st.title,
      done: st.status === 'done'
    })),
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
  const [activeSort, setActiveSort] = useState<string>('priority_desc');

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
    const taskId = searchParams.get('taskId');
    const view = searchParams.get('view');
    if (taskId && view === 'kanban' && tasks.length > 0) {
      const taskToOpen = tasks.find((t: Task) => String(t.id) === taskId);
      if (taskToOpen && selectedTask?.id !== taskToOpen.id) {
        setSelectedTask(taskToOpen);
      }
    }
  }, [searchParams, tasks]);

  const handleCloseModal = () => {
    setSelectedTask(null);
    if (searchParams.has('taskId')) {
      setSearchParams((prev: any) => {
        prev.delete('taskId');
        return prev;
      });
    }
  };

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
            setSelectedTask((prev: any) => prev ? freshTasks.find((t: Task) => t.id === prev.id) || null : null);
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

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a: Task, b: Task) => {
      if (activeSort === 'date_desc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (activeSort === 'date_asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (activeSort === 'deadline_asc') {
        const d1 = parseSafeDate(a.deadline)?.getTime() || Infinity;
        const d2 = parseSafeDate(b.deadline)?.getTime() || Infinity;
        return d1 - d2;
      }
      if (activeSort === 'priority_desc') {
        return (priorityConfig[b.priority]?.weight || 0) - (priorityConfig[a.priority]?.weight || 0);
      }
      if (activeSort === 'title_asc') return a.title.localeCompare(b.title);
      return 0;
    });
  }, [filteredTasks, activeSort]);

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
        subtasks: formatSubtasksForBackend(task.subtasks || []),
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
      const updatedTasks = tasks.map((t: Task) => 
        t.id === taskId ? { ...t, is_archived: archive } : t
      );
      onTasksChange(updatedTasks);
      handleCloseModal(); 

      await api.updateTask(parseInt(taskId), { is_archived: archive });
    } catch (error) {
      onTasksChange(tasks); 
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
      if (archiveSort === 'date_desc') return (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0);
      if (archiveSort === 'date_asc') return (new Date(a.createdAt).getTime() || 0) - (new Date(b.createdAt).getTime() || 0);
      if (archiveSort === 'deadline_asc') {
        const d1 = parseSafeDate(a.deadline)?.getTime() || Infinity;
        const d2 = parseSafeDate(b.deadline)?.getTime() || Infinity;
        return d1 - d2;
      }
      if (archiveSort === 'deadline_desc') {
        const d1 = parseSafeDate(a.deadline)?.getTime() || 0;
        const d2 = parseSafeDate(b.deadline)?.getTime() || 0;
        return d2 - d1;
      }
      if (archiveSort === 'title_asc') return a.title.localeCompare(b.title);
      return 0;
    });

    return (
      <div className="space-y-4 relative bg-white border border-slate-200 rounded-md shadow-sm p-6 min-h-[600px] animate-in fade-in">
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
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
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
                    <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono">#{task.id}</td>
                      <td className="py-3 px-4">
                        <button 
                          onClick={() => setSelectedTask(task)}
                          className="font-bold text-slate-700 hover:text-green-600 text-left text-sm"
                        >
                          {task.title}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-xs font-bold text-slate-600">
                        {parsedDeadline ? parsedDeadline.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-bold text-slate-600">{unit?.name || '—'}</td>
                      <td className="py-3 px-4 text-xs font-bold text-slate-600">
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
            <p className="text-xs font-bold text-slate-400 mt-2">Не найдено задач, соответствующих фильтрам.</p>
          </div>
        )}

        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            users={users}
            units={units}
            currentUser={user}
            onClose={handleCloseModal}
            onUpdate={(updated) => {
              onTasksChange(tasks.map((t: Task) => t.id === updated.id ? updated : t));
              setSelectedTask(updated);
            }}
            onDelete={async (id) => {
              try {
                await api.deleteTask(parseInt(id));
                onTasksChange(tasks.filter((t: Task) => t.id !== id));
                handleCloseModal();
              } catch (error: any) {
                if (error.message?.includes('No Task matches')) {
                  onTasksChange(tasks.filter((t: Task) => t.id !== id));
                  handleCloseModal();
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

  return (
    <div className="space-y-4 relative animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Активных задач: <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{sortedTasks.filter((t: Task) => !t.is_archived && String(t.status).toLowerCase() !== 'archived' && !t.is_milestone && !(t.tags || []).some(tag => String(tag).toLowerCase() === 'мероприятие')).length}</span>
        </span>
        
        <div className="flex items-center gap-2">
          <div className="relative flex items-center gap-1.5 border border-slate-200 rounded-md shadow-sm bg-white px-2 py-1">
            <ArrowDownAZ size={14} className="text-slate-400" />
            <select
              value={activeSort}
              onChange={e => setActiveSort(e.target.value)}
              className="text-xs font-bold uppercase tracking-wider text-slate-600 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="priority_desc">Сначала важные</option>
              <option value="deadline_asc">Ближайший дедлайн</option>
              <option value="date_desc">Новые</option>
              <option value="date_asc">Старые</option>
              <option value="title_asc">По алфавиту (А-Я)</option>
            </select>
          </div>

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
                      className="w-full text-sm font-bold border border-slate-200 rounded px-3 py-2 bg-slate-50 hover:bg-white focus:outline-none focus:border-green-500 cursor-pointer"
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
                      className="w-full text-sm font-bold border border-slate-200 rounded px-3 py-2 bg-slate-50 hover:bg-white focus:outline-none focus:border-green-500 cursor-pointer"
                    >
                      <option value="all">Всё время</option>
                      <option value="overdue">⚠️ Просроченные</option>
                      <option value="today">🔥 Сегодня</option>
                      <option value="week">📅 На этой неделе</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer p-2 -ml-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={filters.onlyMyTasks}
                      onChange={e => setFilters({ ...filters, onlyMyTasks: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-600 cursor-pointer"
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
      <div className="flex gap-4 overflow-x-auto pb-4 items-start custom-scrollbar">
        {columns.map(col => {
          const colTasks = sortedTasks.filter((t: Task) => {
            const isEvent = t.is_milestone || (t.tags || []).some(tag => String(tag).toLowerCase() === 'мероприятие');
            if (isEvent || t.is_archived || String(t.status).toLowerCase() === 'archived') return false;
            
            const tStatus = (t.status || 'todo').toLowerCase();
            
            if (col.id === 'todo') {
              const parsedD = parseSafeDate(t.deadline || t.start_date || t.createdAt);
              if (parsedD) {
                 const today = new Date();
                 today.setHours(12, 0, 0, 0);
                 const taskDate = new Date(parsedD);
                 taskDate.setHours(12, 0, 0, 0);
                 
                 const diffDays = Math.ceil((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                 if (diffDays > 2) return false; 
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
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{col.label}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {colTasks.length}
                  </span>
                </div>
              </div>

              <div className="p-2 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
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
                  <div className="p-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 border-2 border-dashed border-slate-200 rounded-md">
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
          onClose={handleCloseModal}
          onUpdate={(updated) => {
            onTasksChange(tasks.map((t: Task) => t.id === updated.id ? updated : t));
            setSelectedTask(updated);
          }}
          onDelete={async (id) => {
            try {
              await api.deleteTask(parseInt(id));
              onTasksChange(tasks.filter((t: Task) => t.id !== id));
              handleCloseModal();
            } catch (error: any) {
              if (error.message?.includes('No Task matches')) {
                onTasksChange(tasks.filter((t: Task) => t.id !== id));
                handleCloseModal();
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
      return getSafeFullName(user);
    }
    if (fallback && fallback.full_name) return fallback.full_name;
    return user?._fetching ? 'Загрузка...' : `ID ${id}`;
  };

  const getRank = (id: string, fallback: any) => {
    if (!id) return '';
    const user = users.find((u: any) => String(u.id) === id) || extraUsers[id];
    if (user && !user._fetching && !user._error) {
      return translateRank(user.rank);
    }
    if (fallback && fallback.rank) return translateRank(fallback.rank);
    return '';
  };

  const assigneeName = getSafeName(task.assigneeId, task.assignee);
  const assigneeRank = getRank(task.assigneeId, task.assignee);
  const creatorName = getSafeName(task.creatorId, task.creator);
  const creatorRank = getRank(task.creatorId, task.creator);
  
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
        "bg-white rounded-md border p-3 cursor-grab active:cursor-grabbing hover:border-slate-300 shadow-sm transition-colors",
        isUnassigned ? "border-dashed border-slate-300 bg-slate-50" : "border-slate-200"
      )}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded truncate max-w-[70%]">
          {unit?.name || 'Подразделение'}
        </span>
        <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">#{String(task.id || '').slice(0, 6)}</span>
      </div>

      <h4 className="text-sm font-bold text-slate-800 leading-snug mb-1">{task.title}</h4>
      
      {task.description && (
        <p className="text-[11px] font-medium text-slate-500 line-clamp-2 mb-3 leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="bg-slate-50 border border-slate-100 rounded p-2 mb-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Постановщик</div>
          <div className="text-xs font-bold text-slate-700 truncate" title={`${creatorRank} ${creatorName}`}>{creatorRank} {creatorName}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Исполнитель</div>
          <div className={cn("text-xs font-bold truncate", isUnassigned ? "text-amber-600" : "text-slate-700")} title={isUnassigned ? 'Свободная задача' : `${assigneeRank} ${assigneeName}`}>
            {isUnassigned ? 'Свободная задача' : `${assigneeRank} ${assigneeName}`}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider', pConfig.bg, pConfig.color)}>
            {pConfig.label}
          </span>
          {task.tags?.slice(0, 2).map((tag: string) => (
            <span key={tag} className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">{tag}</span>
          ))}
        </div>

        {subtasksTotal > 0 && (
          <div className="pt-1">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-wider">
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
            'text-[10px] px-2 py-1 rounded border font-bold uppercase tracking-wider flex items-center gap-1.5 mt-1', 
            task.submission.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : 
            task.submission.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 
            'bg-amber-50 text-amber-700 border-amber-200'
          )}>
            {task.submission.status === 'approved' ? <CheckCircle size={12}/> : task.submission.status === 'rejected' ? <X size={12}/> : <Clock size={12}/>}
            {task.submission.status === 'approved' ? 'Отчет принят' : task.submission.status === 'rejected' ? 'Возвращено на доработку' : 'Отчет на проверке'}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
        <div className={cn("flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider", isOverdue ? "text-red-600" : "text-slate-600")}>
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
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const [editData, setEditData] = useState({
    title: task.title,
    description: task.description,
    priority: task.priority,
    deadline: task.deadline ? (parseSafeDate(task.deadline)?.toISOString().slice(0, 16) || '') : '',
    subtasks: task.subtasks || []
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
      // Обновляем локально для быстроты интерфейса
      onUpdate({ ...task, assigneeId: userId, status: 'in_progress' });
    } catch (e) {
      console.error(e);
      alert('Ошибка при назначении задачи');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSaveEditTask = async () => {
    try {
      const payload = {
        title: editData.title,
        description: editData.description,
        priority: editData.priority,
        deadline: editData.deadline,
        subtasks: formatSubtasksForBackend(editData.subtasks)
      };
      await api.updateTask(parseInt(task.id), payload);
      onUpdate({ ...task, ...payload, subtasks: editData.subtasks } as any);
      setIsEditingTask(false);
    } catch (error) {
      alert('Ошибка при сохранении задачи');
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setEditData(prev => ({
      ...prev,
      subtasks: [...(prev.subtasks || []), { id: Date.now().toString(), title: newSubtaskTitle, done: false }]
    }));
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (idToRemove: string) => {
    setEditData(prev => ({
      ...prev,
      subtasks: (prev.subtasks || []).filter((st: any) => st.id !== idToRemove)
    }));
  };

  const handleToggleSubtaskCheckbox = async (stId: string) => {
    const newSubtasks = (task.subtasks || []).map(st => st.id === stId ? { ...st, done: !st.done } : st);
    const updatedTask = { ...task, subtasks: newSubtasks };
    onUpdate(updatedTask);
    
    try {
      await api.updateTask(parseInt(task.id), { subtasks: formatSubtasksForBackend(newSubtasks) });
    } catch (e) {
      alert('Ошибка обновления подзадачи');
    }
  };

  const getAssigneeFullName = (u: any) => getSafeFullName(u);
  const getAssigneeInitials = (u: any) => {
    const fullName = getAssigneeFullName(u);
    return fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderFileList = (files: TaskFile[]) => {
    if (!files || files.length === 0) return <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Нет вложений</p>;
    return (
      <div className="space-y-2">
        {files.map(file => {
          const fileName = file.fileName || file.filename || 'Файл';
          const fileUrl = file.fileUrl || file.file;
          return (
            <div key={file.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-md border border-slate-200">
              {fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
                <Image size={16} className="text-slate-400" />
              ) : (
                <FileText size={16} className="text-slate-400" />
              )}
              <span className="text-xs font-bold text-slate-600 flex-1 truncate">{fileName}</span>
              {fileUrl && (
                <a href={fileUrl} download={fileName} className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors shadow-sm" target="_blank" rel="noopener noreferrer">
                  <Download size={14} className="text-slate-600" />
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-md w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 pb-2 border-b border-slate-200 bg-slate-50">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded', pConfig.bg, pConfig.color)}>
                  {pConfig.label}
                </span>
                {task.is_archived && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-600 flex items-center gap-1">
                    <Archive size={12} /> Архив
                  </span>
                )}
                <span className="text-[10px] font-bold text-slate-400 font-mono">#{String(task.id || '').slice(0, 6)}</span>
              </div>
              
              {isEditingTask ? (
                <input 
                  value={editData.title}
                  onChange={e => setEditData({...editData, title: e.target.value})}
                  className="w-full text-lg font-bold border-b-2 border-green-600 bg-white px-3 py-2 outline-none mb-2 shadow-sm rounded-sm"
                />
              ) : (
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 leading-tight">
                  {task.title}
                  {(isCreator || isLeader) && (
                    <button 
                      onClick={() => setIsEditingTask(true)} 
                      className="text-slate-300 hover:text-green-600 transition-colors"
                      title="Редактировать"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                </h2>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex gap-4 mt-4 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('details')}
              className={cn(
                'pb-3 text-xs uppercase tracking-wider font-bold relative whitespace-nowrap transition-colors',
                activeTab === 'details' ? 'text-green-700 border-b-2 border-green-700' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              Детали
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={cn(
                'pb-3 text-xs uppercase tracking-wider font-bold relative flex items-center gap-1.5 whitespace-nowrap transition-colors',
                activeTab === 'comments' ? 'text-green-700 border-b-2 border-green-700' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              Обсуждение
              {task.comments && task.comments.length > 0 && (
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                  {task.comments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('attachments')}
              className={cn(
                'pb-3 text-xs uppercase tracking-wider font-bold relative flex items-center gap-1.5 whitespace-nowrap transition-colors',
                activeTab === 'attachments' ? 'text-green-700 border-b-2 border-green-700' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <PaperclipIcon size={14} />
              Вложения
              {task.attachments && task.attachments.length > 0 && (
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                  {task.attachments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('submission')}
              className={cn(
                'pb-3 text-xs uppercase tracking-wider font-bold relative flex items-center gap-1.5 whitespace-nowrap transition-colors',
                activeTab === 'submission' ? 'text-green-700 border-b-2 border-green-700' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <CheckCircle size={14} />
              Выполнение
              {task.submission && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded',
                  task.submission.status === 'approved' ? 'bg-green-100 text-green-700' :
                  task.submission.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                )}>
                  {task.submission.status === 'approved' ? '✓' :
                   task.submission.status === 'rejected' ? '✗' : '?'}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
          {activeTab === 'details' && (
            <div className="space-y-6">
              
              {isEditingTask ? (
                <div className="space-y-4 mb-6 bg-slate-50 p-5 rounded-md border border-slate-200 shadow-sm">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Описание</label>
                    <textarea 
                      value={editData.description}
                      onChange={e => setEditData({...editData, description: e.target.value})}
                      className="w-full text-sm font-medium border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 bg-white"
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Приоритет</label>
                      <select 
                        value={editData.priority}
                        onChange={e => setEditData({...editData, priority: e.target.value as Priority})}
                        className="w-full text-sm font-bold border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-green-600 bg-white cursor-pointer"
                      >
                        <option value="critical">Критический</option>
                        <option value="high">Высокий</option>
                        <option value="medium">Средний</option>
                        <option value="low">Низкий</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Дедлайн</label>
                      <input 
                        type="datetime-local"
                        value={editData.deadline}
                        onChange={e => setEditData({...editData, deadline: e.target.value})}
                        className="w-full text-sm font-bold border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-green-600 bg-white cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 block">Подзадачи</label>
                    <div className="space-y-2 mb-3">
                      {(editData.subtasks || []).map((st: any) => (
                        <div key={st.id} className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-200 rounded-md shadow-sm">
                          <span className={cn('text-sm font-medium flex-1', st.done && 'line-through text-slate-400')}>{st.title}</span>
                          <button onClick={() => handleRemoveSubtask(st.id)} className="text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 p-1 rounded transition-colors"><X size={14}/></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        value={newSubtaskTitle}
                        onChange={e => setNewSubtaskTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                        placeholder="Добавить пункт..."
                        className="flex-1 text-sm font-medium border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 bg-white"
                      />
                      <button onClick={handleAddSubtask} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md font-bold text-xs uppercase tracking-wider transition-colors shadow-sm">Добавить</button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                    <button onClick={() => setIsEditingTask(false)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors">
                      Отмена
                    </button>
                    <button onClick={handleSaveEditTask} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-md text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors shadow-sm">
                      <Save size={14} /> Сохранить
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-md border border-slate-100">
                  <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">{task.description || 'Описание отсутствует.'}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Исполнитель</div>
                  
                  {isLeader ? (
                    <select 
                      disabled={isAssigning}
                      value={task.assigneeId || ''}
                      onChange={(e) => handleClaimOrAssign(e.target.value)} 
                      className="text-sm font-bold border border-slate-300 rounded-md px-3 py-2 outline-none w-full bg-slate-50 hover:bg-white focus:border-green-600 cursor-pointer shadow-sm transition-colors"
                    >
                      <option value="">Не назначен (Свободная)</option>
                      {unitUsers.map(u => (
                        <option key={u.id} value={u.id.toString()}>
                          {translateRank(u.rank)} {getAssigneeFullName(u)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {assignee ? (
                        <div className="flex items-center gap-3 bg-white p-2 border border-slate-200 rounded-md shadow-sm">
                          <div className="w-10 h-10 rounded bg-green-600 flex items-center justify-center text-white text-sm font-bold shadow-inner">
                            {getAssigneeInitials(assignee)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">{getAssigneeFullName(assignee)}</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{translateRank(assignee.rank)}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 bg-amber-50 p-3 rounded-md border border-dashed border-amber-300">
                            <AlertTriangle size={16} className="text-amber-500" />
                            Свободная задача
                          </div>
                          {canClaim && (
                             <button 
                               disabled={isAssigning}
                               onClick={() => handleClaimOrAssign(currentUser.id.toString())}
                               className="w-full text-xs uppercase tracking-wider bg-green-600 text-white px-4 py-2.5 rounded-md hover:bg-green-700 font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                             >
                               <UserPlus size={16} /> Взять в работу
                             </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Постановщик</div>
                  <div className="flex items-center gap-3 bg-white p-2 border border-slate-200 rounded-md shadow-sm">
                    {creator ? (
                      <>
                        <div
                          className="w-10 h-10 rounded flex items-center justify-center text-white text-sm font-bold shadow-inner"
                          style={{ backgroundColor: `hsl(${parseInt(creator.id.toString()) * 100 % 360}, 50%, 45%)` }}
                        >
                          {getAssigneeInitials(creator)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800">{getAssigneeFullName(creator)}</div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{translateRank(creator.rank)}</div>
                        </div>
                      </>
                    ) : <span className="text-sm font-bold text-slate-500 p-2">Система</span>}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Подразделение</div>
                  <div className="text-sm text-slate-800 font-bold flex items-center gap-2 bg-slate-50 p-3 border border-slate-200 rounded-md shadow-sm">
                    <Users size={16} className="text-slate-400" />
                    {unit?.name || '—'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Дедлайн</div>
                  <div className={cn(
                    "text-sm font-bold flex items-center gap-2 p-3 border rounded-md shadow-sm",
                    parsedModalDeadline && parsedModalDeadline < new Date() && task.status !== 'done' 
                      ? "bg-red-50 border-red-200 text-red-700" 
                      : "bg-slate-50 border-slate-200 text-slate-800"
                  )}>
                    <Calendar size={16} />
                    {parsedModalDeadline ? parsedModalDeadline.toLocaleString('ru-RU', {
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : 'Без срока'}
                  </div>
                </div>
              </div>

              {task.tags.length > 0 && (
                <div className="pt-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Метки</div>
                  <div className="flex flex-wrap gap-1.5">
                    {task.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-sm shadow-sm">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {task.subtasks && task.subtasks.length > 0 && !isEditingTask && (
                <div className="pt-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Подзадачи</div>
                  <div className="space-y-2 bg-slate-50 p-4 rounded-md border border-slate-200">
                    {task.subtasks.map(st => (
                      <label key={st.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={st.done}
                          onChange={() => handleToggleSubtaskCheckbox(st.id)}
                          className="mt-0.5 rounded border-slate-300 text-green-600 focus:ring-green-600 w-4 h-4 cursor-pointer"
                        />
                        <span className={cn('text-sm font-medium leading-tight pt-px', st.done ? 'line-through text-slate-400' : 'text-slate-800')}>{st.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {allowedStatuses.length > 0 && (
                <div className="mt-6 border-t border-slate-200 pt-6">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 text-center">Действия со статусом</div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {allowedStatuses.map(col => (
                      <button
                        key={col.id}
                        onClick={async () => {
                          await api.moveTask(parseInt(task.id), col.id, 0);
                        }}
                        className={cn(
                          'text-xs uppercase tracking-wider font-bold px-4 py-2 rounded-md border shadow-sm transition-colors',
                          (task.status === col.id || (task.status === 'planned' && col.id === 'todo'))
                            ? 'border-green-600 bg-green-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400'
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
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Прикрепленные файлы</h3>
              {renderFileList(task.attachments || [])}
            </div>
          )}

          {activeTab === 'submission' && (
            <TaskSubmission
              task={task}
            />
          )}
        </div>

        <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar size={12} />
              Создано: {new Date(task.createdAt).toLocaleDateString('ru-RU')}
            </div>

            {(isLeader || isCreator) && (
              <>
                <div className="w-px h-4 bg-slate-300"></div>
                {task.is_archived ? (
                  <button 
                    onClick={() => onToggleArchive(task.id, false)}
                    className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-white border border-green-600 text-green-700 rounded hover:bg-green-50 flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <RefreshCw size={12} /> Вернуть
                  </button>
                ) : (
                  task.status === 'done' && (
                    <button 
                      onClick={() => onToggleArchive(task.id, true)}
                      className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-100 flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Archive size={12} /> В архив
                    </button>
                  )
                )}
              </>
            )}
          </div>

          <div>
            {showConfirmDelete ? (
              <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-md border border-red-100">
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider mr-2">Удалить безвозвратно?</span>
                <button
                  onClick={() => onDelete(task.id)}
                  className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 shadow-sm"
                >
                  Да
                </button>
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 shadow-sm"
                >
                  Нет
                </button>
              </div>
            ) : (
              isLeader && (
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 flex items-center gap-1.5 transition-colors shadow-sm"
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
            <div key={att.id} className="flex items-center gap-1 bg-white rounded-md px-2 py-1 border border-slate-200 shadow-sm">
              {fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <Image size={12} className="text-slate-400" />
              ) : (
                <FileText size={12} className="text-slate-400" />
              )}
              <span className="text-xs font-bold text-slate-600 max-w-[150px] truncate">{fileName}</span>
              <a href={fileUrl} download={fileName} className="ml-1 p-1 bg-slate-100 hover:bg-slate-200 rounded transition-colors" target="_blank" rel="noopener noreferrer">
                <Download size={10} className="text-slate-600" />
              </a>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-1 space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar p-4 bg-slate-50 rounded-md border border-slate-200">
        {comments.length === 0 ? (
          <div className="text-center py-10 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Нет комментариев. Будьте первым!
          </div>
        ) : (
          comments.map((comment: any) => {
            const fullName = comment.userFullName || comment.user_full_name || 'Неизвестный сотрудник';
            const rank = comment.userRank || comment.user_rank || '';
            const date = comment.createdAt || comment.created_at;
            const authorId = comment.userId?.toString() || comment.user?.toString();
            const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
            
            const isMe = authorId === currentUser?.id?.toString();

            return (
              <div key={comment.id} className={cn("group flex gap-3", isMe ? "flex-row-reverse" : "flex-row")}>
                <div className="flex-shrink-0 mt-1">
                  <div className={cn(
                    "w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs shadow-sm",
                    isMe ? "bg-green-600" : "bg-slate-700"
                  )}>
                    {initials}
                  </div>
                </div>

                <div className={cn("flex flex-col max-w-[80%]", isMe ? "items-end" : "items-start")}>
                  <div className={cn("flex items-center gap-2 mb-1", isMe ? "flex-row-reverse" : "flex-row")}>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {translateRank(rank)} {fullName}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded-sm">
                      {formatDate(date)}
                    </span>
                  </div>

                  {editingCommentId === comment.id ? (
                    <div className="space-y-2 w-full bg-white p-3 rounded-md border border-green-600 shadow-sm">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full text-sm font-medium border-none outline-none resize-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                        <button onClick={cancelEdit} className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-slate-100 text-slate-600 rounded-sm hover:bg-slate-200 transition-colors">Отмена</button>
                        <button onClick={saveEdit} className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors shadow-sm">Сохранить</button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group">
                      <div className={cn(
                        "p-3 rounded-md text-sm font-medium shadow-sm relative",
                        isMe ? "bg-green-50 border border-green-200 text-green-900 rounded-tr-none" : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                      )}>
                        <p className="whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                        {comment.attachments && comment.attachments.length > 0 && renderFileList(comment.attachments)}
                      </div>

                      {isMe && !editingCommentId && (
                        <div className="absolute top-1/2 -translate-y-1/2 -left-16 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity bg-white p-1 rounded-md border border-slate-200 shadow-sm">
                          <button onClick={() => startEditing(comment)} className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Редактировать">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => handleDelete(comment.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Удалить">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      <div className="relative bg-white border border-slate-200 rounded-md p-3 shadow-sm">
        {attachments.length > 0 && (
          <div className="mb-3 p-3 bg-slate-50 rounded-md border border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
              <Paperclip size={12} />
              Прикреплённые файлы:
            </div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center gap-1.5 bg-white rounded-md px-2 py-1.5 border border-slate-200 shadow-sm">
                  {file.type.startsWith('image/') ? <Image size={14} className="text-blue-500" /> : <FileText size={14} className="text-slate-500" />}
                  <span className="text-xs font-bold text-slate-700 max-w-[150px] truncate">{file.name}</span>
                  <button onClick={() => removeAttachment(index)} className="ml-1 p-1 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors">
                    <X size={10} />
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
            placeholder="Написать сообщение..."
            className="flex-1 px-3 py-2 text-sm font-medium border-none outline-none resize-none min-h-[44px] max-h-[150px] bg-transparent"
          />

          <div className="flex items-center gap-2 pr-1 pb-1">
            <div className="relative">
              <button onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Прикрепить файл">
                <Paperclip size={18} />
              </button>

              {showAttachmentMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-white rounded-md shadow-xl border border-slate-200 py-1 min-w-[150px] z-10">
                  <button onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors">
                    <FileText size={14} className="text-slate-400" /> Документ
                  </button>
                  <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'image/*'; fileInputRef.current.click(); } }} className="w-full px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors border-t border-slate-100">
                    <Image size={14} className="text-slate-400" /> Изображение
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={handleSendComment} 
              disabled={isSending || (!newComment.trim() && attachments.length === 0)} 
              className="p-2.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
              title="Отправить (Enter)"
            >
              <Send size={16} className={cn("translate-x-0.5", isSending && "animate-pulse")} />
            </button>
          </div>
        </div>

        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
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
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
        <div className="p-1.5 bg-slate-100 rounded text-slate-600">
          <CheckCircle size={16} />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800">Результаты работы</h3>
      </div>

      {task.submission && (
        <div className={cn(
          'p-5 rounded-md border shadow-sm relative overflow-hidden',
          task.submission.status === 'approved' ? 'bg-green-50 border-green-200' :
          task.submission.status === 'rejected' ? 'bg-red-50 border-red-200' :
          'bg-amber-50 border-amber-200'
        )}>
          {/* Декоративная полоска слева */}
          <div className={cn(
            "absolute left-0 top-0 bottom-0 w-1",
            task.submission.status === 'approved' ? 'bg-green-500' :
            task.submission.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
          )} />

          <div className="flex items-center justify-between mb-4">
             <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Статус отчета</span>
             <span className={cn(
               "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm border shadow-sm flex items-center gap-1.5",
               task.submission.status === 'approved' ? 'bg-green-600 text-white border-green-700' :
               task.submission.status === 'rejected' ? 'bg-red-600 text-white border-red-700' : 'bg-amber-500 text-white border-amber-600'
             )}>
               {task.submission.status === 'approved' ? <><CheckCircle size={12}/> Принят</> :
                task.submission.status === 'rejected' ? <><X size={12}/> Возвращен</> : <><Clock size={12}/> На проверке</>}
             </span>
          </div>

          <div className="bg-white p-4 rounded-md border border-slate-200 shadow-sm mb-4">
            <h4 className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">Комментарий исполнителя:</h4>
            <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
              {task.submission.comment || <span className="italic text-slate-400">Без комментария</span>}
            </p>
          </div>

          {task.submission.files && task.submission.files.length > 0 && (
            <div className="mb-4">
              <h4 className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">Приложенные материалы:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {task.submission.files.map((f: any) => (
                  <a key={f.id} href={f.file || f.fileUrl} target="_blank" className="flex items-center gap-2 p-2 bg-white rounded-md border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group">
                    <div className="p-1.5 bg-slate-50 rounded text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-colors">
                      <FileText size={14} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 truncate flex-1">{f.filename || f.fileName || 'Документ'}</span>
                    <Download size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {task.submission.reviewComment && (
            <div className="mt-4 p-4 bg-white border-l-4 border-l-purple-500 border-y border-r border-slate-200 rounded-r-md shadow-sm">
              <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1 mb-2">
                <AlertTriangle size={10} /> Вердикт проверяющего:
              </span>
              <p className="text-slate-700 font-medium text-sm whitespace-pre-wrap leading-relaxed">{task.submission.reviewComment}</p>
            </div>
          )}
          
          {isAssignee && task.status === 'review' && (
             <div className="mt-5 pt-4 border-t border-amber-200 border-dashed flex justify-end">
               <button onClick={handleWithdraw} disabled={submitting} className="px-6 py-2 bg-white border border-amber-300 text-amber-700 rounded-md hover:bg-amber-50 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50">
                 <RefreshCw size={14} /> Отозвать с проверки
               </button>
             </div>
          )}
        </div>
      )}

      {canSubmit && (
        <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-green-500" />
          
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 mb-5 flex items-center gap-2">
            <Upload size={16} className="text-blue-500" />
            Сдать работу
          </h3>

          <div className="bg-slate-50 p-4 rounded-md border border-slate-200 border-dashed mb-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Прикрепить документы (обязательно)</label>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-sm transition-colors">
                <Plus size={12} /> Выбрать файлы
              </button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />

            {files.length > 0 ? (
              <div className="space-y-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText size={14} className="text-blue-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 truncate">{f.name}</span>
                    </div>
                    <button onClick={() => removeFile(i)} className="text-slate-400 hover:bg-red-50 hover:text-red-600 p-1.5 rounded transition-colors"><X size={14} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Файлы не выбраны
              </div>
            )}
          </div>

          <div className="mb-5">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Комментарий (необязательно)</label>
             <textarea
               value={comment}
               onChange={(e) => setComment(e.target.value)}
               placeholder="Напишите краткий комментарий к выполненной работе..."
               className="w-full p-3 text-sm font-medium border border-slate-300 rounded-md focus:border-green-600 focus:ring-1 focus:ring-green-600 outline-none h-24 bg-slate-50 focus:bg-white transition-colors resize-none"
             />
          </div>

          <button 
            onClick={handleSubmit} 
            disabled={submitting || files.length === 0} 
            className="w-full py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            {submitting ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            {submitting ? 'Отправка...' : 'Отправить на проверку'}
          </button>
        </div>
      )}

      {canReview && (
        <div className="bg-slate-800 p-6 rounded-md shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none" />
          
          <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-5 flex items-center gap-2">
            <Shield size={16} className="text-amber-400" />
            Проверка выполнения
          </h3>
          
          <div className="mb-5">
            <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 block">Вердикт или замечания (обязательно для доработки)</label>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Напишите ваш комментарий..."
              className="w-full p-3 text-sm font-medium bg-slate-900 border border-slate-700 text-white rounded-md focus:border-amber-500 outline-none h-24 resize-none transition-colors placeholder:text-slate-600"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => handleReviewAction(true)} 
              disabled={submitting} 
              className="flex-1 py-3 bg-emerald-600 text-white rounded-md hover:bg-emerald-500 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
            >
              <CheckCircle size={16} /> Принять работу
            </button>
            <button 
              onClick={() => handleReviewAction(false)} 
              disabled={submitting || !reviewComment.trim()} 
              className="flex-1 py-3 bg-slate-700 border border-slate-600 text-white rounded-md hover:bg-red-600 hover:border-red-600 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
              title={!reviewComment.trim() ? "Напишите замечания для возврата" : ""}
            >
              <X size={16} /> Вернуть на доработку
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
  
  const [subtasks, setSubtasks] = useState<{id: string, title: string, done: boolean}[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

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

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks(prev => [...prev, { id: Date.now().toString(), title: newSubtaskTitle, done: false }]);
    setNewSubtaskTitle('');
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
        subtasks,
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-md w-full max-w-lg max-h-[95vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Plus size={16} className="text-green-600" /> Новая задача
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Название *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm font-medium border border-slate-300 rounded-md focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 bg-slate-50 focus:bg-white transition-colors shadow-sm"
              placeholder="Введите название задачи"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm font-medium border border-slate-300 rounded-md focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 bg-slate-50 focus:bg-white transition-colors shadow-sm resize-none"
              placeholder="Подробное описание задачи..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Приоритет</label>
              <select 
                value={priority} 
                onChange={e => setPriority(e.target.value as Priority)} 
                className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-md focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 bg-slate-50 focus:bg-white transition-colors shadow-sm cursor-pointer"
              >
                <option value="critical" className="text-red-600 font-bold">Критический</option>
                <option value="high" className="text-orange-600 font-bold">Высокий</option>
                <option value="medium" className="text-amber-600 font-bold">Средний</option>
                <option value="low" className="text-blue-600 font-bold">Низкий</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Дедлайн</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-md focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 bg-slate-50 focus:bg-white transition-colors shadow-sm cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Подразделение *</label>
              <select
                value={selectedUnitId}
                onChange={e => handleUnitChange(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-md focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 bg-slate-50 focus:bg-white transition-colors shadow-sm cursor-pointer"
                required
              >
                <option value="">Выберите...</option>
                {units.map((u: any) => (
                  <option key={u.id} value={u.id.toString()}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Исполнитель</label>
              <select
                value={selectedUserId}
                onChange={e => handleUserChange(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-md focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 bg-slate-50 focus:bg-white transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:bg-slate-100"
                disabled={!selectedUnitId}
              >
                <option value="">Не назначен (свободная)</option>
                {filteredUsers.map(u => (
                  <option key={u.id} value={u.id.toString()}>
                    {translateRank(u.rank)} {getSafeFullName(u)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">Подзадачи</label>
            <div className="space-y-2 mb-3">
              {subtasks.map((st, i) => (
                <div key={i} className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-200 rounded-md shadow-sm">
                  <span className="flex-1 text-sm font-medium">{st.title}</span>
                  <button type="button" onClick={() => setSubtasks(s => s.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 p-1 rounded transition-colors"><X size={14}/></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                placeholder="Новый пункт..."
                className="flex-1 text-sm font-medium border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 bg-slate-50 focus:bg-white transition-colors shadow-sm"
              />
              <button type="button" onClick={handleAddSubtask} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md font-bold text-xs uppercase tracking-wider transition-colors shadow-sm">Добавить</button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">Вложения</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => document.getElementById('task-attachments')?.click()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 transition-colors shadow-sm"
              >
                <Upload size={14} /> Выбрать файлы
              </button>
              <input id="task-attachments" type="file" onChange={handleAttachmentSelect} className="hidden" multiple />
            </div>
            {attachmentFiles.length > 0 && (
              <div className="mt-3 space-y-2 bg-slate-50 p-3 rounded-md border border-slate-200">
                {attachmentFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 bg-white rounded-md border border-slate-200 shadow-sm">
                    {file.type?.startsWith('image/') ? <Image size={16} className="text-blue-500" /> : <FileText size={16} className="text-slate-500" />}
                    <span className="text-xs font-bold text-slate-700 flex-1 truncate">{file.name}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">{formatFileSize(file.size)}</span>
                    <button type="button" onClick={() => removeAttachmentFile(index)} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded transition-colors text-slate-400">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Метки (через запятую)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              className="w-full px-3 py-2 text-sm font-medium border border-slate-300 rounded-md focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 bg-slate-50 focus:bg-white transition-colors shadow-sm"
              placeholder="план, отчет, срочно"
            />
          </div>
        </form>

        <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider border border-slate-300 rounded-md text-slate-700 hover:bg-white transition-colors shadow-sm">
            Отмена
          </button>
          <button type="submit" onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm">
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {submitting ? 'Сохранение...' : 'Создать задачу'}
          </button>
        </div>
      </div>
    </div>
  );
}