import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { KanbanBoard } from './KanbanBoard';
import { Statistics } from './Statistics';
import { LayoutGrid, BarChart3, Filter, Calendar, Users, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/cn';
import api from '@/services/api';
import type { Task, OrgUnit } from '@/types';

interface TaskManagementProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  searchQuery: string;
}

export function TaskManagement({ tasks, onTasksChange, searchQuery }: TaskManagementProps) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'kanban' | 'stats'>('kanban');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Загрузка подразделений
  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      const unitsData = await api.getUnits();
      setUnits(Array.isArray(unitsData) ? unitsData : (unitsData.results || []));
    } catch (error) {
      console.error('Failed to load units:', error);
    }
  };

  // Фильтрация задач
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Подразделение
    if (selectedUnit !== 'all') {
      filtered = filtered.filter(t => t.unitId === selectedUnit);
    }

    // Приоритет
    if (selectedPriority !== 'all') {
      filtered = filtered.filter(t => t.priority === selectedPriority);
    }

    // Даты
    const now = new Date();
    if (selectedDateRange === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      filtered = filtered.filter(t => t.deadline?.startsWith(todayStr));
    } else if (selectedDateRange === 'week') {
      const weekLater = new Date(now);
      weekLater.setDate(weekLater.getDate() + 7);
      filtered = filtered.filter(t => {
        const deadline = new Date(t.deadline);
        return deadline >= now && deadline <= weekLater;
      });
    } else if (selectedDateRange === 'month') {
      const monthLater = new Date(now);
      monthLater.setMonth(monthLater.getMonth() + 1);
      filtered = filtered.filter(t => {
        const deadline = new Date(t.deadline);
        return deadline >= now && deadline <= monthLater;
      });
    }

    return filtered;
  }, [tasks, searchQuery, selectedUnit, selectedPriority, selectedDateRange]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'done').length;
    const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length;
    const overdue = filteredTasks.filter(t => 
      new Date(t.deadline) < new Date() && t.status !== 'done'
    ).length;
    return { total, completed, inProgress, overdue };
  }, [filteredTasks]);

  const handleTasksChange = (newTasks: Task[]) => {
    onTasksChange(newTasks);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Управление задачами</h1>
          <p className="text-sm text-slate-500 mt-1">
            {user?.role === 'commander' && 'Полный доступ ко всем задачам'}
            {user?.role === 'deputy_commander' && 'Полный доступ ко всем задачам'}
            {user?.role === 'department_head' && 'Управление задачами отдела'}
            {user?.role === 'group_head' && 'Управление задачами группы'}
            {user?.role === 'subordinate' && 'Мои задачи'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1',
                viewMode === 'kanban'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              )}
            >
              <LayoutGrid size={16} />
              <span className="hidden sm:inline">Канбан</span>
            </button>
            <button
              onClick={() => setViewMode('stats')}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1',
                viewMode === 'stats'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              )}
            >
              <BarChart3 size={16} />
              <span className="hidden sm:inline">Статистика</span>
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors',
              showFilters ? 'border-green-700 text-green-700 bg-green-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            <Filter size={14} />
            Фильтры
            {(selectedUnit !== 'all' || selectedPriority !== 'all' || selectedDateRange !== 'all') && (
              <span className="ml-1 w-2 h-2 bg-green-700 rounded-full" />
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Всего задач</div>
          <div className="text-xl font-bold text-slate-800">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <div className="text-xs text-slate-500">В работе</div>
          <div className="text-xl font-bold text-blue-600">{stats.inProgress}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Выполнено</div>
          <div className="text-xl font-bold text-green-700">{stats.completed}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Просрочено</div>
          <div className="text-xl font-bold text-red-600">{stats.overdue}</div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-400" />
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-700/30"
            >
              <option value="all">Все подразделения</option>
              {units.map(unit => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-slate-400" />
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-700/30"
            >
              <option value="all">Все приоритеты</option>
              <option value="critical">Критический</option>
              <option value="high">Высокий</option>
              <option value="medium">Средний</option>
              <option value="low">Низкий</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value as any)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-700/30"
            >
              <option value="all">Все даты</option>
              <option value="today">Сегодня</option>
              <option value="week">На этой неделе</option>
              <option value="month">В этом месяце</option>
            </select>
          </div>

          {(selectedUnit !== 'all' || selectedPriority !== 'all' || selectedDateRange !== 'all') && (
            <button
              onClick={() => {
                setSelectedUnit('all');
                setSelectedPriority('all');
                setSelectedDateRange('all');
              }}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      )}

      {viewMode === 'kanban' ? (
        <KanbanBoard
          tasks={filteredTasks}
          onTasksChange={handleTasksChange}
          searchQuery={searchQuery}
        />
      ) : (
        <Statistics tasks={filteredTasks} units={units} />
      )}
    </div>
  );
}