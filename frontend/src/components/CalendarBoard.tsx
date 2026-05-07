import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/utils/cn';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import type { Task } from '@/types';

// Устанавливаем язык по умолчанию для форматирования дат
moment.locale('ru');
const localizer = momentLocalizer(moment);

// Перевод интерфейса календаря на русский язык
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

// Пользовательский тулбар для более приятного внешнего вида
const CustomToolbar = (toolbar: any) => {
  const goToBack = () => toolbar.onNavigate('PREV');
  const goToNext = () => toolbar.onNavigate('NEXT');
  const goToCurrent = () => toolbar.onNavigate('TODAY');
  
  const label = () => {
    const date = moment(toolbar.date);
    return <span className="capitalize">{date.format('MMMM YYYY')}</span>;
  };

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <button 
          onClick={goToCurrent} 
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors"
        >
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
        <button 
          onClick={() => toolbar.onView('month')} 
          className={cn(
            "px-3 py-1 text-sm rounded-md transition-all", 
            toolbar.view === 'month' ? "bg-white shadow-sm border border-slate-200 text-green-700 font-medium" : "text-slate-600 hover:text-slate-800 border border-transparent"
          )}
        >
          Месяц
        </button>
        <button 
          onClick={() => toolbar.onView('agenda')} 
          className={cn(
            "px-3 py-1 text-sm rounded-md transition-all", 
            toolbar.view === 'agenda' ? "bg-white shadow-sm border border-slate-200 text-green-700 font-medium" : "text-slate-600 hover:text-slate-800 border border-transparent"
          )}
        >
          Расписание
        </button>
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

interface CalendarBoardProps {
  tasks: Task[];
  // Пропс для проброса функции сохранения напоминания на бэкенд (опционально)
  onAddReminder?: (taskId: string, remindDays: number) => void;
}

export function CalendarBoard({ tasks, onAddReminder }: CalendarBoardProps) {
  const events = tasks
    .filter(t => t.status === 'planned' && t.deadline)
    .map(t => ({
      id: t.id,
      title: t.title,
      start: new Date(t.deadline),
      end: new Date(t.deadline),
      allDay: true,
      task: t
    }));

  // Обработчик клика по карточке мероприятия
  const handleSelectEvent = (event: any) => {
    // В реальном приложении здесь лучше открывать модальное окно. 
    // Для базовой реализации используем системный prompt.
    const days = window.prompt(
      `Добавить напоминание для: "${event.title}"\nЗа сколько дней напомнить? (введите число, например 1 или 3):`, 
      "1"
    );
    
    if (days && !isNaN(Number(days))) {
      if (onAddReminder) {
        onAddReminder(event.id, Number(days));
      }
      alert(`Напоминание установлено за ${days} дн.`);
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
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
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 650 }}
        messages={messages}
        views={['month', 'agenda']}
        defaultView="month"
        onSelectEvent={handleSelectEvent}
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
  );
}
//TODO Реализовать добавление напоминания на бэкенд при клике на мероприятие (через проп onAddReminder)