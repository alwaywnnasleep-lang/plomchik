import { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer 
} from 'recharts';
import { Calendar, Filter, Download, TrendingUp, Users, CheckCircle, Clock } from 'lucide-react';
import type { Task, OrgUnit } from '@/types';

interface StatisticsProps {
  tasks: Task[];
  units?: OrgUnit[]; // список подразделений для отображения названий
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export function Statistics({ tasks, units = [] }: StatisticsProps) {
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Фильтрация задач
  const filteredTasks = useMemo(() => {
    return (tasks || []).filter(task => {
      // Приводим оба значения к строке для безопасного сравнения
      if (selectedUnit !== 'all' && String(task.unitId) !== String(selectedUnit)) return false;
      if (selectedPriority !== 'all' && String(task.priority) !== String(selectedPriority)) return false;
      return true;
    });
  }, [tasks, selectedUnit, selectedPriority]);

  // Статистика по статусам
  const statusStats = useMemo(() => {
    const stats: Record<string, number> = {
      planned: 0,
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };
    filteredTasks.forEach(task => {
      const status = task.status;
      if (status in stats) {
        stats[status] += 1;
      } else {
        // если неизвестный статус, добавляем в planned для простоты
        stats.planned += 1;
      }
    });
    return Object.entries(stats).map(([status, value]) => ({
      name: status === 'planned' ? 'Запланировано' :
            status === 'todo' ? 'К выполнению' :
            status === 'in_progress' ? 'В работе' :
            status === 'review' ? 'На проверке' : 'Выполнено',
      value
    }));
  }, [filteredTasks]);

  // Статистика по приоритетам
  const priorityStats = useMemo(() => {
    const stats = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    filteredTasks.forEach(task => {
      if (task.priority in stats) {
        stats[task.priority as keyof typeof stats] += 1;
      }
    });
    return Object.entries(stats).map(([priority, value]) => ({
      name: priority === 'critical' ? 'Критический' :
            priority === 'high' ? 'Высокий' :
            priority === 'medium' ? 'Средний' : 'Низкий',
      value
    }));
  }, [filteredTasks]);

  // Статистика по подразделениям (используем переданные units для названий)
  const unitStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredTasks.forEach(task => {
      const unitId = task.unitId;
      if (unitId) {
        stats[unitId] = (stats[unitId] || 0) + 1;
      }
    });
    return Object.entries(stats)
      .map(([unitId, count]) => ({
        name: units.find(u => u.id === unitId)?.name || unitId,
        value: count
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredTasks, units]);

  // Прогресс по дням (за последние 30 дней)
  const dailyProgress = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Формируем YYYY-MM-DD в локальном часовом поясе, а не в UTC
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      const completed = filteredTasks.filter(t => 
        t.status === 'done' && t.createdAt?.startsWith(dateStr)
      ).length;
      
      days.push({
        date: `${dd}.${mm}`, // Более привычный формат ДД.ММ для графика
        completed
      });
    }
    return days;
  }, [filteredTasks]);

  // Общие метрики
  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'done').length;
    const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length;
    const overdue = filteredTasks.filter(t => 
      new Date(t.deadline) < new Date() && t.status !== 'done'
    ).length;
    
    return {
      total,
      completed,
      inProgress,
      overdue,
      completionRate: total ? Math.round((completed / total) * 100) : 0
    };
  }, [filteredTasks]);

  // Вспомогательная функция для форматирования даты
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Статистика выполнения задач</h1>
          <p className="text-sm text-slate-500 mt-1">Аналитика и метрики по задачам</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
            <Download size={14} />
            Экспорт
          </button>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="week">Последняя неделя</option>
            <option value="month">Последний месяц</option>
            <option value="quarter">Последний квартал</option>
            <option value="year">Последний год</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="all">Все подразделения</option>
            {units.map(unit => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        </div>

        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          <option value="all">Все приоритеты</option>
          <option value="critical">Критический</option>
          <option value="high">Высокий</option>
          <option value="medium">Средний</option>
          <option value="low">Низкий</option>
        </select>
      </div>

      {/* Ключевые метрики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <TrendingUp size={20} />
            <span className="text-sm font-medium">Всего задач</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">{metrics.total}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Clock size={20} />
            <span className="text-sm font-medium">В работе</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">{metrics.inProgress}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <CheckCircle size={20} />
            <span className="text-sm font-medium">Выполнено</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">{metrics.completed}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <Users size={20} />
            <span className="text-sm font-medium">Просрочено</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">{metrics.overdue}</div>
        </div>
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Статусы */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Распределение по статусам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusStats.filter(s => s.value > 0)}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusStats.filter(s => s.value > 0).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} name={entry.name} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Приоритеты */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Распределение по приоритетам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={priorityStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Динамика выполнения */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Динамика выполнения задач</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyProgress}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Топ подразделений */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Топ-10 подразделений по задачам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={unitStats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}