import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar as BigCalendar, dateFnsLocalizer, Views, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { 
  ChevronLeft, ChevronRight, CalendarDays, Filter, 
  Target, Users, X, Save, Clock, Trash2
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Task, OrgUnit, User as UserType } from '@/types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

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
  agenda: 'Список',
  date: 'ДАТА',
  time: 'ВРЕМЯ',
  event: 'ЗАПИСЬ',
  noEventsInRange: 'Нет записей в данном периоде.',
  showMore: (total: number) => `+ Ещё (${total})`
};

interface CalendarBoardProps {
  tasks: Task[];
  units?: OrgUnit[];
  users?: UserType[];
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onTaskAdd?: (taskData: Partial<Task>) => void;
  onTaskDelete?: (taskId: string) => void;
}

const CustomToolbar = (toolbar: any) => {
  const goToBack = () => toolbar.onNavigate('PREV');
  const goToNext = () => toolbar.onNavigate('NEXT');
  const goToCurrent = () => toolbar.onNavigate('TODAY');

  const label = <span className="uppercase tracking-wider">{format(toolbar.date, 'LLLL yyyy', { locale: ru })}</span>;

  return (
    <div className="flex items-center justify-between mb-4 bg-white p-3 border border-slate-200 rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <button onClick={goToCurrent} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider border border-slate-300 rounded-md hover:bg-slate-100 text-slate-700">
          Сегодня
        </button>
        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-md p-0.5">
          <button onClick={goToBack} className="p-1 hover:bg-white rounded text-slate-500 hover:text-slate-800">
            <ChevronLeft size={16} />
          </button>
          <button onClick={goToNext} className="p-1 hover:bg-white rounded text-slate-500 hover:text-slate-800">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      
      <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <CalendarDays size={18} className="text-slate-500" />
        {label}
      </div>
      
      <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-md p-0.5">
        <button onClick={() => toolbar.onView('month')} className={cn("px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md", toolbar.view === 'month' ? "bg-green-600 shadow-sm text-white" : "text-slate-500 hover:text-slate-800 border border-transparent")}>Месяц</button>
        <button onClick={() => toolbar.onView('week')} className={cn("px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md", toolbar.view === 'week' ? "bg-green-600 shadow-sm text-white" : "text-slate-500 hover:text-slate-800 border border-transparent")}>Неделя</button>
        <button onClick={() => toolbar.onView('day')} className={cn("px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md", toolbar.view === 'day' ? "bg-green-600 shadow-sm text-white" : "text-slate-500 hover:text-slate-800 border border-transparent")}>День</button>
        <button onClick={() => toolbar.onView('agenda')} className={cn("px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md", toolbar.view === 'agenda' ? "bg-green-600 shadow-sm text-white" : "text-slate-500 hover:text-slate-800 border border-transparent")}>Список</button>
      </div>
    </div>
  );
};

