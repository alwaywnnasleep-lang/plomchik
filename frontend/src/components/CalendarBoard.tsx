import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import type { Task } from '@/types';

const localizer = momentLocalizer(moment);

interface CalendarBoardProps {
  tasks: Task[];
}

export function CalendarBoard({ tasks }: CalendarBoardProps) {
  const events = tasks
    .filter(t => t.status === 'planned' && t.deadline)
    .map(t => ({
      id: t.id,
      title: t.title,
      start: new Date(t.deadline),
      end: new Date(t.deadline),
      allDay: true,
    }));

  return (
    <Calendar
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      style={{ height: 600 }}
    />
  );
}