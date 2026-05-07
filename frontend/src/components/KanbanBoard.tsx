import { useState, useEffect, useRef } from 'react';
import {
  GripVertical, Calendar, Plus, X, AlertTriangle,
  Filter, Tag, MessageCircle, Send, Paperclip,
  Image, FileText, Download, Edit2, Trash2,
  CheckCircle, Upload, Paperclip as PaperclipIcon, UserPlus, Users, RefreshCw, Save
} from 'lucide-react';
import type { Task, TaskStatus, Priority, Comment, User as UserType, TaskFile, TaskSubmission } from '@/types';
import { cn } from '@/utils/cn';
import { v4 as uuidv4 } from 'uuid';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface KanbanBoardProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  searchQuery: string;
}

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

// ФИКС: Функция-переводчик. Превращает сырые данные Django (snake_case) в формат React (camelCase)
const normalizeTask = (backendTask: any): Task => {
  return {
    ...backendTask,
    id: backendTask.id?.toString(),
    title: backendTask.title || '',
    description: backendTask.description || '',
    status: backendTask.status || 'todo',
    priority: backendTask.priority || 'medium',
    // Мапим ID из змеиного_регистра Django в camelCase фронтенда
    assigneeId: backendTask.assigned_to?.toString() || backendTask.assigneeId || '',
    creatorId: backendTask.created_by?.toString() || backendTask.creatorId || '',
    unitId: backendTask.org_unit?.toString() || backendTask.unitId || '',
    tags: backendTask.tags || [],
    createdAt: backendTask.created_at || backendTask.createdAt,
    deadline: backendTask.deadline || '',
    subtasks: backendTask.subtasks || [],
    comments: backendTask.comments || [],
    attachments: backendTask.attachments || [],
    submission: backendTask.submission || null
  } as Task;
};

