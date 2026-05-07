import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
  LineChart, Line, ComposedChart, Area
} from 'recharts';
import { 
  TrendingUp, CheckCircle, Clock, AlertTriangle, 
  Target, Medal, Briefcase, Building2, Calendar, User, Award, Activity
} from 'lucide-react';
import type { Task, OrgUnit, User as UserType } from '@/types';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';

interface StatisticsProps {
  tasks: Task[];
  units: OrgUnit[];
  users: UserType[];
  onTasksChange: (tasks: Task[]) => void;
}

// Приятная, сбалансированная корпоративная палитра
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

const getSafeName = (u: any, fallbackId: string) => {
  if (!u) return `Сотрудник ID-${fallbackId}`;
  if (u.fullName) return u.fullName;
  if (u.full_name) return u.full_name;
  if (u.last_name || u.first_name) return `${u.last_name || ''} ${u.first_name || ''}`.trim();
  if (u.username) return u.username;
  return `Сотрудник ID-${fallbackId}`;
};

export function Statistics({ 
  tasks = [], 
  units = [], 
  users = [], 
  onTasksChange 
}: StatisticsProps) {
  const { user } = useAuth();
  
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year' | 'all'>('week');
  const [extraUsers, setExtraUsers] = useState<Record<string, any>>({});

  const onTasksChangeRef = useRef(onTasksChange);
  useEffect(() => { onTasksChangeRef.current = onTasksChange; }, [onTasksChange]);

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:8000/ws/tasks/`;
    let ws: WebSocket;
    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onmessage = async () => {
        try {
          const res = await api.getTasks();
          onTasksChangeRef.current(Array.isArray(res) ? res : (res.results || []));
        } catch (e) {
          console.error("WS Task Fetch error", e);
        }
      };
      ws.onclose = () => setTimeout(connect, 3000);
    };
    connect();
    return () => ws?.close();
  }, []);

  const myAvailableUnits = useMemo(() => {
    if (!user || !units || !Array.isArray(units)) return [];
    if (user.role === 'admin') return units;

    return units.filter(u => {
      const isCommander = String(u.commanderId || '') === String(user.id);
      const myUnitId = String(user.org_unit || '');
      return isCommander || String(u.id) === myUnitId;
    });
  }, [units, user]);

  const filteredTasks = useMemo(() => {
    const allowedIds = myAvailableUnits.map(u => String(u.id));
    let result = (tasks || []).filter(t => allowedIds.includes(String(t.unitId)));

    if (selectedUnit !== 'all') {
      result = result.filter(t => String(t.unitId) === String(selectedUnit));
    }

    if (dateRange !== 'all') {
      const limitDate = new Date();
      limitDate.setHours(0, 0, 0, 0); 
      if (dateRange === 'week') limitDate.setDate(limitDate.getDate() - 7);
      if (dateRange === 'month') limitDate.setMonth(limitDate.getMonth() - 1);
      if (dateRange === 'year') limitDate.setFullYear(limitDate.getFullYear() - 1);

      result = result.filter(t => {
        if (!t.createdAt) return true;
        return new Date(t.createdAt) >= limitDate;
      });
    }
    return result;
  }, [tasks, myAvailableUnits, selectedUnit, dateRange]);

  // Сбор данных для лидеров
  const idsToLoad = useMemo(() => {
    const stats: Record<string, number> = {};
    const unitStats: Record<string, number> = {};
    const fallbacks: Record<string, any> = {};

    filteredTasks.forEach(t => {
      const status = String(t.status).toLowerCase();
      const isDone = status === 'done' || status === 'completed';
      
      if (isDone) {
        // Для лучшего сотрудника
        const rawId = t.assigneeId || (t as any).assigned_to || ((t as any).assignee?.id);
        if (rawId) {
          const id = String(rawId).trim();
          stats[id] = (stats[id] || 0) + 1;
          if ((t as any).assignee) fallbacks[id] = (t as any).assignee;
        }

        // Для лучшего подразделения
        if (t.unitId) {
          unitStats[String(t.unitId)] = (unitStats[String(t.unitId)] || 0) + 1;
        }
      }
    });

    const bestUserId = Object.entries(stats).sort(([, a], [, b]) => b - a)[0]?.[0];
    const bestUnitId = Object.entries(unitStats).sort(([, a], [, b]) => b - a)[0]?.[0];

    const ids = new Set<string>();
    if (bestUserId) ids.add(bestUserId);

    let commanderIdToLoad = null;
    if (bestUnitId) {
      const foundUnit = myAvailableUnits.find(u => String(u.id) === String(bestUnitId));
      if (foundUnit && foundUnit.commanderId) {
        commanderIdToLoad = String(foundUnit.commanderId);
        ids.add(commanderIdToLoad);
      }
    }

    return { 
      ids: Array.from(ids), 
      bestUserId, 
      bestUnitId,
      commanderIdToLoad,
      userCounts: stats, 
      unitCounts: unitStats,
      fallbackObjs: fallbacks 
    };
  }, [filteredTasks, myAvailableUnits]);

  useEffect(() => {
    idsToLoad.ids.forEach(id => {
      if (!id || id === 'null' || id === 'undefined') return;
      const existsInProps = users.some(u => String(u.id) === id);
      const existsInExtra = extraUsers[id];

      if (!existsInProps && !existsInExtra) {
        setExtraUsers(prev => ({ ...prev, [id]: { _fetching: true } }));
        api.getUser(Number(id))
          .then(userObj => setExtraUsers(prev => ({ ...prev, [id]: userObj })))
          .catch(() => setExtraUsers(prev => ({ ...prev, [id]: { _error: true } })));
      }
    });
  }, [idsToLoad.ids, users, extraUsers]);

  const topPerformer = useMemo(() => {
    if (!idsToLoad.bestUserId) return null;
    const id = idsToLoad.bestUserId;
    const count = idsToLoad.userCounts[id];
    const targetUser = users.find(u => String(u.id) === id) || extraUsers[id];
    const fallbackObj = idsToLoad.fallbackObjs[id];

    if (targetUser && !targetUser._fetching && !targetUser._error) {
      return { name: getSafeName(targetUser, id), rank: targetUser.rank || '—', count };
    }
    if (fallbackObj) {
      return { name: getSafeName(fallbackObj, id), rank: fallbackObj.rank || '—', count };
    }
    return { name: targetUser?._fetching ? 'Загрузка...' : `Сотрудник ID-${id}`, rank: '—', count };
  }, [idsToLoad, users, extraUsers]);

  const topUnit = useMemo(() => {
    if (!idsToLoad.bestUnitId) return null;
    const unitId = idsToLoad.bestUnitId;
    const count = idsToLoad.unitCounts[unitId];
    const foundUnit = myAvailableUnits.find(u => String(u.id) === String(unitId));
    if (!foundUnit) return null;

    let commanderName = 'Не назначен';
    if (idsToLoad.commanderIdToLoad) {
      const cId = idsToLoad.commanderIdToLoad;
      const targetUser = users.find(u => String(u.id) === cId) || extraUsers[cId];
      if (targetUser && !targetUser._fetching && !targetUser._error) {
        commanderName = getSafeName(targetUser, cId);
      } else if (targetUser?._fetching) {
        commanderName = 'Загрузка...';
      } else {
        commanderName = `Командир ID-${cId}`;
      }
    }

    return { name: foundUnit.name, commanderName, count };
  }, [idsToLoad, myAvailableUnits, users, extraUsers]);

  // ГРАФИК 1: Исполнительская дисциплина
  const disciplineData = useMemo(() => {
    const counts = { onTime: 0, lateDone: 0, onTrack: 0, overdue: 0 };
    const now = new Date();

    filteredTasks.forEach(t => {
      const isDone = ['done', 'completed'].includes(String(t.status).toLowerCase());
      if (!t.deadline) {
        if (isDone) counts.onTime++;
        else counts.onTrack++;
        return;
      }
      const deadlineDate = new Date(t.deadline);

      if (isDone) {
        const endDateRaw = t.end_date || (t as any).updated_at || t.createdAt;
        const endDate = endDateRaw ? new Date(endDateRaw) : new Date();
        if (endDate <= deadlineDate) counts.onTime++;
        else counts.lateDone++;
      } else {
        if (now <= deadlineDate) counts.onTrack++;
        else counts.overdue++;
      }
    });

    return [
      { name: 'Выполнено в срок', value: counts.onTime, color: '#10b981' }, // emerald-500
      { name: 'С нарушением срока', value: counts.lateDone, color: '#f59e0b' }, // amber-500
      { name: 'В работе (по графику)', value: counts.onTrack, color: '#3b82f6' }, // blue-500
      { name: 'Просрочено', value: counts.overdue, color: '#ef4444' }, // red-500
    ].filter(d => d.value > 0);
  }, [filteredTasks]);

  // ГРАФИК 2: Постановка vs Выполнение
  const inflowOutflowData = useMemo(() => {
    if (dateRange === 'all' || dateRange === 'year') return []; 
    const daysMap: Record<string, { day: string, assigned: number, completed: number }> = {};
    const now = new Date();
    const daysToGenerate = dateRange === 'week' ? 7 : 30;

    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const label = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      daysMap[label] = { day: label, assigned: 0, completed: 0 };
    }

    filteredTasks.forEach(t => {
      if (t.createdAt) {
        const cDate = new Date(t.createdAt);
        const cLabel = cDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        if (daysMap[cLabel]) daysMap[cLabel].assigned++;
      }
      const status = String(t.status).toLowerCase();
      if (status === 'done' || status === 'completed') {
        const endDateRaw = t.end_date || (t as any).updated_at || t.createdAt;
        if (endDateRaw) {
          const eDate = new Date(endDateRaw);
          const eLabel = eDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
          if (daysMap[eLabel]) daysMap[eLabel].completed++;
        }
      }
    });

    return Object.values(daysMap);
  }, [filteredTasks, dateRange]);

  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const done = filteredTasks.filter(t => String(t.status).toLowerCase() === 'done').length;
    const overdue = filteredTasks.filter(t => 
      String(t.status).toLowerCase() !== 'done' && t.deadline && new Date(t.deadline) < new Date()
    ).length;
    return {
      total, done, overdue,
      rate: total ? Math.round((done / total) * 100) : 0
    };
  }, [filteredTasks]);

  return (
    <div className="space-y-6 pb-10 bg-slate-50 p-4 rounded-3xl animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Activity size={24} />
            </div>
            Аналитика эффективности
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Контроль задач и распределение нагрузки</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl transition-colors hover:bg-slate-100">
            <Calendar size={18} className="text-slate-500" />
            <select 
              className="border-none bg-transparent font-semibold text-slate-700 focus:ring-0 text-sm cursor-pointer outline-none p-0"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
            >
              <option value="week">За 7 дней</option>
              <option value="month">За 30 дней</option>
              <option value="year">За год</option>
              <option value="all">За все время</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl transition-colors hover:bg-slate-100">
            <Briefcase size={18} className="text-slate-500" />
            <select 
              className="border-none bg-transparent font-semibold text-slate-700 focus:ring-0 text-sm cursor-pointer outline-none min-w-[180px] p-0"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
            >
              <option value="all">Все подразделения</option>
              {myAvailableUnits.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricBox title="Всего задач" value={metrics.total} icon={<Target size={22}/>} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <MetricBox title="Выполнено" value={metrics.done} icon={<CheckCircle size={22}/>} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <MetricBox title="Эффективность" value={`${metrics.rate}%`} icon={<Medal size={22}/>} iconColor="text-amber-600" iconBg="bg-amber-50" />
        <MetricBox title="Просрочено" value={metrics.overdue} icon={<AlertTriangle size={22}/>} iconColor="text-red-600" iconBg="bg-red-50" danger={metrics.overdue > 0} />
      </div>

      {/* LEADERBOARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Лидер */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-5 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Award size={32} className="group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Сотрудник периода</h4>
            {topPerformer ? (
              <>
                <div className="text-xl font-bold text-slate-800 leading-tight truncate" title={topPerformer.name}>
                  {topPerformer.name}
                </div>
                <div className="text-sm text-slate-500 mb-2 truncate">{topPerformer.rank}</div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold">
                  {topPerformer.count} задач закрыто
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-400 mt-2">Нет данных за выбранный период</div>
            )}
          </div>
        </div>

        {/* Лучшее подразделение */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-5 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Building2 size={32} className="group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Подразделение периода</h4>
            {topUnit ? (
              <>
                <div className="text-xl font-bold text-slate-800 leading-tight truncate" title={topUnit.name}>
                  {topUnit.name}
                </div>
                <div className="text-sm text-slate-500 mb-2 truncate">Ком: {topUnit.commanderName}</div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold">
                  {topUnit.count} задач закрыто
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-400 mt-2">Нет данных за выбранный период</div>
            )}
          </div>
        </div>

      </div>

      {/* CHARTS ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Исполнительская дисциплина (Pie) */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 text-base mb-6 flex items-center gap-2">
            Исполнительская дисциплина
          </h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={disciplineData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={6}
                >
                  {disciplineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}} 
                  itemStyle={{fontWeight: 'bold', color: '#1e293b'}}
                />
                <Legend wrapperStyle={{fontSize: '13px', paddingTop: '15px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Динамика пула (Area/Line) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 text-base mb-6 flex items-center gap-2">
            Динамика пула задач (Постановка vs Выполнение)
          </h3>
          <div className="h-[260px] -ml-4">
            {inflowOutflowData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={inflowOutflowData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} allowDecimals={false} />
                        <Tooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}}
                            cursor={{fill: '#f8fafc'}}
                        />
                        <Area type="monotone" dataKey="assigned" name="Поставлено" fill="#e2e8f0" stroke="#94a3b8" fillOpacity={0.5} />
                        <Line type="monotone" dataKey="completed" name="Выполнено" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981'}} activeDot={{r: 6}} />
                        <Legend wrapperStyle={{fontSize: '13px', paddingTop: '15px'}} />
                    </ComposedChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Выберите период "За неделю" или "За месяц"
                </div>
            )}
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2 */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 text-base mb-6 flex items-center gap-2">
          Распределение нагрузки по подразделениям
        </h3>
        <div className="h-[300px] -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={myAvailableUnits.map(u => ({
              name: u.name,
              count: filteredTasks.filter(t => String(t.unitId) === String(u.id)).length
            })).filter(d => d.count > 0)} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} allowDecimals={false} />
              <Tooltip 
                cursor={{fill: '#f8fafc', radius: 8}} 
                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}} 
              />
              <Bar dataKey="count" name="Количество задач" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={45}>
                {myAvailableUnits.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

function MetricBox({ title, value, icon, iconColor, iconBg, danger }: any) {
  return (
    <div className={cn(
      "bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md hover:border-slate-300",
      danger ? "border-red-200" : "border-slate-200"
    )}>
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className="text-sm font-semibold text-slate-500">{title}</div>
        <div className={cn("p-2.5 rounded-xl", iconBg, iconColor)}>
          {icon}
        </div>
      </div>
      <div className={cn("text-4xl font-bold tracking-tight text-slate-800 relative z-10", danger && "text-red-600")}>
        {value}
      </div>
      
      {/* Легкий фоновый отсвет для красоты */}
      {danger && <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-red-50 rounded-full opacity-50 blur-3xl pointer-events-none" />}
    </div>
  );
}