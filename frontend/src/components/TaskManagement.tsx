import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { KanbanBoard } from './KanbanBoard';
import { Statistics } from './Statistics';
import { Download, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Task } from '@/types';
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

// Строгий стиль тулбара календаря
const CustomToolbar = (toolbar: any) => {
  const goToBack = () => toolbar.onNavigate('PREV');
  const goToNext = () => toolbar.onNavigate('NEXT');
  const goToCurrent = () => toolbar.onNavigate('TODAY');

  const label = () => {
    return <span className="uppercase tracking-wider">{format(toolbar.date, 'LLLL yyyy', { locale: ru })}</span>;
  };

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <button onClick={goToCurrent} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 transition-colors">
          Сегодня
        </button>
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md p-0.5">
          <button onClick={goToBack} className="p-1 hover:bg-white rounded text-slate-500 hover:text-slate-800 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={goToNext} className="p-1 hover:bg-white rounded text-slate-500 hover:text-slate-800 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <CalendarDays size={16} className="text-slate-500" />
        {label()}
      </div>
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md p-0.5">
        <button onClick={() => toolbar.onView('month')} className={cn("px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md", toolbar.view === 'month' ? "bg-white shadow-sm border border-slate-200 text-green-700" : "text-slate-500 hover:text-slate-800 border border-transparent")}>Месяц</button>
        <button onClick={() => toolbar.onView('agenda')} className={cn("px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md", toolbar.view === 'agenda' ? "bg-white shadow-sm border border-slate-200 text-green-700" : "text-slate-500 hover:text-slate-800 border border-transparent")}>Расписание</button>
      </div>
    </div>
  );
};

const CustomEvent = ({ event }: any) => {
  return (
    <div className="text-[10px] uppercase tracking-wider font-bold truncate px-1 py-0.5" title={event.title}>
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
  const [showReportModal, setShowReportModal] = useState(false);

  // Оставляем только базовый поиск для Статистики и Календаря (поскольку доска фильтрует внутри себя)
  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    
    const query = searchQuery.toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(query) ||
      (t.description && t.description.toLowerCase().includes(query)) ||
      (t.tags && t.tags.some(tag => tag.toLowerCase().includes(query)))
    );
  }, [tasks, searchQuery]);

  return (
    <div className="space-y-6">
      
      {/* 1. ЗАГОЛОВОК */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 uppercase tracking-widest">Управление задачами</h1>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
          {user?.role === 'commander' && 'Полный доступ ко всем задачам'}
          {user?.role === 'deputy_commander' && 'Полный доступ ко всем задачам'}
          {user?.role === 'department_head' && 'Управление задачами отдела'}
          {user?.role === 'group_head' && 'Управление задачами группы'}
          {user?.role === 'subordinate' && 'Мои задачи'}
        </p>
      </div>

      {/* 2. НАВИГАЦИЯ И ДЕЙСТВИЯ */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-md border border-slate-200">
          <button
            onClick={() => setViewMode('kanban')}
            className={cn(
              "px-6 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors",
              viewMode === 'kanban' ? "bg-white text-green-700 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
            )}
          >
            Канбан
          </button>
          <button
            onClick={() => setViewMode('stats')}
            className={cn(
              "px-6 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors",
              viewMode === 'stats' ? "bg-white text-green-700 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
            )}
          >
            Статистика
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={cn(
              "px-6 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors",
              viewMode === 'calendar' ? "bg-white text-green-700 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
            )}
          >
            Календарь
          </button>
        </div>

        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-white border border-green-600 text-green-700 rounded-md hover:bg-green-50 shadow-sm"
        >
          <Download size={14} /> Отчёт
        </button>
      </div>

      {/* 3. КОНТЕНТНАЯ ОБЛАСТЬ */}
      <div className="pt-2">
        {viewMode === 'kanban' && (
          <KanbanBoard
            tasks={filteredTasks}
            onTasksChange={onTasksChange}
            searchQuery={searchQuery}
          />
        )}
        
        {viewMode === 'stats' && <Statistics tasks={filteredTasks} />}
        
        {viewMode === 'calendar' && (
          <div className="bg-white rounded-md border border-slate-200 p-5 shadow-sm h-[700px]">
            <style>{`
              .rbc-agenda-time-cell { display: none !important; }
              .rbc-time-column { display: none !important; }
              /* Строгий зеленый стиль событий */
              .rbc-event { 
                background-color: #f0fdf4 !important; 
                color: #15803d !important; 
                border: 1px solid #bbf7d0 !important; 
                border-radius: 4px !important; 
                padding: 2px 4px !important;
              }
              .rbc-event.rbc-selected { 
                background-color: #dcfce7 !important; 
                border-color: #86efac !important;
              }
              .rbc-today { background-color: #f8fafc !important; }
              .rbc-month-view { border-radius: 6px; overflow: hidden; border-color: #e2e8f0; border-width: 1px; }
              .rbc-header { padding: 10px 0; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0 !important; }
              .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #e2e8f0 !important; }
              .rbc-month-row + .rbc-month-row { border-top: 1px solid #e2e8f0 !important; }
              .rbc-date-cell { padding: 4px 8px; font-weight: 600; font-size: 12px; color: #475569; }
              .rbc-off-range-bg { background-color: #f8fafc; }
            `}</style>
            <BigCalendar
              localizer={localizer}
              culture="ru"
              messages={messages}
              views={['month', 'agenda']}
              defaultView="month"
              events={filteredTasks
                .filter(t => t.status === 'todo' || t.status === 'in_progress' || t.status === 'review')
                .filter(t => t.deadline)
                .map(t => ({
                  id: t.id,
                  title: t.title,
                  start: new Date(t.deadline),
                  end: new Date(t.deadline),
                  resource: t,
                }))}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              onSelectEvent={(event) => {
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
      </div>

      {showReportModal && <ReportGenerator onClose={() => setShowReportModal(false)} />}
    </div>
  );
}