export function KanbanBoard({ tasks, onTasksChange, searchQuery }: KanbanBoardProps) {
  const { user } = useAuth();
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  const onTasksChangeRef = useRef(onTasksChange);
  useEffect(() => {
    onTasksChangeRef.current = onTasksChange;
  }, [onTasksChange]);

  useEffect(() => {
    loadUsers();
    loadUnits();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//localhost:8000/ws/tasks/`;
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWs = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'task_update') {
            const response = await api.getTasks();
            const rawTasks = Array.isArray(response) ? response : (response.results || []);
            
            // ФИКС: Прогоняем все пришедшие по вебсокету задачи через переводчик
            const freshTasks = rawTasks.map(normalizeTask);
            
            onTasksChangeRef.current(freshTasks);
            
            setSelectedTask(prev => {
              if (!prev) return null;
              const updated = freshTasks.find((t: Task) => t.id === prev.id);
              return updated || null;
            });
          }
        } catch (e) {
          console.error('WebSocket Error processing message:', e);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWs, 3000);
      };
      
      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  const loadUsers = async () => {
    try {
      const usersData = await api.getAllUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadUnits = async () => {
    try {
      // Используем новый типизированный метод
      const unitsData = await api.getAvailableUnits(); 
      setUnits(Array.isArray(unitsData) ? unitsData : (unitsData.results || []));
    } catch (error) {
      console.error('Failed to load units:', error);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = searchQuery === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesUnit = filterUnit === 'all' || t.unitId === filterUnit;
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    return matchesSearch && matchesUnit && matchesPriority;
  });

  const handleDragStart = (taskId: string) => {
    setDraggedTask(taskId);
  };

  const handleDrop = async (status: TaskStatus) => {
    if (draggedTask) {
      const task = tasks.find(t => t.id === draggedTask);
      if (!task) return;

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

      const updatedTasks = tasks.map(t => t.id === draggedTask ? { ...t, status } : t);
      onTasksChange(updatedTasks);

      try {
        await api.moveTask(parseInt(draggedTask), status, 0);
      } catch (error) {
        onTasksChange(tasks);
        alert('Ошибка при перемещении задачи.');
      }
      setDraggedTask(null);
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

      // СРАЗУ запрашиваем свежий список и нормализуем его
      const response = await api.getTasks();
      const rawTasks = Array.isArray(response) ? response : (response.results || []);
      const freshTasks = rawTasks.map(normalizeTask);
      
      onTasksChange(freshTasks);
      setShowAddModal(false);
    } catch (error: any) {
      console.error('Failed to create task:', error);
      alert(error.message || 'Ошибка при создании задачи.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Канбан-доска</h1>
          <p className="text-sm text-slate-500 mt-1">Управление задачами подразделений (Real-Time)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors',
              showFilters ? 'border-green-700 text-green-700 bg-green-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            <Filter size={14} />
            Фильтры
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
          >
            <Plus size={14} />
            Новая задача
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Подразделение</label>
            <select
              value={filterUnit}
              onChange={e => setFilterUnit(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-700/30"
            >
              <option value="all">Все подразделения</option>
              {units.map((u: any) => (
                <option key={u.id} value={u.id.toString()}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Приоритет</label>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-700/30"
            >
              <option value="all">Все приоритеты</option>
              <option value="critical">Критический</option>
              <option value="high">Высокий</option>
              <option value="medium">Средний</option>
              <option value="low">Низкий</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => {
          const colTasks = filteredTasks.filter(t => t.status === col.id);
          return (
            <div
              key={col.id}
              className="flex-1 min-w-[300px] max-w-[400px]"
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(col.id)}
            >
              <div className={cn('rounded-xl border border-slate-200 bg-slate-50/50 min-h-[500px]')}>
                <div className={cn('px-4 py-3 border-b-2', col.color)}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', col.bg, 'text-slate-600')}>
                      {colTasks.length}
                    </span>
                  </div>
                </div>
                <div className="p-2 space-y-2">
                  {colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      users={users}
                      units={units}
                      onDragStart={() => handleDragStart(task.id)}
                      onClick={() => setSelectedTask(task)}
                    />
                  ))}
                </div>
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
            onTasksChange(tasks.map(t => t.id === updated.id ? updated : t));
            setSelectedTask(updated);
          }}
          onDelete={async (id) => {
            try {
              await api.deleteTask(parseInt(id));
              onTasksChange(tasks.filter(t => t.id !== id));
              setSelectedTask(null);
            } catch (error: any) {
              if (error.message?.includes('No Task matches')) {
                onTasksChange(tasks.filter(t => t.id !== id));
                setSelectedTask(null);
              } else {
                alert('Ошибка при удалении задачи');
              }
            }
          }}
        />
      )}
    </div>
  );
}

// ========== TaskCard Component ==========
function TaskCard({ task, users, units, onDragStart, onClick }: {
  task: Task;
  users: UserType[];
  units: any[];
  onDragStart: () => void;
  onClick: () => void;
}) {
  const assignee = users.find(u => u.id.toString() === task.assigneeId);
  const unit = units.find(u => u.id.toString() === task.unitId);
  const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'done';
  const pConfig = priorityConfig[task.priority];
  const subtasksDone = task.subtasks?.filter(s => s.done).length ?? 0;
  const subtasksTotal = task.subtasks?.length ?? 0;
  const commentsCount = task.comments?.length || 0;
  const attachmentsCount = task.attachments?.length || 0;
  
  // Благодаря normalizeTask это условие теперь работает идеально
  const isUnassigned = !task.assigneeId;

  const getAssigneeInitials = () => {
    if (!assignee) return '';
    const fullName = assignee.fullName || `${assignee.last_name || ''} ${assignee.first_name || ''}`;
    return fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusIcon = () => {
    if (!task.submission) return null;
    switch (task.submission.status) {
      case 'approved': return <CheckCircle size={8} className="text-green-700" />;
      case 'rejected': return <X size={8} className="text-red-700" />;
      default: return <Send size={8} className="text-yellow-700" />;
    }
  };

  const getStatusText = () => {
    if (!task.submission) return null;
    switch (task.submission.status) {
      case 'approved': return 'Принято';
      case 'rejected': return 'Доработка';
      default: return 'На проверке';
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "bg-white rounded-lg border p-3 cursor-pointer hover:shadow-md transition-all group",
        isUnassigned ? "border-dashed border-slate-400 bg-slate-50/80" : "border-slate-200 hover:border-slate-300"
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-slate-300 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', pConfig.bg, pConfig.color)}>
              {pConfig.label}
            </span>
            {isOverdue && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-0.5">
                <AlertTriangle size={8} /> Просрочено
              </span>
            )}
            {isUnassigned && (
               <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 flex items-center gap-0.5">
                 <UserPlus size={8} /> Свободная
               </span>
            )}
          </div>

          <h4 className="text-sm font-medium text-slate-800 mb-1 line-clamp-2">{task.title}</h4>

          {task.submission && (
            <div className="mt-1 mb-2">
              <div className={cn(
                'text-[9px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1',
                task.submission.status === 'approved' ? 'bg-green-100 text-green-700' :
                task.submission.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              )}>
                {getStatusIcon()}
                {getStatusText()}
              </div>
            </div>
          )}

          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded flex items-center gap-0.5">
                  <Tag size={8} />{tag}
                </span>
              ))}
            </div>
          )}

          {subtasksTotal > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span>Подзадачи</span>
                <span>{subtasksDone}/{subtasksTotal}</span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-700 rounded-full"
                  style={{ width: `${(subtasksDone / subtasksTotal) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Calendar size={10} />
              <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                {new Date(task.deadline).toLocaleString('ru-RU', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {attachmentsCount > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                  <PaperclipIcon size={10} /> {attachmentsCount}
                </span>
              )}
              {commentsCount > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                  <MessageCircle size={10} /> {commentsCount}
                </span>
              )}
              {unit && (
                <span className="text-[9px] px-1 py-0.5 bg-slate-100 text-slate-500 rounded">
                  {unit.name}
                </span>
              )}
              {assignee ? (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                  style={{ backgroundColor: `hsl(${parseInt(assignee.id.toString()) * 100 % 360}, 70%, 50%)` }}
                  title={`${assignee.rank || ''} ${assignee.fullName || ''}`}
                >
                  {getAssigneeInitials()}
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-dashed border-slate-400 flex items-center justify-center bg-slate-50 text-slate-400" title="Никто не назначен">
                  <UserPlus size={10} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== TaskDetailModal Component ==========
function TaskDetailModal({ task, users, units, currentUser, onClose, onUpdate, onDelete }: {
  task: Task;
  users: UserType[];
  units: any[];
  currentUser: any;
  onClose: () => void;
  onUpdate: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'submission' | 'attachments'>('details');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editData, setEditData] = useState({
    title: task.title,
    description: task.description,
    priority: task.priority,
    deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : ''
  });

  const assignee = users.find(u => u.id.toString() === task.assigneeId);
  const creator = users.find(u => u.id.toString() === task.creatorId);
  const unit = units.find(u => u.id.toString() === task.unitId);
  const pConfig = priorityConfig[task.priority];

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
    return user.fullName || user.full_name || `${user.last_name || ''} ${user.first_name || ''}`.trim();
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
            <div key={file.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 pb-2 border-b border-slate-200">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded', pConfig.bg, pConfig.color)}>
                  {pConfig.label}
                </span>
                <span className="text-xs text-slate-400">#{String(task.id || '').slice(0, 6)}</span>
              </div>
              
              {isEditingTask ? (
                <input 
                  value={editData.title}
                  onChange={e => setEditData({...editData, title: e.target.value})}
                  className="w-full text-lg font-bold border-b-2 border-green-700 bg-slate-50 px-2 py-1 outline-none mb-2"
                />
              ) : (
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  {task.title}
                  {(isCreator || isLeader) && (
                    <button 
                      onClick={() => setIsEditingTask(true)} 
                      className="text-slate-300 hover:text-green-700 transition-colors"
                      title="Редактировать задачу"
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
                'pb-2 text-sm font-medium transition-colors relative whitespace-nowrap',
                activeTab === 'details' ? 'text-green-700 border-b-2 border-green-700' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Детали
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={cn(
                'pb-2 text-sm font-medium transition-colors relative flex items-center gap-1 whitespace-nowrap',
                activeTab === 'comments' ? 'text-green-700 border-b-2 border-green-700' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Обсуждение
              {task.comments && task.comments.length > 0 && (
                <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full ml-1">
                  {task.comments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('attachments')}
              className={cn(
                'pb-2 text-sm font-medium transition-colors relative flex items-center gap-1 whitespace-nowrap',
                activeTab === 'attachments' ? 'text-green-700 border-b-2 border-green-700' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <PaperclipIcon size={16} />
              Вложения
              {task.attachments && task.attachments.length > 0 && (
                <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full ml-1">
                  {task.attachments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('submission')}
              className={cn(
                'pb-2 text-sm font-medium transition-colors relative flex items-center gap-1 whitespace-nowrap',
                activeTab === 'submission' ? 'text-green-700 border-b-2 border-green-700' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <CheckCircle size={16} />
              Выполнение
              {task.submission && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full ml-1',
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
                <div className="space-y-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Описание</label>
                    <textarea 
                      value={editData.description}
                      onChange={e => setEditData({...editData, description: e.target.value})}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-700/30"
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Приоритет</label>
                      <select 
                        value={editData.priority}
                        onChange={e => setEditData({...editData, priority: e.target.value as Priority})}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-700/30"
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
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-700/30"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSaveEditTask} className="flex items-center gap-1.5 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors">
                      <Save size={16} /> Сохранить изменения
                    </button>
                    <button onClick={() => setIsEditingTask(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600 mb-6">{task.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">Исполнитель</div>
                  
                  {isLeader ? (
                    <div className="space-y-2">
                      <select 
                        disabled={isAssigning}
                        value={task.assigneeId || ''}
                        onChange={(e) => handleClaimOrAssign(e.target.value)} 
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-green-700/30 outline-none w-full bg-slate-50 hover:bg-white transition-colors"
                      >
                        <option value="">Не назначен (Свободная)</option>
                        {unitUsers.map(u => (
                          <option key={u.id} value={u.id.toString()}>
                            {u.rank} {getAssigneeFullName(u)}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 italic">Командир может назначать любого сотрудника группы</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {assignee ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            {getAssigneeInitials(assignee)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-700">{getAssigneeFullName(assignee)}</div>
                            <div className="text-[10px] text-slate-400">{assignee.rank}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-sm text-slate-500 flex items-center gap-2 bg-white p-2 rounded-lg border border-dashed border-slate-300">
                            <AlertTriangle size={16} className="text-amber-500" />
                            Свободная задача
                          </div>
                          {canClaim && (
                             <button 
                               disabled={isAssigning}
                               onClick={() => handleClaimOrAssign(currentUser.id.toString())}
                               className="w-full text-sm bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-all font-medium flex items-center justify-center gap-2 shadow-sm"
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
                  <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">Постановщик</div>
                  <div className="flex items-center gap-2">
                    {creator ? (
                      <>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ backgroundColor: `hsl(${parseInt(creator.id.toString()) * 100 % 360}, 70%, 50%)` }}
                        >
                          {getAssigneeInitials(creator)}
                        </div>
                        <span className="text-sm text-slate-700">{creator.rank} {getAssigneeFullName(creator)}</span>
                      </>
                    ) : <span className="text-sm text-slate-500">Система</span>}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">Подразделение</div>
                  <span className="text-sm text-slate-700 font-medium flex items-center gap-1.5">
                    <Users size={14} className="text-slate-400" />
                    {unit?.name || '—'}
                  </span>
                </div>

                <div>
                  <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">Дедлайн</div>
                  <span className={cn(
                    "text-sm font-semibold flex items-center gap-1.5",
                    new Date(task.deadline) < new Date() && task.status !== 'done' ? "text-red-600" : "text-slate-700"
                  )}>
                    <Calendar size={12} />
                    {new Date(task.deadline).toLocaleString('ru-RU', {
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>

              {task.tags.length > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">Метки</div>
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {task.subtasks && task.subtasks.length > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] font-medium text-slate-400 uppercase mb-2">Подзадачи</div>
                  <div className="space-y-1.5">
                    {task.subtasks.map(st => (
                      <label key={st.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={st.done}
                          onChange={async () => {
                            // Логика подзадач
                          }}
                          className="rounded border-slate-300 text-green-700 focus:ring-green-700"
                        />
                        <span className={cn('text-sm', st.done ? 'line-through text-slate-400' : 'text-slate-700')}>{st.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {allowedStatuses.length > 0 && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <div className="text-[10px] font-medium text-slate-400 uppercase mb-2">Изменить статус вручную</div>
                  <div className="flex flex-wrap gap-1.5">
                    {allowedStatuses.map(col => (
                      <button
                        key={col.id}
                        onClick={async () => {
                          await api.moveTask(parseInt(task.id), col.id, 0);
                        }}
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                          task.status === col.id
                            ? 'border-green-700 bg-green-50 text-green-700 font-medium'
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
              <h3 className="text-sm font-medium text-slate-700">Вложения задачи</h3>
              {renderFileList(task.attachments || [])}
            </div>
          )}

          {activeTab === 'submission' && (
            <TaskSubmission
              task={task}
            />
          )}
        </div>

        <div className="p-6 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-slate-400">
              Создано: {new Date(task.createdAt).toLocaleDateString('ru-RU')}
            </div>
            {showConfirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">Удалить задачу?</span>
                <button
                  onClick={() => onDelete(task.id)}
                  className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Да
                </button>
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  Нет
                </button>
              </div>
            ) : (
              isLeader && (
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
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

// ========== TaskComments Component ==========
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
      console.error('Ошибка отправки комментария:', error);
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
            <div key={att.id} className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 border border-slate-200">
              {fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <Image size={12} className="text-slate-400" />
              ) : (
                <FileText size={12} className="text-slate-400" />
              )}
              <span className="text-xs text-slate-600 max-w-[100px] truncate">{fileName}</span>
              <a
                href={fileUrl}
                download={fileName}
                className="ml-1 p-0.5 hover:bg-slate-200 rounded"
                target="_blank"
                rel="noopener noreferrer"
              >
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
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs">
                    {initials}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-800">
                      {rank} {fullName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatDate(date)}
                    </span>
                  </div>

                  {editingCommentId === comment.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
                          className="text-xs px-2 py-1 bg-green-700 text-white rounded hover:bg-green-800"
                        >
                          Сохранить
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
                        >
                          Отмена
                        </button>
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
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={() => startEditing(comment)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded"
                      title="Редактировать"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                      title="Удалить"
                    >
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
          <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-2">
              <Paperclip size={12} />
              Прикреплённые файлы:
            </div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border border-slate-200 shadow-sm">
                  {file.type.startsWith('image/') ? (
                    <Image size={12} className="text-slate-400" />
                  ) : (
                    <FileText size={12} className="text-slate-400" />
                  )}
                  <span className="text-xs text-slate-600 max-w-[150px] truncate">{file.name}</span>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="ml-1 p-0.5 hover:bg-slate-100 rounded"
                  >
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
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30 resize-none min-h-[80px]"
          />

          <div className="flex flex-col gap-1">
            <div className="relative">
              <button
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                className="p-2 text-slate-400 hover:text-green-700 hover:bg-slate-50 rounded-lg transition-colors"
                title="Прикрепить файл"
              >
                <Paperclip size={18} />
              </button>

              {showAttachmentMenu && (
                <div className="absolute bottom-full right-0 mb-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[150px] z-10">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FileText size={14} />
                    Документ
                  </button>
                  <button
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'image/*';
                        fileInputRef.current.click();
                      }
                    }}
                    className="w-full px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Image size={14} />
                    Изображение
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleSendComment}
              disabled={isSending || (!newComment.trim() && attachments.length === 0)}
              className="p-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Отправить"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
        />
      </div>

      <div className="text-[10px] text-slate-400">
        Enter для отправки • Shift+Enter для новой строки
      </div>
    </div>
  );
}

// ========== TaskSubmission Component ==========
function TaskSubmission({ task }: {
  task: Task;
}) {
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
      console.error('Failed to submit task:', error);
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
      console.error(error);
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
        <CheckCircle size={18} className="text-green-700" />
        <h3 className="font-bold text-slate-800">Результаты работы</h3>
      </div>

      {task.submission && (
        <div className={cn(
          'p-4 rounded-2xl border-l-4',
          task.submission.status === 'approved' ? 'bg-green-50 border-green-500' :
          task.submission.status === 'rejected' ? 'bg-red-50 border-red-500' :
          'bg-amber-50 border-amber-500'
        )}>
          <div className="flex items-center justify-between mb-3">
             <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Текущий статус отчета</span>
             <span className="text-xs font-medium px-2 py-1 rounded-full bg-white border border-slate-100 shadow-sm">
               {task.submission.status === 'approved' ? '✅ Принят' :
                task.submission.status === 'rejected' ? '❌ Возвращен' : '⏳ Ожидает проверки'}
             </span>
          </div>

          <p className="text-sm text-slate-700 bg-white/50 p-3 rounded-xl mb-3 border border-white/50">
            {task.submission.comment || 'Без комментария'}
          </p>

          {task.submission.files && task.submission.files.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {task.submission.files.map((f: any) => (
                <a key={f.id} href={f.file || f.fileUrl} target="_blank" className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100 hover:border-blue-300 transition-all">
                  <FileText size={14} className="text-blue-500" />
                  <span className="text-xs truncate flex-1">{f.filename || f.fileName || 'Документ'}</span>
                  <Download size={12} className="text-slate-400" />
                </a>
              ))}
            </div>
          )}

          {task.submission.reviewComment && (
            <div className="mt-3 p-3 bg-white border border-slate-100 rounded-lg text-sm shadow-sm">
              <span className="font-semibold text-slate-700 block mb-1">Вердикт проверяющего:</span>
              <p className="text-slate-600">{task.submission.reviewComment}</p>
            </div>
          )}
          
          {isAssignee && task.status === 'review' && (
             <div className="mt-4 pt-4 border-t border-amber-200">
               <button
                 onClick={handleWithdraw}
                 disabled={submitting}
                 className="w-full py-2 bg-white border border-amber-300 text-amber-700 rounded-xl hover:bg-amber-100 transition-all font-medium flex items-center justify-center gap-2"
               >
                 <RefreshCw size={16} /> Отозвать с проверки для редактирования
               </button>
             </div>
          )}
        </div>
      )}

      {canSubmit && (
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Прикрепить отчетные документы</label>
          <div className="flex gap-2 mb-4">
             <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all text-sm font-medium">
               <Upload size={16} /> Выбрать файлы
             </button>
             <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
          </div>

          {files.length > 0 && (
            <div className="mb-4 space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg text-xs border border-slate-100">
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
            className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-4 focus:ring-green-700/10 focus:border-green-700 outline-none transition-all h-24 mb-4"
          />

          <button
            onClick={handleSubmit}
            disabled={submitting || (files.length === 0 && !comment.trim())}
            className="w-full py-3 bg-green-700 text-white rounded-xl hover:bg-green-800 disabled:opacity-50 font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-700/20 transition-all"
          >
            {submitting ? 'Отправка...' : <><Send size={18} /> Сдать задание</>}
          </button>
        </div>
      )}

      {canReview && (
        <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
          <label className="block text-xs font-bold text-blue-600 uppercase mb-3 text-center">Проверка выполнения</label>
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Ваш вердикт или замечания для доработки..."
            className="w-full p-3 text-sm border border-blue-200 rounded-xl focus:ring-4 focus:ring-blue-700/10 focus:border-blue-700 outline-none transition-all h-24 mb-4"
          />
          <div className="flex gap-3">
            <button
              onClick={() => handleReviewAction(true)}
              disabled={submitting}
              className="flex-1 py-3 bg-green-700 text-white rounded-xl hover:bg-green-800 transition-all font-bold flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} /> Принять
            </button>
            <button
              onClick={() => handleReviewAction(false)}
              disabled={submitting || !reviewComment.trim()}
              className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              title="Для возврата на доработку нужен комментарий"
            >
              <X size={18} /> Доработка
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== AddTaskModal Component ==========
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
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-800">Новая задача</h2>
            <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Название *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30 focus:border-green-700"
                placeholder="Введите название задачи"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Описание</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30 focus:border-green-700 resize-none"
                placeholder="Описание задачи"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Приоритет</label>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30">
                <option value="critical">Критический</option>
                <option value="high">Высокий</option>
                <option value="medium">Средний</option>
                <option value="low">Низкий</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Подразделение *</label>
              <select
                value={selectedUnitId}
                onChange={e => handleUnitChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
                required
              >
                <option value="">Выберите подразделение</option>
                {units.map((u: any) => (
                  <option key={u.id} value={u.id.toString()}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Исполнитель (необязательно)</label>
              <select
                value={selectedUserId}
                onChange={e => handleUserChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
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
              <label className="text-xs font-medium text-slate-600 mb-1 block">Вложения (файлы любых форматов)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => document.getElementById('task-attachments')?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <Upload size={14} />
                  Выбрать файлы
                </button>
                <input
                  id="task-attachments"
                  type="file"
                  onChange={handleAttachmentSelect}
                  className="hidden"
                  multiple
                />
              </div>
              {attachmentFiles.length > 0 && (
                <div className="mt-2 space-y-2">
                  {attachmentFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      {file.type?.startsWith('image/') ? (
                        <Image size={16} className="text-slate-400" />
                      ) : (
                        <FileText size={16} className="text-slate-400" />
                      )}
                      <span className="text-sm text-slate-600 flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-slate-400">{formatFileSize(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachmentFile(index)}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        <X size={14} className="text-slate-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Дедлайн (дата и время)</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30 focus:border-green-700"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Метки (через запятую)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30 focus:border-green-700"
                placeholder="план, отчет, проверка"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}