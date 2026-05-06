import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { KanbanBoard } from './KanbanBoard';
import { Statistics } from './Statistics';
import { LayoutGrid, BarChart3, Filter, Calendar, Users, AlertTriangle, Download, RefreshCw, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/utils/cn';
import api from '@/services/api';
import type { Task, OrgUnit } from '@/types';
import { ReportGenerator } from '@/components/ReportGenerator';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { ru };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const messages = {
  allDay: 'Весь день',
  previous: 'Назад',
  next: 'Далее',
  today: 'Сегодня',
  month: 'Месяц',
  week: 'Неделя',
  day: 'День',
  agenda: 'Расписание',
  date: 'Дата',
  time: '',
  event: 'Мероприятие',
  noEventsInRange: 'Нет мероприятий в этом диапазоне.',
  showMore: (total: number) => `+ Ещё (${total})`
};

const CustomToolbar = (toolbar: any) => {
  const goToBack = () => toolbar.onNavigate('PREV');
  const goToNext = () => toolbar.onNavigate('NEXT');
  const goToCurrent = () => toolbar.onNavigate('TODAY');

  const label = () => {
    return <span className="capitalize">{format(toolbar.date, 'LLLL yyyy', { locale: ru })}</span>;
  };

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <button onClick={goToCurrent} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors">
          Сегодня
        </button>
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
          <button onClick={goToBack} className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-800 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button onClick={goToNext} className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-800 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="text-lg font-bold text-slate-800 flex items-center gap-2">
        <CalendarDays size={20} className="text-green-700" />
        {label()}
      </div>
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
        <button onClick={() => toolbar.onView('month')} className={cn("px-3 py-1 text-sm rounded-md transition-all", toolbar.view === 'month' ? "bg-white shadow-sm border border-slate-200 text-green-700 font-medium" : "text-slate-600 hover:text-slate-800 border border-transparent")}>Месяц</button>
        <button onClick={() => toolbar.onView('agenda')} className={cn("px-3 py-1 text-sm rounded-md transition-all", toolbar.view === 'agenda' ? "bg-white shadow-sm border border-slate-200 text-green-700 font-medium" : "text-slate-600 hover:text-slate-800 border border-transparent")}>Расписание</button>
      </div>
    </div>
  );
};

const CustomEvent = ({ event }: any) => {
  return (
    <div className="text-xs font-medium truncate px-1 py-0.5" title={event.title}>
      {event.title}
    </div>
  );
};

interface TaskManagementProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  searchQuery: string;
}

export function TaskManagement({ tasks, onTasksChange, searchQuery }: TaskManagementProps) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'kanban' | 'stats' | 'calendar'>('kanban');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [updatingPlanned, setUpdatingPlanned] = useState(false);

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

  const handleUpdatePlanned = async () => {
    setUpdatingPlanned(true);
    try {
      const result = await api.updatePlannedTasks();
      if (result.updated > 0) {
        // Перезагружаем задачи
        const freshTasks = await api.getTasks();
        const tasksList = Array.isArray(freshTasks) ? freshTasks : (freshTasks.results || []);
        // Преобразуем в нужный формат (упрощённо, но в реальности нужна та же трансформация, что в App)
        onTasksChange(tasksList);
        alert(`Перемещено ${result.updated} задач в "К выполнению"`);
      }
    } catch (error) {
      console.error('Failed to update planned tasks:', error);
      alert('Ошибка при обновлении задач');
    } finally {
      setUpdatingPlanned(false);
    }
  };

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    if (selectedUnit !== 'all') {
      filtered = filtered.filter(t => t.unitId === selectedUnit);
    }
    if (selectedPriority !== 'all') {
      filtered = filtered.filter(t => t.priority === selectedPriority);
    }
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
          <button
            onClick={handleUpdatePlanned}
            disabled={updatingPlanned}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw size={14} className={updatingPlanned ? 'animate-spin' : ''} />
            Обновить статусы
          </button>

          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Download size={14} />
            Отчёт
          </button>

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
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1',
                viewMode === 'calendar'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              )}
            >
              <Calendar size={16} />
              <span className="hidden sm:inline">Календарь</span>
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

      {viewMode === 'kanban' && (
        <KanbanBoard
          tasks={filteredTasks}
          onTasksChange={handleTasksChange}
          searchQuery={searchQuery}
        />
      )}
      {viewMode === 'stats' && <Statistics tasks={filteredTasks} units={units} />}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm h-[700px]">
          <style>{`
            .rbc-agenda-time-cell { display: none !important; }
            .rbc-time-column { display: none !important; }
            .rbc-event { 
              background-color: #f0fdf4 !important; 
              color: #15803d !important; 
              border: 1px solid #bbf7d0 !important; 
              border-radius: 6px !important; 
              padding: 2px 4px !important;
            }
            .rbc-event.rbc-selected { background-color: #dcfce7 !important; }
            .rbc-today { background-color: #f8fafc !important; }
            .rbc-month-view { border-radius: 8px; overflow: hidden; border-color: #e2e8f0; border-width: 1px; }
            .rbc-header { padding: 10px 0; font-weight: 600; color: #475569; text-transform: capitalize; border-bottom: 1px solid #e2e8f0 !important; }
            .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #e2e8f0 !important; }
            .rbc-month-row + .rbc-month-row { border-top: 1px solid #e2e8f0 !important; }
            .rbc-date-cell { padding: 4px 8px; font-weight: 500; color: #64748b; }
            .rbc-off-range-bg { background-color: #f8fafc; }
          `}</style>
          <BigCalendar
            localizer={localizer}
            culture="ru"
            messages={messages}
            views={['month', 'agenda']}
            defaultView="month"
            events={filteredTasks
              .filter(t => t.status === 'planned' && (t.start_date || t.deadline))
              .map(t => ({
                id: t.id,
                title: t.title,
                start: t.start_date ? new Date(t.start_date) : new Date(t.deadline),
                end: t.end_date ? new Date(t.end_date) : new Date(t.deadline),
                resource: t,
              }))}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            onSelectEvent={(event) => {
              // TODO: открыть модалку с деталями задачи
              console.log('Task clicked', event.resource);
            }}
            formats={{
              eventTimeRangeFormat: () => '',
              agendaTimeRangeFormat: () => '',
              agendaTimeFormat: () => '',
              timeGutterFormat: () => '',
            }}
            components={{
              toolbar: CustomToolbar,
              event: CustomEvent,
              agenda: {
                time: () => null
              }
            }}
          />
        </div>
      )}

      {showReportModal && <ReportGenerator onClose={() => setShowReportModal(false)} />}
    </div>
  );
}