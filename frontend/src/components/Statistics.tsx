import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts';
import { 
  TrendingUp, CheckCircle, Clock, AlertTriangle, 
  Target, Medal, Award, Briefcase, ChevronRight 
} from 'lucide-react';
import type { Task, OrgUnit, User } from '@/types';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';

interface StatisticsProps {
  tasks: Task[];
  units: OrgUnit[];
  users: User[];
  onTasksChange: (tasks: Task[]) => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function Statistics({ tasks, units, users, onTasksChange }: StatisticsProps) {
  const { user } = useAuth();
  const [selectedUnit, setSelectedUnit] = useState<string>('all');

  // WebSocket для обновлений
  const onTasksChangeRef = useRef(onTasksChange);
  useEffect(() => { onTasksChangeRef.current = onTasksChange; }, [onTasksChange]);

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:8000/ws/tasks/`;
    let ws: WebSocket;
    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onmessage = async () => {
        const res = await api.getTasks();
        onTasksChangeRef.current(Array.isArray(res) ? res : (res.results || []));
      };
      ws.onclose = () => setTimeout(connect, 3000);
    };
    connect();
    return () => ws?.close();
  }, []);

  // --- ЛОГИКА ДОСТУПА (ИЕРАРХИЯ) ---
  const myAvailableUnits = useMemo(() => {
    // Если админ — видит всё
    if (user?.role === 'admin') return units;

    // Ищем подразделения, где текущий пользователь — командир (commanderId), 
    // ИЛИ это его основное подразделение (org_unit)
    return units.filter(u => 
      String(u.commanderId) === String(user?.id) || 
      String(u.id) === String(user?.org_unit)
    );
  }, [units, user]);

  const filteredTasks = useMemo(() => {
    const allowedIds = myAvailableUnits.map(u => String(u.id));
    let result = (tasks || []).filter(t => allowedIds.includes(String(t.unitId)));

    if (selectedUnit !== 'all') {
      result = result.filter(t => String(t.unitId) === String(selectedUnit));
    }
    return result;
  }, [tasks, myAvailableUnits, selectedUnit]);

  // --- ЛУЧШИЙ СОТРУДНИК ---
  const topPerformer = useMemo(() => {
    if (!users || !Array.isArray(users)) return null;

    const userTaskCounts: Record<string, number> = {};
    filteredTasks.forEach(t => {
      if (t.status === 'done' && t.assigneeId) {
        userTaskCounts[t.assigneeId] = (userTaskCounts[t.assigneeId] || 0) + 1;
      }
    });

    const bestUserId = Object.entries(userTaskCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0];

    if (!bestUserId) return null;
    const foundUser = users.find(u => String(u.id) === String(bestUserId));
    
    return {
      name: foundUser?.fullName || 'Сотрудник',
      rank: foundUser?.rank || '—',
      count: userTaskCounts[bestUserId]
    };
  }, [filteredTasks, users]);

  // --- ДАННЫЕ ДЛЯ ДИАГРАММ ---
  const statusData = useMemo(() => {
    const counts = { todo: 0, in_progress: 0, review: 0, done: 0 };
    filteredTasks.forEach(t => { if (t.status in counts) counts[t.status as keyof typeof counts]++; });
    return [
      { name: 'Ожидают', value: counts.todo, color: '#94a3b8' },
      { name: 'В работе', value: counts.in_progress, color: '#f59e0b' },
      { name: 'Проверка', value: counts.review, color: '#8b5cf6' },
      { name: 'Готово', value: counts.done, color: '#10b981' },
    ].filter(d => d.value > 0);
  }, [filteredTasks]);

  const metrics = {
    total: filteredTasks.length,
    done: filteredTasks.filter(t => t.status === 'done').length,
    overdue: filteredTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < new Date()).length,
    rate: filteredTasks.length ? Math.round((filteredTasks.filter(t => t.status === 'done').length / filteredTasks.length) * 100) : 0
  };

  return (
    <div className="p-1 space-y-6 pb-10">
      {/* Заголовок и Фильтр */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-lg text-white shadow-lg shadow-emerald-200">
              <TrendingUp size={24} />
            </div>
            АНАЛИТИКА ШТАТА
          </h1>
          <p className="text-slate-500 font-medium mt-1">Мониторинг ресурсов и результативности подразделений</p>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-2xl shadow-sm">
          <Briefcase size={18} className="text-slate-400 ml-2" />
          <select 
            className="border-none bg-transparent font-bold text-slate-700 focus:ring-0 text-sm min-w-[220px]"
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
          >
            <option value="all">Все мои подразделения</option>
            {myAvailableUnits.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Верхний ряд: Метрики и Лучший человек */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricBox title="Задач в базе" value={metrics.total} sub="Общий объем" icon={<Target className="text-blue-600"/>} />
          <MetricBox title="Завершено" value={metrics.done} sub={`${metrics.rate}% успех`} icon={<CheckCircle className="text-emerald-600"/>} />
          <MetricBox title="Эффективность" value={`${metrics.rate}%`} sub="KPI подразделения" icon={<Medal className="text-amber-600"/>} />
          <MetricBox title="Просрочено" value={metrics.overdue} sub="Требует внимания" icon={<AlertTriangle className="text-red-600"/>} danger={metrics.overdue > 0} />
        </div>

        {/* Карточка лучшего сотрудника */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden group">
          <Award className="absolute -right-4 -top-4 w-24 h-24 text-white/5 group-hover:rotate-12 transition-transform duration-500" />
          <div className="relative z-10">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Лучший в отделе</h3>
            {topPerformer ? (
              <>
                <div className="text-xl font-black leading-tight mb-1">{topPerformer.name}</div>
                <div className="text-xs text-slate-400 mb-4">{topPerformer.rank}</div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-bold">
                    {topPerformer.count} задач выполнено
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-400 italic">Данные собираются...</div>
            )}
          </div>
        </div>
      </div>

      {/* Диаграммы */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Структура выполнения</h3>
            <div className="text-[10px] bg-slate-100 px-2 py-1 rounded-md text-slate-500">REAL-TIME</div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  innerRadius={80}
                  outerRadius={105}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.1)'}} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Нагрузка по группам</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={myAvailableUnits.map(u => ({
                name: u.name,
                count: tasks.filter(t => String(t.unitId) === String(u.id)).length
              }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ title, value, sub, icon, danger }: any) {
  return (
    <div className={cn(
      "bg-white p-5 rounded-3xl border border-slate-200 shadow-sm transition-all hover:border-emerald-200",
      danger && "border-red-100 bg-red-50/30"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 bg-slate-50 rounded-xl">{icon}</div>
        <ChevronRight size={14} className="text-slate-300" />
      </div>
      <div className={cn("text-2xl font-black text-slate-800", danger && "text-red-600")}>{value}</div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{title}</div>
      <div className="text-[9px] text-slate-400 mt-1">{sub}</div>
    </div>
  );
}