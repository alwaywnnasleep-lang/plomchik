import { useState, useMemo } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { 
  ChevronLeft, ChevronRight, CalendarDays, Filter, 
  Target, Users
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Task, OrgUnit, User as UserType } from '@/types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Встроенный парсер дат (чтобы не зависеть от других файлов)
const parseSafeDate = (dateStr: any): Date | null => {
  if (!dateStr) return null;
  if (typeof dateStr === 'string') {
    const match1 = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (match1) {
      const hours = match1[4] ? Number(match1[4]) : 12;
      const mins = match1[5] ? Number(match1[5]) : 0;
      return new Date(Number(match1[3]), Number(match1[2]) - 1, Number(match1[1]), hours, mins, 0);
    }
    const match2 = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T|$)/);
    if (match2) {
      return new Date(Number(match2[1]), Number(match2[2]) - 1, Number(match2[3]), 12, 0, 0);
    }
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) { d.setHours(12, 0, 0, 0); return d; }
  return null;
};

const locales = { ru };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

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
  time: 'Время',
  event: 'Мероприятие',
  noEventsInRange: 'Нет записей в данном периоде.',
  showMore: (total: number) => `+ Ещё (${total})`
};

interface CalendarBoardProps {
  tasks: Task[];
  units?: OrgUnit[];
  users?: UserType[];
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
}

const CustomToolbar = (toolbar: any) => {
  const goToBack = () => toolbar.onNavigate('PREV');
  const goToNext = () => toolbar.onNavigate('NEXT');
  const goToCurrent = () => toolbar.onNavigate('TODAY');

  const label = <span className="uppercase tracking-wider">{format(toolbar.date, 'LLLL yyyy', { locale: ru })}</span>;

  return (
    <div className="flex items-center justify-between mb-4 bg-white p-3 border border-slate-200 rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <button onClick={goToCurrent} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider border border-slate-300 rounded-md hover:bg-slate-100 text-slate-700 transition-colors">
          Сегодня
        </button>
        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-md p-0.5">
          <button onClick={goToBack} className="p-1 hover:bg-white rounded text-slate-500 hover:text-slate-800 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={goToNext} className="p-1 hover:bg-white rounded text-slate-500 hover:text-slate-800 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      
      <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <CalendarDays size={18} className="text-slate-500" />
        {label}
      </div>
      
      <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-md p-0.5">
        <button onClick={() => toolbar.onView('month')} className={cn("px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md", toolbar.view === 'month' ? "bg-slate-700 shadow-sm text-white" : "text-slate-500 hover:text-slate-800 border border-transparent")}>Месяц</button>
        <button onClick={() => toolbar.onView('week')} className={cn("px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md", toolbar.view === 'week' ? "bg-slate-700 shadow-sm text-white" : "text-slate-500 hover:text-slate-800 border border-transparent")}>Неделя</button>
        <button onClick={() => toolbar.onView('day')} className={cn("px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md", toolbar.view === 'day' ? "bg-slate-700 shadow-sm text-white" : "text-slate-500 hover:text-slate-800 border border-transparent")}>День</button>
        <button onClick={() => toolbar.onView('agenda')} className={cn("px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md", toolbar.view === 'agenda' ? "bg-slate-700 shadow-sm text-white" : "text-slate-500 hover:text-slate-800 border border-transparent")}>Список</button>
      </div>
    </div>
  );
};

