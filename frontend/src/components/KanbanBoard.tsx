import { useState } from 'react';
import { 
  GripVertical, Calendar, Plus, X, AlertTriangle, 
  Filter, Tag
} from 'lucide-react';
import type { Task, TaskStatus, Priority } from '@/types';
import { users, orgUnits } from '@/data/mockData';
import { cn } from '@/utils/cn';
import { v4 as uuidv4 } from 'uuid';

interface KanbanBoardProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  searchQuery: string;
}

const columns: { id: TaskStatus; label: string; color: string; bg: string }[] = [
  { id: 'backlog', label: 'Запланировано', color: 'border-slate-400', bg: 'bg-slate-50' },
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

export function KanbanBoard({ tasks, onTasksChange, searchQuery }: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

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

  const handleDrop = (status: TaskStatus) => {
    if (draggedTask) {
      onTasksChange(tasks.map(t => t.id === draggedTask ? { ...t, status } : t));
      setDraggedTask(null);
    }
  };

  const handleAddTask = (task: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      ...task,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    onTasksChange([...tasks, newTask]);
    setShowAddModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Канбан-доска</h1>
          <p className="text-sm text-slate-500 mt-1">Управление задачами подразделений</p>
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
              {orgUnits.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
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

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => {
          const colTasks = filteredTasks.filter(t => t.status === col.id);
          return (
            <div
              key={col.id}
              className="flex-shrink-0 w-72"
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

      {/* Add Task Modal */}
      {showAddModal && (
        <AddTaskModal onClose={() => setShowAddModal(false)} onAdd={handleAddTask} />
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updated) => {
            onTasksChange(tasks.map(t => t.id === updated.id ? updated : t));
            setSelectedTask(updated);
          }}
          onDelete={(id) => {
            onTasksChange(tasks.filter(t => t.id !== id));
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onDragStart, onClick }: { task: Task; onDragStart: () => void; onClick: () => void }) {
  const assignee = users.find(u => u.id === task.assigneeId);
  const unit = orgUnits.find(u => u.id === task.unitId);
  const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'done';
  const pConfig = priorityConfig[task.priority];
  const subtasksDone = task.subtasks?.filter(s => s.done).length ?? 0;
  const subtasksTotal = task.subtasks?.length ?? 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group"
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-slate-300 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', pConfig.bg, pConfig.color)}>
              {pConfig.label}
            </span>
            {isOverdue && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-0.5">
                <AlertTriangle size={8} /> Просрочено
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-slate-800 mb-1 line-clamp-2">{task.title}</h4>
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
                {new Date(task.deadline).toLocaleDateString('ru-RU')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {unit && (
                <span className="text-[9px] px-1 py-0.5 bg-slate-100 text-slate-500 rounded">
                  {unit.name}
                </span>
              )}
              {assignee && (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                  style={{ backgroundColor: assignee.avatarColor }}
                  title={`${assignee.rank} ${assignee.fullName}`}
                >
                  {assignee.fullName.split(' ').map(n => n[0]).join('')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskDetailModal({ task, onClose, onUpdate, onDelete }: {
  task: Task;
  onClose: () => void;
  onUpdate: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const assignee = users.find(u => u.id === task.assigneeId);
  const creator = users.find(u => u.id === task.creatorId);
  const unit = orgUnits.find(u => u.id === task.unitId);
  const pConfig = priorityConfig[task.priority];
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded', pConfig.bg, pConfig.color)}>
                  {pConfig.label}
                </span>
                <span className="text-xs text-slate-400">#{task.id.slice(0, 6)}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-800">{task.title}</h2>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          <p className="text-sm text-slate-600 mb-4">{task.description}</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">Исполнитель</div>
              <div className="flex items-center gap-2">
                {assignee && (
                  <>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                      style={{ backgroundColor: assignee.avatarColor }}
                    >
                      {assignee.fullName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm text-slate-700">{assignee.rank} {assignee.fullName}</span>
                  </>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">Постановщик</div>
              <div className="flex items-center gap-2">
                {creator && (
                  <>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                      style={{ backgroundColor: creator.avatarColor }}
                    >
                      {creator.fullName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm text-slate-700">{creator.rank} {creator.fullName}</span>
                  </>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">Подразделение</div>
              <span className="text-sm text-slate-700">{unit?.name}</span>
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">Дедлайн</div>
              <span className="text-sm text-slate-700 flex items-center gap-1">
                <Calendar size={12} />
                {new Date(task.deadline).toLocaleDateString('ru-RU')}
              </span>
            </div>
          </div>

          {task.tags.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">Метки</div>
              <div className="flex flex-wrap gap-1">
                {task.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Subtasks */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-medium text-slate-400 uppercase mb-2">Подзадачи</div>
              <div className="space-y-1.5">
                {task.subtasks.map(st => (
                  <label key={st.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={st.done}
                      onChange={() => {
                        const updated = {
                          ...task,
                          subtasks: task.subtasks!.map(s => s.id === st.id ? { ...s, done: !s.done } : s),
                        };
                        onUpdate(updated);
                      }}
                      className="rounded border-slate-300 text-green-700 focus:ring-green-700"
                    />
                    <span className={cn('text-sm', st.done ? 'line-through text-slate-400' : 'text-slate-700')}>{st.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Status Change */}
          <div className="mb-4">
            <div className="text-[10px] font-medium text-slate-400 uppercase mb-2">Статус</div>
            <div className="flex flex-wrap gap-1.5">
              {columns.map(col => (
                <button
                  key={col.id}
                  onClick={() => onUpdate({ ...task, status: col.id })}
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

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="text-[10px] text-slate-400">
              Создано: {new Date(task.createdAt).toLocaleDateString('ru-RU')}
            </div>
            {showConfirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">Удалить задачу?</span>
                <button
                  onClick={() => onDelete(task.id)}
                  className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Да
                </button>
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
                >
                  Нет
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Удалить
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddTaskModal({ onClose, onAdd }: { onClose: () => void; onAdd: (t: Omit<Task, 'id' | 'createdAt'>) => void }) {
  const today = new Date().toISOString().split('T')[0];
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>('backlog');
  const [assigneeId, setAssigneeId] = useState(users[0].id);
  const [unitId, setUnitId] = useState(orgUnits[0].id);
  const [deadline, setDeadline] = useState(today);
  const [tagsInput, setTagsInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      title,
      description,
      priority,
      status,
      assigneeId,
      creatorId: 'u1',
      unitId,
      deadline,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
    });
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
            <div className="grid grid-cols-2 gap-4">
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
                <label className="text-xs font-medium text-slate-600 mb-1 block">Статус</label>
                <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30">
                  {columns.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Исполнитель</label>
                <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30">
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.rank} {u.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Подразделение</label>
                <select value={unitId} onChange={e => setUnitId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30">
                  {orgUnits.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Дедлайн</label>
              <input
                type="date"
                value={deadline}
                min={today}
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
            <button type="submit" className="px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800">
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}