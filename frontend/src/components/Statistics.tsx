import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
  LineChart, Line, ComposedChart, Area
} from 'recharts';
import { 
  CheckCircle, AlertTriangle, Target, Medal, Briefcase, Building2, Calendar, Award, Activity
} from 'lucide-react';
import type { Task, OrgUnit, User as UserType } from '@/types';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';

interface StatisticsProps {
  tasks: Task[];
  units?: OrgUnit[];
  users?: UserType[];
  onTasksChange?: (tasks: Task[]) => void;
}

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
  units, // ФИКС: Убран дефолтный массив, чтобы не ломать useEffect
  users, // ФИКС: Убран дефолтный массив
  onTasksChange 
}: StatisticsProps) {
  const { user } = useAuth();
  
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year' | 'all'>('all');
  const [extraUsers, setExtraUsers] = useState<Record<string, any>>({});

  const [localUnits, setLocalUnits] = useState<OrgUnit[]>([]);
  const [localUsers, setLocalUsers] = useState<UserType[]>([]);

  // ФИКС: Делаем запрос ровно ОДИН раз при монтировании компонента, если данные не переданы
  useEffect(() => {
    if (!units || units.length === 0) {
      api.getAvailableUnits().then((res: any) => setLocalUnits(Array.isArray(res) ? res : res.results || [])).catch(console.error);
    }
    if (!users || users.length === 0) {
      api.getAllUsers().then((res: any) => setLocalUsers(Array.isArray(res) ? res : res.results || [])).catch(console.error);
    }
  }, []); // <--- ПУСТОЙ МАССИВ, цикл разорван!

  const displayUnits = units?.length ? units : localUnits;
  const displayUsers = users?.length ? users : localUsers;

  const onTasksChangeRef = useRef(onTasksChange);
  useEffect(() => { onTasksChangeRef.current = onTasksChange; }, [onTasksChange]);

  const myAvailableUnits = useMemo(() => {
    if (!user || !displayUnits || !Array.isArray(displayUnits)) return [];
    
    const hasFullAccess = ['commander', 'deputy_commander', 'admin'].includes(user.role || '');
    if (hasFullAccess) return displayUnits;

    return displayUnits.filter(u => {
      const isCommander = String(u.commanderId || '') === String(user.id);
      const myUnitId = String(user.org_unit || '');
      return isCommander || String(u.id) === myUnitId;
    });
  }, [displayUnits, user]);

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
      if (dateRange === 'month') limitDate.setDate(limitDate.getDate() - 30);
      if (dateRange === 'year') limitDate.setFullYear(limitDate.getFullYear() - 1);

      result = result.filter(t => {
        const createdAt = t.createdAt ? new Date(t.createdAt) : new Date(0);
        if (createdAt >= limitDate) return true;
        
        const deadline = t.deadline ? new Date(t.deadline) : null;
        if (deadline && deadline >= limitDate) return true;
        
        const endedRaw = (t as any).end_date || (t as any).updated_at;
        if (endedRaw) {
          const endedAt = new Date(endedRaw);
          if (endedAt >= limitDate) return true;
        }

        const isDone = ['done', 'completed'].includes(String(t.status).toLowerCase());
        if (!isDone) return true;

        return false;
      });
    }
    return result;
  }, [tasks, myAvailableUnits, selectedUnit, dateRange]);

  const idsToLoad = useMemo(() => {
    const stats: Record<string, number> = {};
    const unitStats: Record<string, number> = {};
    const fallbacks: Record<string, any> = {};

    filteredTasks.forEach(t => {
      const status = String(t.status).toLowerCase();
      const isDone = status === 'done' || status === 'completed';
      
      if (isDone) {
        const rawId = t.assigneeId || (t as any).assigned_to || ((t as any).assignee?.id);
        if (rawId) {
          const id = String(rawId).trim();
          stats[id] = (stats[id] || 0) + 1;
          if ((t as any).assignee) fallbacks[id] = (t as any).assignee;
        }

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
      const existsInProps = displayUsers.some(u => String(u.id) === id);
      const existsInExtra = extraUsers[id];

      if (!existsInProps && !existsInExtra) {
        setExtraUsers(prev => ({ ...prev, [id]: { _fetching: true } }));
        api.getUser(Number(id))
          .then(userObj => setExtraUsers(prev => ({ ...prev, [id]: userObj })))
          .catch(() => setExtraUsers(prev => ({ ...prev, [id]: { _error: true } })));
      }
    });
  }, [idsToLoad.ids, displayUsers, extraUsers]);

  const topPerformer = useMemo(() => {
    if (!idsToLoad.bestUserId) return null;
    const id = idsToLoad.bestUserId;
    const count = idsToLoad.userCounts[id];
    const targetUser = displayUsers.find(u => String(u.id) === id) || extraUsers[id];
    const fallbackObj = idsToLoad.fallbackObjs[id];

    if (targetUser && !targetUser._fetching && !targetUser._error) {
      return { name: getSafeName(targetUser, id), rank: targetUser.rank || '—', count };
    }
    if (fallbackObj) {
      return { name: getSafeName(fallbackObj, id), rank: fallbackObj.rank || '—', count };
    }
    return { name: targetUser?._fetching ? 'Загрузка...' : `Сотрудник ID-${id}`, rank: '—', count };
  }, [idsToLoad, displayUsers, extraUsers]);

  const topUnit = useMemo(() => {
    if (!idsToLoad.bestUnitId) return null;
    const unitId = idsToLoad.bestUnitId;
    const count = idsToLoad.unitCounts[unitId];
    const foundUnit = myAvailableUnits.find(u => String(u.id) === String(unitId));
    if (!foundUnit) return null;

    let commanderName = 'Не назначен';
    if (idsToLoad.commanderIdToLoad) {
      const cId = idsToLoad.commanderIdToLoad;
      const targetUser = displayUsers.find(u => String(u.id) === cId) || extraUsers[cId];
      if (targetUser && !targetUser._fetching && !targetUser._error) {
        commanderName = getSafeName(targetUser, cId);
      } else if (targetUser?._fetching) {
        commanderName = 'Загрузка...';
      } else {
        commanderName = `Командир ID-${cId}`;
      }
    }

    return { name: foundUnit.name, commanderName, count };
  }, [idsToLoad, myAvailableUnits, displayUsers, extraUsers]);

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
      { name: 'Выполнено в срок', value: counts.onTime, color: '#10b981' }, 
      { name: 'С нарушением срока', value: counts.lateDone, color: '#f59e0b' }, 
      { name: 'В работе (по графику)', value: counts.onTrack, color: '#3b82f6' }, 
      { name: 'Просрочено', value: counts.overdue, color: '#ef4444' }, 
    ].filter(d => d.value > 0);
  }, [filteredTasks]);

  const inflowOutflowData = useMemo(() => {
    const map = new Map();
    const now = new Date();
    
    if (dateRange === 'week' || dateRange === 'month') {
      const days = dateRange === 'week' ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const label = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        map.set(label, { day: label, assigned: 0, completed: 0 });
      }
      
      filteredTasks.forEach(t => {
        if (t.createdAt) {
          const d = new Date(t.createdAt);
          const label = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
          if (map.has(label)) map.get(label).assigned++;
        }
        if (['done', 'completed'].includes(String(t.status).toLowerCase())) {
          const endDateRaw = (t as any).end_date || (t as any).updated_at || t.createdAt;
          if (endDateRaw) {
            const d = new Date(endDateRaw);
            const label = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            if (map.has(label)) map.get(label).completed++;
          }
        }
      });
    } else {
      const monthsCount = dateRange === 'year' ? 12 : 12;
      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
        map.set(label, { day: label, assigned: 0, completed: 0 });
      }
      
      filteredTasks.forEach(t => {
        if (t.createdAt) {
          const d = new Date(t.createdAt);
          const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
          if (map.has(label)) map.get(label).assigned++;
        }
        if (['done', 'completed'].includes(String(t.status).toLowerCase())) {
          const endDateRaw = (t as any).end_date || (t as any).updated_at || t.createdAt;
          if (endDateRaw) {
            const d = new Date(endDateRaw);
            const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
            if (map.has(label)) map.get(label).completed++;
          }
        }
      });
    }
    
    return Array.from(map.values());
  }, [filteredTasks, dateRange]);

  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const done = filteredTasks.filter(t => ['done', 'completed'].includes(String(t.status).toLowerCase())).length;
    const overdue = filteredTasks.filter(t => 
      !['done', 'completed'].includes(String(t.status).toLowerCase()) && t.deadline && new Date(t.deadline) < new Date()
    ).length;
    return {
      total, done, overdue,
      rate: total ? Math.round((done / total) * 100) : 0
    };
  }, [filteredTasks]);

  return (
    <div className="space-y-6 pb-10 bg-slate-50 p-4 rounded-xl animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-md border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-3 uppercase tracking-wider">
            <div className="p-2 bg-slate-100 text-slate-600 rounded">
              <Activity size={20} />
            </div>
            Аналитика эффективности
          </h1>
          <p className="text-slate-500 mt-2 text-xs font-bold uppercase tracking-wider">Контроль задач и распределение нагрузки</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-md transition-colors hover:bg-slate-100">
            <Calendar size={16} className="text-slate-500" />
            <select 
              className="border-none bg-transparent font-bold text-slate-700 uppercase tracking-wider focus:ring-0 text-xs cursor-pointer outline-none p-0"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
            >
              <option value="all">За все время</option>
              <option value="week">За 7 дней</option>
              <option value="month">За 30 дней</option>
              <option value="year">За год</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-md transition-colors hover:bg-slate-100">
            <Briefcase size={16} className="text-slate-500" />
            <select 
              className="border-none bg-transparent font-bold text-slate-700 uppercase tracking-wider focus:ring-0 text-xs cursor-pointer outline-none min-w-[150px] p-0"
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
        <MetricBox title="Активных задач" value={metrics.total} icon={<Target size={20}/>} iconColor="text-blue-600" iconBg="bg-blue-50" />
        <MetricBox title="Выполнено" value={metrics.done} icon={<CheckCircle size={20}/>} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <MetricBox title="Эффективность" value={`${metrics.rate}%`} icon={<Medal size={20}/>} iconColor="text-amber-600" iconBg="bg-amber-50" />
        <MetricBox title="Просрочено" value={metrics.overdue} icon={<AlertTriangle size={20}/>} iconColor="text-red-600" iconBg="bg-red-50" danger={metrics.overdue > 0} />
      </div>

      {/* LEADERBOARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Лидер */}
        <div className="bg-white border border-slate-200 rounded-md p-5 shadow-sm flex items-center gap-5 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="w-14 h-14 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Award size={28} className="group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Сотрудник периода</h4>
            {topPerformer && topPerformer.count > 0 ? (
              <>
                <div className="text-lg font-bold text-slate-800 leading-tight truncate" title={topPerformer.name}>
                  {topPerformer.name}
                </div>
                <div className="text-xs text-slate-500 mb-2 truncate font-medium">{topPerformer.rank}</div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                  {topPerformer.count} задач закрыто
                </div>
              </>
            ) : (
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2">Нет закрытых задач</div>
            )}
          </div>
        </div>

        {/* Лучшее подразделение */}
        <div className="bg-white border border-slate-200 rounded-md p-5 shadow-sm flex items-center gap-5 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="w-14 h-14 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Building2 size={28} className="group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Подразделение периода</h4>
            {topUnit && topUnit.count > 0 ? (
              <>
                <div className="text-lg font-bold text-slate-800 leading-tight truncate" title={topUnit.name}>
                  {topUnit.name}
                </div>
                <div className="text-xs text-slate-500 mb-2 truncate font-medium">Ком: {topUnit.commanderName}</div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider">
                  {topUnit.count} задач закрыто
                </div>
              </>
            ) : (
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2">Нет закрытых задач</div>
            )}
          </div>
        </div>

      </div>

      {/* CHARTS ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Исполнительская дисциплина (Pie) */}
        <div className="lg:col-span-1 bg-white p-6 rounded-md border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-6 flex items-center gap-2">
            Дисциплина
          </h3>
          <div className="h-[240px]">
            {disciplineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={disciplineData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={4}
                  >
                    {disciplineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '10px'}} 
                    itemStyle={{fontWeight: 'bold', color: '#1e293b', fontSize: '12px'}}
                  />
                  <Legend wrapperStyle={{fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '15px'}} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200">
                Нет данных
              </div>
            )}
          </div>
        </div>

        {/* Динамика пула (Area/Line) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-md border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-6 flex items-center gap-2">
            Динамика (Постановка vs Выполнение)
          </h3>
          <div className="h-[240px] -ml-4">
            {inflowOutflowData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={inflowOutflowData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} dy={10} minTickGap={15} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} allowDecimals={false} />
                        <Tooltip 
                            contentStyle={{borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '10px'}}
                            cursor={{fill: '#f8fafc'}}
                        />
                        <Area type="monotone" dataKey="assigned" name="Поставлено" fill="#e2e8f0" stroke="#94a3b8" fillOpacity={0.3} />
                        <Line type="monotone" dataKey="completed" name="Выполнено" stroke="#10b981" strokeWidth={2} dot={{r: 3, fill: '#10b981'}} activeDot={{r: 5}} />
                        <Legend wrapperStyle={{fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '15px'}} />
                    </ComposedChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200">
                  Нет данных
                </div>
            )}
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2 */}
      <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-6 flex items-center gap-2">
          Распределение нагрузки по подразделениям
        </h3>
        <div className="h-[280px] -ml-4">
          {myAvailableUnits.length > 0 && filteredTasks.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={myAvailableUnits.map(u => ({
                name: u.name,
                count: filteredTasks.filter(t => String(t.unitId) === String(u.id)).length
              })).filter(d => d.count > 0)} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} allowDecimals={false} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}} 
                  contentStyle={{borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '10px'}} 
                />
                <Bar dataKey="count" name="Количество задач" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {myAvailableUnits.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200">
              Нет данных для отображения
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function MetricBox({ title, value, icon, iconColor, iconBg, danger }: any) {
  return (
    <div className={cn(
      "bg-white p-5 rounded-md border shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md hover:border-slate-300",
      danger ? "border-red-200" : "border-slate-200"
    )}>
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</div>
        <div className={cn("p-2 rounded", iconBg, iconColor)}>
          {icon}
        </div>
      </div>
      <div className={cn("text-3xl font-bold tracking-tight text-slate-800 relative z-10", danger && "text-red-600")}>
        {value}
      </div>
      
      {danger && <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-red-50 rounded-full opacity-50 blur-2xl pointer-events-none" />}
    </div>
  );
}