export function CalendarBoard({ tasks = [] }: CalendarBoardProps) {
  const [filterType, setFilterType] = useState<string>('all');

  const getEventType = (task: Task) => {
    const rawTags: any = task.tags || []; 
    const tagsArray: any[] = Array.isArray(rawTags) ? rawTags : (typeof rawTags === 'string' ? rawTags.split(',') : []);
    const tags = tagsArray.map((t: any) => typeof t === 'string' ? t.trim().toLowerCase() : '');
    
    // Если стоит флаг is_milestone или есть тег 'мероприятие' -> это Мероприятие
    if (task.is_milestone || tags.includes('мероприятие')) return 'event';
    
    // Иначе -> это обычная Задача
    return 'task';
  };

  const events = useMemo(() => {
    // В календарь берем всё, кроме удаленного в архив
    const activeTasks = tasks.filter(t => !t.is_archived);

    return activeTasks
      .filter(t => filterType === 'all' || getEventType(t) === filterType)
      .map(t => {
        let start = parseSafeDate(t.deadline || t.start_date || t.createdAt) || new Date();

        return {
          id: t.id,
          title: t.title || 'Без названия',
          start,
          end: new Date(start.getTime() + 60 * 60 * 1000), // +1 час для отображения блоком
          type: getEventType(t),
          resource: t
        };
      });
  }, [tasks, filterType]);

  const eventStyleGetter = (event: any) => {
    const isEvent = event.type === 'event';
    const isDone = event.resource.status === 'done' || event.resource.status === 'completed';
    
    return {
      style: {
        // Зеленый для МП, Оранжевый для Задач (Серый для выполненных)
        backgroundColor: isDone ? '#e2e8f0' : (isEvent ? '#22c55e' : '#f97316'), 
        borderColor: isDone ? '#cbd5e1' : (isEvent ? '#16a34a' : '#ea580c'),
        color: isDone ? '#64748b' : 'white',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 'bold',
        opacity: isDone ? 0.8 : 1,
        display: 'block'
      }
    };
  };

  const CustomEventComponent = ({ event }: any) => {
    const isDone = event.resource.status === 'done' || event.resource.status === 'completed';
    const isEvent = event.type === 'event';

    return (
      <div className="flex items-center gap-1.5 px-1 py-0.5" title={event.title}>
        {isEvent ? <Users size={10} className={isDone ? 'opacity-50' : ''} /> : <Target size={10} className={isDone ? 'opacity-50' : ''} />}
        
        <span className={cn("text-[10px] font-bold uppercase tracking-wider truncate", isDone && "line-through opacity-70")}>
          {event.title}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between bg-white p-3 rounded-md border border-slate-200">
        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#22c55e] border border-[#16a34a]"></span>
            Мероприятия
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#f97316] border border-[#ea580c]"></span>
            Задачи
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select 
            className="text-xs font-bold uppercase tracking-wider border border-slate-200 rounded px-2 py-1 outline-none focus:border-slate-400 bg-white"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Все записи</option>
            <option value="task">Только задачи</option>
            <option value="event">Только мероприятия</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-md border border-slate-200 p-4 shadow-sm flex-1 min-h-[750px]">
        <style>{`
          .rbc-month-view { border-radius: 4px; overflow: hidden; border-color: #e2e8f0; border-width: 1px; }
          .rbc-header { padding: 8px 0; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 1px solid #e2e8f0 !important; background: #f8fafc; }
          .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #e2e8f0 !important; }
          .rbc-month-row + .rbc-month-row { border-top: 1px solid #e2e8f0 !important; }
          .rbc-date-cell { padding: 4px 6px; font-weight: 700; font-size: 11px; color: #475569; }
          .rbc-off-range-bg { background-color: #f1f5f9; opacity: 0.5; }
          .rbc-today { background-color: #f0fdf4 !important; }
          .rbc-time-view { border-color: #e2e8f0; border-radius: 4px; }
          .rbc-time-header.rbc-overflowing { border-right: none; }
          .rbc-time-content { border-top: 1px solid #e2e8f0; }
        `}</style>
        
        <BigCalendar
          localizer={localizer}
          culture="ru"
          messages={messages}
          events={events}
          startAccessor="start"
          endAccessor="end"
          defaultView={Views.MONTH}
          views={['month', 'week', 'day', 'agenda']}
          style={{ height: '100%' }}
          eventPropGetter={eventStyleGetter}
          components={{
            toolbar: CustomToolbar,
            event: CustomEventComponent,
          }}
        />
      </div>
    </div>
  );
}