export function CalendarBoard({ tasks = [], onTaskUpdate, onTaskAdd, onTaskDelete }: CalendarBoardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterType, setFilterType] = useState<string>('all');
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; mode: 'add' | 'edit'; task?: Task; defaultDate?: Date } | null>(null);

  const currentDate = useMemo(() => {
    const d = searchParams.get('date');
    if (!d) return new Date();
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [searchParams]);

  const currentView: View = (searchParams.get('calView') as View) || Views.MONTH;

  // ИСПРАВЛЕНИЕ: Слушаем URL и автоматически открываем модалку, если есть taskId
  useEffect(() => {
    const taskId = searchParams.get('taskId');
    if (taskId && tasks.length > 0) {
      const taskToOpen = tasks.find(t => String(t.id) === taskId);
      if (taskToOpen && !modalConfig?.isOpen) {
        setModalConfig({ isOpen: true, mode: 'edit', task: taskToOpen });
      }
    }
  }, [searchParams, tasks]);

  // Функция для закрытия модалки и ОЧИСТКИ URL от taskId
  const handleCloseModal = () => {
    setModalConfig(null);
    if (searchParams.has('taskId')) {
      setSearchParams(prev => {
        prev.delete('taskId');
        return prev;
      });
    }
  };

  const handleNavigate = (newDate: Date) => {
    setSearchParams(prev => {
      prev.set('date', newDate.toISOString());
      return prev;
    });
  };

  const handleViewChange = (newView: View) => {
    setSearchParams(prev => {
      prev.set('calView', newView);
      return prev;
    });
  };

  const getEventType = (task: Task) => {
    const rawTags: any = task.tags || []; 
    const tagsArray: any[] = Array.isArray(rawTags) ? rawTags : (typeof rawTags === 'string' ? rawTags.split(',') : []);
    const tags = tagsArray.map((t: any) => typeof t === 'string' ? t.trim().toLowerCase() : '');
    
    if (task.is_milestone || tags.includes('мероприятие') || tags.includes('Мероприятие')) return 'event';
    return 'task';
  };

  const events = useMemo(() => {
    const activeTasks = tasks.filter(t => !t.is_archived);

    return activeTasks
      .filter(t => filterType === 'all' || getEventType(t) === filterType)
      .map(t => {
        let start = parseSafeDate(t.deadline || t.start_date || t.createdAt) || new Date();

        return {
          id: t.id,
          title: t.title || 'Без названия',
          start,
          end: new Date(start.getTime() + 60 * 60 * 1000), 
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
        backgroundColor: isDone ? '#e2e8f0' : (isEvent ? '#3b82f6' : '#f97316'), 
        borderColor: isDone ? '#cbd5e1' : (isEvent ? '#2563eb' : '#ea580c'),
        color: isDone ? '#64748b' : 'white',
        borderRadius: '2px',
        borderLeftWidth: '4px',
        borderTopWidth: '0',
        borderRightWidth: '0',
        borderBottomWidth: '0',
        display: 'block'
      }
    };
  };

  const CustomEventComponent = ({ event }: any) => {
    const isDone = event.resource.status === 'done' || event.resource.status === 'completed';
    const isEvent = event.type === 'event';

    return (
      <div className="flex items-center gap-1.5 overflow-hidden" title={event.title}>
        {isEvent ? <Users size={12} className={cn("shrink-0", isDone && 'opacity-50')} /> : <Target size={12} className={cn("shrink-0", isDone && 'opacity-50')} />}
        <span className={cn("text-[11px] leading-tight font-bold uppercase tracking-wider truncate", isDone && "line-through opacity-70")}>
          {event.title}
        </span>
      </div>
    );
  };

  const CustomAgendaEvent = ({ event }: any) => {
    const isDone = event.resource.status === 'done' || event.resource.status === 'completed';
    const isEvent = event.type === 'event';
    
    const bgClass = isDone ? 'bg-slate-50 border-slate-200' : (isEvent ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200');
    const textColor = isDone ? 'text-slate-500' : (isEvent ? 'text-blue-800' : 'text-orange-800');
    const timeColor = isDone ? 'text-slate-500' : (isEvent ? 'text-blue-500' : 'text-orange-500');

    return (
      <div className={cn("flex items-center gap-3 px-4 py-3 mb-2 mx-1 rounded-md border shadow-sm", bgClass)} title={event.title}>
        <div className={cn("text-[11px] font-bold w-12 text-center", timeColor)}>
          {format(event.start, 'HH:mm')}
        </div>
        <div className={cn("w-px h-5 bg-current opacity-20", textColor)}></div>
        <div className={cn("flex items-center gap-2 flex-1 overflow-hidden")}>
          {isEvent ? <Users size={12} className={cn("shrink-0", timeColor, isDone && "opacity-50")} /> : <Target size={12} className={cn("shrink-0", timeColor, isDone && "opacity-50")} />}
          <span className={cn("text-[11px] font-bold uppercase tracking-wider truncate", textColor, isDone && "line-through opacity-60")}>
            {event.title}
          </span>
        </div>
      </div>
    );
  };

  const handleSelectSlot = ({ start }: { start: Date }) => {
    setModalConfig({ isOpen: true, mode: 'add', defaultDate: start });
  };

  const handleSelectEvent = (event: any) => {
    setModalConfig({ isOpen: true, mode: 'edit', task: event.resource });
  };

  const handleSaveModal = (mode: 'add' | 'edit', data: any, taskId?: string) => {
    if (mode === 'add' && onTaskAdd) {
      onTaskAdd(data);
    } else if (mode === 'edit' && taskId && onTaskUpdate) {
      onTaskUpdate(taskId, data);
    }
    // Используем новую функцию закрытия, чтобы почистить URL
    handleCloseModal();
  };

  return (
    <div className="flex flex-col h-full space-y-4 relative">
      <div className="flex items-center justify-between bg-white p-3 rounded-md border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#3b82f6] border border-[#2563eb]"></span>
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

      <div className="bg-white rounded-md border border-slate-200 p-4 shadow-sm flex-1 min-h-[750px] overflow-auto">
        <style>{`
          .rbc-calendar { font-family: inherit; }
          .rbc-month-view, .rbc-time-view { border-radius: 4px; border-color: #e2e8f0; border-width: 1px; overflow: hidden; }
          
          .rbc-month-view .rbc-header.rbc-today, 
          .rbc-time-view .rbc-header.rbc-today { background-color: #16a34a !important; color: #ffffff !important; }
          .rbc-day-bg.rbc-today { background-color: #f0fdf4 !important; }
          
          .rbc-header { padding: 10px 0; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 1px solid #e2e8f0 !important; background: #f8fafc; }
          .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #e2e8f0 !important; }
          .rbc-month-row + .rbc-month-row { border-top: 1px solid #e2e8f0 !important; }
          .rbc-date-cell { padding: 6px 8px; font-weight: 800; font-size: 12px; color: #475569; }
          .rbc-off-range-bg { background-color: #f1f5f9; opacity: 0.5; }
          
          .rbc-time-header.rbc-overflowing { border-right: none; }
          .rbc-time-header-content { border-left: 1px solid #e2e8f0; }
          .rbc-time-content { border-top: 1px solid #e2e8f0; }
          .rbc-timeslot-group { border-bottom: 1px solid #e2e8f0; min-height: 48px; }
          .rbc-time-gutter .rbc-timeslot-group { border-right: 1px solid #e2e8f0; font-size: 11px; font-weight: 700; color: #64748b; align-items: center; justify-content: center; display: flex; background: #f8fafc; }
          .rbc-day-slot .rbc-events-container { margin-right: 8px; }

          .rbc-agenda-view { border: none !important; background: transparent !important; }
          .rbc-agenda-view table.rbc-agenda-table { display: block !important; width: 100% !important; border: none !important; background: transparent !important;}
          .rbc-agenda-view table.rbc-agenda-table thead { display: none !important; }
          .rbc-agenda-view table.rbc-agenda-table tbody { display: block !important; width: 100% !important; background: transparent !important;}
          
          .rbc-agenda-view table.rbc-agenda-table tr { 
            display: flex !important; 
            flex-wrap: wrap !important; 
            width: 100% !important; 
            border: none !important; 
            background: transparent !important; 
            border-radius: 0 !important;
          }
          
          .rbc-agenda-date-cell { 
            width: 100% !important; display: block !important; 
            padding: 16px 8px 8px 8px !important; 
            font-weight: 800 !important; font-size: 13px !important; 
            color: #64748b !important; text-transform: uppercase !important; 
            border: none !important; 
            background: transparent !important;
          }
          .rbc-agenda-time-cell { display: none !important; }
          .rbc-agenda-event-cell { 
            width: 100% !important; display: block !important; 
            padding: 0 !important; border: none !important; 
            background: transparent !important;
          }

          .rbc-event { padding: 3px 6px !important; margin-bottom: 2px !important; cursor: pointer; }
          
          .rbc-show-more { font-size: 11px; font-weight: 800; color: #1e293b; background-color: #f1f5f9; padding: 4px 6px; border-radius: 2px; text-align: center; margin: 2px 4px; display: block; border: 1px solid #cbd5e1; text-transform: uppercase;}
          .rbc-show-more:hover { background-color: #e2e8f0; color: #000; }
          
          .rbc-overlay { background-color: #ffffff !important; border: 1px solid #cbd5e1 !important; border-radius: 4px !important; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important; padding: 8px !important; z-index: 50 !important; min-width: 250px !important;}
          .rbc-overlay-header { font-weight: 800; font-size: 12px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px; text-transform: uppercase;}
        `}</style>
        
        <BigCalendar
          localizer={localizer}
          culture="ru"
          messages={messages}
          events={events}
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          onNavigate={handleNavigate}
          view={currentView}
          onView={handleViewChange}
          views={['month', 'week', 'day', 'agenda']}
          style={{ height: '100%' }}
          eventPropGetter={eventStyleGetter}
          selectable={true}
          popup={true}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          formats={{
            timeGutterFormat: (date, culture, loc) => loc!.format(date, 'HH:mm', culture),
            eventTimeRangeFormat: () => '', 
            agendaDateFormat: (date, culture, loc) => loc!.format(date, 'dd MMMM (EEEE)', culture),
            dayFormat: (date, culture, loc) => loc!.format(date, 'dd EEEE', culture),
          }}
          components={{
            toolbar: CustomToolbar,
            event: CustomEventComponent,
            agenda: { event: CustomAgendaEvent }
          }}
        />
      </div>

      <CalendarEventModal 
        config={modalConfig} 
        onClose={handleCloseModal} // ИСПРАВЛЕНИЕ: закрываем и чистим URL
        onSave={handleSaveModal} 
        onDelete={onTaskDelete}
      />
    </div>
  );
}

function CalendarEventModal({ 
  config, 
  onClose, 
  onSave,
  onDelete
}: { 
  config: { isOpen: boolean; mode: 'add' | 'edit'; task?: Task; defaultDate?: Date } | null; 
  onClose: () => void; 
  onSave: (mode: 'add' | 'edit', data: any, taskId?: string) => void; 
  onDelete?: (taskId: string) => void;
}) {
  if (!config?.isOpen) return null;

  const isEdit = config.mode === 'edit';
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'task' | 'event'>('task');
  const [dateStr, setDateStr] = useState('');
  
  const [hasReminder, setHasReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState('');

  useEffect(() => {
    if (config.isOpen) {
      setTitle(config.task?.title || '');
      setType(
        config.task?.is_milestone || config.task?.tags?.includes('мероприятие') || config.task?.tags?.includes('Мероприятие') 
          ? 'event' 
          : 'task'
      );
      
      const pad = (n: number) => n.toString().padStart(2, '0');
      
      const d = isEdit && config.task ? parseSafeDate(config.task.deadline || config.task.start_date || config.task.createdAt) : config.defaultDate;
      if (d) {
        setDateStr(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
      }

      const existingReminder = (config.task as any)?.reminder_time;
      if (existingReminder) {
        const rd = new Date(existingReminder);
        setHasReminder(true);
        setReminderDate(`${rd.getFullYear()}-${pad(rd.getMonth()+1)}-${pad(rd.getDate())}T${pad(rd.getHours())}:${pad(rd.getMinutes())}`);
      } else {
        setHasReminder(false);
        setReminderDate('');
      }
    }
  }, [config, isEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const data: any = {
      title,
      deadline: dateStr,
      start_date: dateStr, 
      reminder_time: hasReminder && reminderDate ? reminderDate : null 
    };
    
    if (!isEdit) {
       data.status = 'todo';
       data.priority = 'medium';
       data.is_milestone = type === 'event';
       data.tags = type === 'event' ? ['Мероприятие'] : [];
    }

    onSave(config.mode, data, config.task?.id);
  };

  const handleDeleteClick = () => {
    if (config.task?.id && onDelete) {
      if (window.confirm('Вы уверены, что хотите удалить эту запись?')) {
        onDelete(config.task.id);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-md w-full max-w-sm overflow-hidden flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Clock size={16} className="text-slate-500" />
            {isEdit ? 'Редактировать' : 'Добавить запись'}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-sm">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Название</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-sm px-3 py-2 outline-none focus:border-green-600 bg-white"
              placeholder="Введите название..."
              required
            />
          </div>

          {!isEdit && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Тип записи</label>
              <select 
                value={type}
                onChange={e => setType(e.target.value as 'task' | 'event')}
                className="w-full text-sm border border-slate-200 rounded-sm px-3 py-2 outline-none focus:border-green-600 bg-white"
              >
                <option value="task">Задача (Оранжевый)</option>
                <option value="event">Мероприятие (Синий)</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Дата и время начала</label>
            <input 
              type="datetime-local" 
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-sm px-3 py-2 outline-none focus:border-green-600 bg-white"
              required
            />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 mb-2 cursor-pointer w-max">
              <input 
                type="checkbox" 
                checked={hasReminder}
                onChange={(e) => setHasReminder(e.target.checked)}
                className="rounded-sm border-slate-300 text-green-600 focus:ring-green-600 w-3 h-3 cursor-pointer"
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Включить напоминание</span>
            </label>

            {hasReminder && (
              <input 
                type="datetime-local" 
                value={reminderDate}
                onChange={e => setReminderDate(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-sm px-3 py-2 outline-none focus:border-green-600 bg-green-50/50"
                required
              />
            )}
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 mt-4 border-t border-slate-100">
            {isEdit ? (
              <button 
                type="button" 
                onClick={handleDeleteClick}
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-200 rounded-sm hover:bg-red-100 flex items-center gap-1.5"
              >
                <Trash2 size={12} /> Удалить
              </button>
            ) : <div></div>}
            
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-200 rounded-sm hover:bg-slate-50 text-slate-600"
              >
                Отмена
              </button>
              <button 
                type="submit"
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-sm hover:bg-green-700 flex items-center gap-2 shadow-sm"
              >
                <Save size={14} /> Сохранить
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}