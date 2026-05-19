import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar as BigCalendar, dateFnsLocalizer, Views, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import {
  ChevronLeft, ChevronRight, CalendarDays, Filter,
  Target, Users, X, Save, Clock, Trash2, Edit2, AlignLeft, Flag, CheckCircle2, User, Briefcase
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Task, OrgUnit, User as UserType } from '@/types';
import api from '@/services/api';
import 'react-big-calendar/lib/css/react-big-calendar.css';

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
  if (!u) return 'Неизвестный';
  if (u.fullName) return u.fullName;
  if (u.full_name) return u.full_name;
  if (u.last_name || u.first_name) return `${u.last_name || ''} ${u.first_name || ''} ${u.patronymic || ''}`.trim();
  return 'Неизвестный';
}

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

  const [users, setUsers] = useState<UserType[]>([]);
  const [units, setUnits] = useState<OrgUnit[]>([]);

  useEffect(() => {
    let isMounted = true;
    api.getAllUsers().then((res: any) => {
      if (isMounted) setUsers(Array.isArray(res) ? res : (res.results || []));
    }).catch(console.error);

    api.getAvailableUnits().then((res: any) => {
      if (isMounted) setUnits(Array.isArray(res) ? res : (res.results || []));
    }).catch(console.error);

    return () => { isMounted = false; };
  }, []);

  const currentDate = useMemo(() => {
    const d = searchParams.get('date');
    if (!d) return new Date();
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [searchParams]);

  const currentView: View = (searchParams.get('calView') as View) || Views.MONTH;

  useEffect(() => {
    const taskId = searchParams.get('taskId');
    if (taskId && tasks.length > 0) {
      const taskToOpen = tasks.find(t => String(t.id) === taskId);
      if (taskToOpen && !modalConfig?.isOpen) {
        setModalConfig({ isOpen: true, mode: 'edit', task: taskToOpen });
      }
    }
  }, [searchParams, tasks]);

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
    const isDone = event.resource.status === 'done';

    return {
      style: {
        backgroundColor: isDone ? '#f1f5f9' : (isEvent ? '#eff6ff' : '#fff7ed'),
        borderColor: isDone ? '#cbd5e1' : (isEvent ? '#3b82f6' : '#f97316'),
        color: isDone ? '#64748b' : (isEvent ? '#1e40af' : '#c2410c'),
        borderRadius: '4px',
        borderLeftWidth: '4px',
        borderTopWidth: '1px',
        borderRightWidth: '1px',
        borderBottomWidth: '1px',
        display: 'block',
        padding: '2px 4px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }
    };
  };

  const CustomEventComponent = ({ event }: any) => {
    const isDone = event.resource.status === 'done';
    const isEvent = event.type === 'event';

    return (
      <div className="flex items-center gap-1.5 overflow-hidden w-full" title={event.title}>
        {isEvent ? <Users size={12} className={cn("shrink-0", isDone && 'opacity-50')} /> : <Target size={12} className={cn("shrink-0", isDone && 'opacity-50')} />}
        <span className={cn("text-[10px] leading-tight font-bold uppercase tracking-wider truncate w-full", isDone && "line-through opacity-70")}>
          {format(event.start, 'HH:mm')} {event.title}
        </span>
      </div>
    );
  };

  const CustomAgendaEvent = ({ event }: any) => {
    const isDone = event.resource.status === 'done';
    const isEvent = event.type === 'event';

    const bgClass = isDone ? 'bg-slate-50 border-slate-200' : (isEvent ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200');
    const textColor = isDone ? 'text-slate-500' : (isEvent ? 'text-blue-800' : 'text-orange-800');
    const timeColor = isDone ? 'text-slate-500' : (isEvent ? 'text-blue-600' : 'text-orange-600');

    return (
      <div className={cn("flex items-center gap-3 px-4 py-3 mb-2 mx-1 rounded-md border shadow-sm", bgClass)} title={event.title}>
        <div className={cn("text-[11px] font-bold w-12 text-center", timeColor)}>
          {format(event.start, 'HH:mm')}
        </div>
        <div className={cn("w-px h-5 bg-current opacity-20", textColor)}></div>
        <div className={cn("flex items-center gap-2 flex-1 overflow-hidden")}>
          {isEvent ? <Users size={14} className={cn("shrink-0", timeColor, isDone && "opacity-50")} /> : <Target size={14} className={cn("shrink-0", timeColor, isDone && "opacity-50")} />}
          <span className={cn("text-[12px] font-bold uppercase tracking-wider truncate", textColor, isDone && "line-through opacity-60")}>
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
    handleCloseModal();
  };

  return (
    <div className="flex flex-col h-full space-y-4 relative">
      <div className="flex items-center justify-between bg-white p-3 rounded-md border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-slate-600">
          <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-blue-800">
            <Users size={14} className="text-blue-600"/> Мероприятия
          </div>
          <div className="flex items-center gap-2 px-2 py-1 bg-orange-50 border border-orange-200 rounded text-orange-800">
            <Target size={14} className="text-orange-600"/> Задачи
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            className="text-xs font-bold uppercase tracking-wider border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-green-600 bg-white cursor-pointer"
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

          .rbc-event { padding: 0 !important; margin-bottom: 4px !important; cursor: pointer; background: transparent !important;}
          .rbc-event-content { width: 100%; display: block; }

          .rbc-show-more { font-size: 11px; font-weight: 800; color: #1e293b; background-color: #f1f5f9; padding: 4px 6px; border-radius: 2px; text-align: center; margin: 2px 4px; display: block; border: 1px solid #cbd5e1; text-transform: uppercase;}
          .rbc-show-more:hover { background-color: #e2e8f0; color: #000; }

          .rbc-overlay { background-color: #ffffff !important; border: 1px solid #cbd5e1 !important; border-radius: 6px !important; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important; padding: 12px !important; z-index: 50 !important; min-width: 280px !important;}
          .rbc-overlay-header { font-weight: 800; font-size: 12px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px; text-transform: uppercase;}
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
        onClose={handleCloseModal}
        onSave={handleSaveModal}
        onDelete={onTaskDelete}
        units={units}
        users={users}
      />
    </div>
  );
}

function CalendarEventModal({
  config,
  onClose,
  onSave,
  onDelete,
  units,
  users
}: {
  config: { isOpen: boolean; mode: 'add' | 'edit'; task?: Task; defaultDate?: Date } | null;
  onClose: () => void;
  onSave: (mode: 'add' | 'edit', data: any, taskId?: string) => void;
  onDelete?: (taskId: string) => void;
  units: OrgUnit[];
  users: UserType[];
}) {
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('edit');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'task' | 'event'>('task');
  const [dateStr, setDateStr] = useState('');
  const [hasReminder, setHasReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [unitId, setUnitId] = useState<string>('');   // '' – не назначено, 'all' – все подразделения, иначе id подразделения
  const [assigneeId, setAssigneeId] = useState('');

  const filteredUsers = useMemo(() => {
    if (unitId === '' || unitId === 'all') return users;
    return users?.filter(u => u.org_unit?.toString() === unitId);
  }, [unitId, users]);

  useEffect(() => {
    if (config?.isOpen) {
      setViewMode(config.mode === 'edit' ? 'view' : 'edit');
      setTitle(config.task?.title || '');
      setDescription(config.task?.description || '');
      setType(
        config.task?.is_milestone || config.task?.tags?.includes('мероприятие') || config.task?.tags?.includes('Мероприятие')
          ? 'event'
          : 'task'
      );

      const pad = (n: number) => n.toString().padStart(2, '0');

      const d = config.mode === 'edit' && config.task ? parseSafeDate(config.task.deadline || config.task.start_date || config.task.createdAt) : config.defaultDate;
      if (d) {
        setDateStr(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
      }

      // При редактировании определяем, является ли задача глобальной или без подразделения
      const task = config.task;
      if ((task as any)?.is_global) {
        setUnitId('all');
      } else if (task?.unitId) {
        setUnitId(task.unitId.toString());
      } else {
        setUnitId('');
      }
      setAssigneeId(config.task?.assigneeId?.toString() || '');

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
  }, [config]);

  if (!config?.isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const data: any = {
      title,
      description,
      deadline: dateStr,
      start_date: dateStr,
      reminder_time: hasReminder && reminderDate ? reminderDate : null,
    };

    // Логика определения типа задачи
    if (unitId === 'all') {
      // Глобальная задача – видна всем
      data.is_global = true;
      data.org_unit = null;
      data.assigned_to = null;
    } else if (unitId === '') {
      // Личная заметка – видна только создателю
      data.is_global = false;
      data.org_unit = null;
      data.assigned_to = null;
    } else {
      // Конкретное подразделение
      data.is_global = false;
      data.org_unit = parseInt(unitId);
      data.assigned_to = assigneeId ? parseInt(assigneeId) : null;
    }

    if (config.mode === 'add') {
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

  const formatDisplayDate = (dStr: string) => {
    const d = parseSafeDate(dStr);
    if (!d) return '—';
    return format(d, 'dd MMMM yyyy, HH:mm', { locale: ru });
  };

  // Режим просмотра
  if (viewMode === 'view' && config.task) {
    const task = config.task;
    const isDone = task.status === 'done';
    const isEvent = type === 'event';
    const isGlobal = (task as any).is_global;
    const unit = (!isGlobal && task.unitId) ? units?.find(u => String(u.id) === String(task.unitId)) : null;
    const assignee = users?.find(u => String(u.id) === String(task.assigneeId));
    const creator = users?.find(u => String(u.id) === String(task.creatorId));

    let unitDisplay = '';
    if (isGlobal) {
      unitDisplay = 'Все подразделения';
    } else if (!task.unitId && !isGlobal) {
      unitDisplay = 'Не назначено (личная заметка)';
    } else {
      unitDisplay = unit?.name || 'Не назначено';
    }

    let assigneeDisplay = '';
    if (assignee) {
      assigneeDisplay = `${translateRank(assignee.rank)} ${getSafeFullName(assignee)}`;
    } else if (isGlobal) {
      assigneeDisplay = 'Задача для всех (без исполнителя)';
    } else if (!task.unitId && !isGlobal) {
      assigneeDisplay = 'Только для себя';
    } else {
      assigneeDisplay = 'Свободная задача (может взять любой сотрудник подразделения)';
    }

    return (
      <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b border-slate-200 bg-slate-50 relative">
            <div className="flex gap-2 mb-4">
              {isEvent ? (
                <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 rounded border border-blue-200 flex items-center gap-1.5 shadow-sm">
                  <Users size={12} /> Мероприятие
                </span>
              ) : (
                <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 rounded border border-orange-200 flex items-center gap-1.5 shadow-sm">
                  <Target size={12} /> Задача
                </span>
              )}
              {isDone && (
                <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 rounded border border-emerald-200 flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 size={12} /> Выполнено
                </span>
              )}
              {task.priority === 'critical' && !isDone && (
                <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded border border-red-200 flex items-center gap-1.5 shadow-sm">
                  <Flag size={12} /> Критично
                </span>
              )}
            </div>

            <h2 className={cn("text-xl font-black text-slate-800 leading-tight pr-8", isDone && "line-through opacity-70")}>
              {task.title}
            </h2>
            <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-2 gap-6 bg-white border border-slate-100 shadow-sm p-4 rounded-lg">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <User size={12}/> Постановщик
                </div>
                <div className="text-sm font-bold text-slate-800">
                  {creator ? `${translateRank(creator.rank)} ${getSafeFullName(creator)}` : 'Система'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Target size={12}/> Исполнитель
                </div>
                <div className={cn("text-sm font-bold", assignee ? "text-slate-800" : "text-amber-600")}>
                  {assigneeDisplay}
                </div>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Briefcase size={12}/> Подразделение
                </div>
                <div className="text-sm font-bold text-slate-800">
                  {unitDisplay}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="mt-0.5 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Сроки выполнения</div>
                <div className="text-sm font-bold text-slate-700">
                  {formatDisplayDate(task.deadline || task.start_date || task.createdAt || '')}
                </div>
              </div>
            </div>

            {hasReminder && (
              <div className="flex items-start gap-4">
                <div className="mt-0.5 w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                  <Clock size={18} />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-0.5">Напоминание</div>
                  <div className="text-sm font-bold text-slate-700">
                    {formatDisplayDate(reminderDate)}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-4">
              <div className="mt-0.5 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                <AlignLeft size={18} />
              </div>
              <div className="w-full">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Описание</div>
                <div className="text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 whitespace-pre-wrap min-h-[80px] shadow-inner">
                  {task.description || <span className="italic text-slate-400">Описание отсутствует. Вы можете добавить его в режиме редактирования.</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDeleteClick}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider bg-white text-red-600 border border-red-200 rounded-md hover:bg-red-50 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Trash2 size={14} /> Удалить
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider border border-slate-300 bg-white rounded-md hover:bg-slate-50 text-slate-700 shadow-sm transition-colors"
              >
                Закрыть
              </button>
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 shadow-sm transition-colors"
              >
                <Edit2 size={14} /> Изменить
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Режим создания / редактирования
  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            {config.mode === 'edit' ? <Edit2 size={18} className="text-green-600" /> : <Clock size={18} className="text-green-600" />}
            {config.mode === 'edit' ? 'Редактировать запись' : 'Добавить запись'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Название *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full text-sm font-medium border border-slate-300 rounded-md px-3 py-2.5 outline-none focus:border-green-600 bg-slate-50 focus:bg-white shadow-sm transition-colors"
              placeholder="Введите название..."
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full text-sm font-medium border border-slate-300 rounded-md px-3 py-2.5 outline-none focus:border-green-600 bg-slate-50 focus:bg-white resize-none h-24 shadow-sm transition-colors"
              placeholder="Добавьте подробности..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {config.mode === 'add' && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Тип записи</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as 'task' | 'event')}
                  className="w-full text-sm font-bold border border-slate-300 rounded-md px-3 py-2.5 outline-none focus:border-green-600 bg-slate-50 focus:bg-white cursor-pointer shadow-sm transition-colors"
                >
                  <option value="task">Задача</option>
                  <option value="event">Мероприятие</option>
                </select>
              </div>
            )}
            <div className={config.mode === 'edit' ? 'col-span-2' : ''}>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Дата и время начала *</label>
              <input
                type="datetime-local"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                className="w-full text-sm font-bold border border-slate-300 rounded-md px-3 py-2.5 outline-none focus:border-green-600 bg-slate-50 focus:bg-white cursor-pointer shadow-sm transition-colors"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Подразделение</label>
              <select
                value={unitId}
                onChange={e => {
                  setUnitId(e.target.value);
                  setAssigneeId('');
                }}
                className="w-full text-sm font-bold border border-slate-300 rounded-md px-3 py-2.5 outline-none focus:border-green-600 bg-slate-50 focus:bg-white cursor-pointer shadow-sm transition-colors"
              >
                <option value="">Не назначено (личная заметка)</option>
                <option value="all">Все подразделения</option>
                {units?.map((u: any) => (
                  <option key={u.id} value={u.id.toString()}>{u.name}</option>
                ))}
              </select>
              <p className="text-[9px] text-slate-400 mt-1">
                {unitId === '' && 'Задача будет видна только вам.'}
                {unitId === 'all' && 'Задача будет видна всем пользователям.'}
                {unitId && unitId !== '' && unitId !== 'all' && 'Задача будет доступна сотрудникам подразделения и вышестоящим командирам.'}
              </p>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Исполнитель (опционально)</label>
              <select
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
                className="w-full text-sm font-bold border border-slate-300 rounded-md px-3 py-2.5 outline-none focus:border-green-600 bg-slate-50 focus:bg-white cursor-pointer shadow-sm transition-colors disabled:opacity-50"
                disabled={unitId === 'all'} // для глобальной задачи исполнителя не выбираем
              >
                <option value="">Не назначен (свободная)</option>
                {filteredUsers?.map((u: any) => (
                  <option key={u.id} value={u.id.toString()}>
                    {translateRank(u.rank)} {getSafeFullName(u)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="flex items-center gap-2.5 mb-3 cursor-pointer w-max group">
              <input
                type="checkbox"
                checked={hasReminder}
                onChange={(e) => setHasReminder(e.target.checked)}
                className="rounded border-slate-300 text-green-600 focus:ring-green-600 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 group-hover:text-slate-800 transition-colors">Установить напоминание</span>
            </label>

            {hasReminder && (
              <input
                type="datetime-local"
                value={reminderDate}
                onChange={e => setReminderDate(e.target.value)}
                className="w-full text-sm font-bold border border-green-300 rounded-md px-3 py-2.5 outline-none focus:border-green-600 bg-green-50 shadow-sm transition-colors cursor-pointer"
                required
              />
            )}
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 mt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={() => config.mode === 'edit' ? setViewMode('view') : onClose()}
              className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider border border-slate-300 bg-white rounded-md hover:bg-slate-50 text-slate-700 shadow-sm transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 shadow-sm transition-colors"
            >
              <Save size={16} /> Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}