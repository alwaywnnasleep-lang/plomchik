import { useState, useEffect } from 'react';
import { 
  Upload, FileText, CheckCircle2, AlertTriangle, Zap, 
  Plus, Calendar, Edit2, Save, X, Users, ChevronDown 
} from 'lucide-react';
import type { Task, TaskStatus } from '@/types';
import { cn } from '@/utils/cn';
import api from '@/services/api';

const RANK_TRANSLATIONS: Record<string, string> = {
  private: 'Рядовой', corporal: 'Ефрейтор', sergeant: 'Сержант', staff_sergeant: 'Старшина',
  warrant_officer: 'Прапорщик', lieutenant: 'Лейтенант', sr_lieutenant: 'Ст. лейтенант',
  captain: 'Капитан', major: 'Майор', lt_colonel: 'Подполковник', colonel: 'Полковник',
};

function translateRank(rank: string): string {
  if (!rank) return '';
  return RANK_TRANSLATIONS[rank] || rank;
}

export const parseSafeDate = (dateStr: any): Date | null => {
  if (!dateStr) return null;
  if (typeof dateStr === 'string') {
    const match1 = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (match1) {
      const hours = match1[4] ? Number(match1[4]) : 12;
      const mins = match1[5] ? Number(match1[5]) : 0;
      return new Date(Number(match1[3]), Number(match1[2]) - 1, Number(match1[1]), hours, mins, 0);
    }
    const match2 = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(T|$)/);
    if (match2 && match2[4] !== 'T') {
      return new Date(Number(match2[1]), Number(match2[2]) - 1, Number(match2[3]), 12, 0, 0);
    }
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  return null;
};

const normalizeDateStr = (dateStr: string) => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.substring(0, 10);
  const match = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
      return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return dateStr;
};

interface AutoPlanProps {
  onTasksGenerated: (tasks: Task[]) => void;
}

interface ParsedEvent {
  id: string;
  title: string;
  date: string;
  responsible: string;
  selected: boolean;
  originalIndex: number;
  parentTitle?: string;
  indentLevel?: number;
  remindBefore: string;
  itemType: 'task' | 'event';
}

const remindOptions = [
  { value: '', label: 'Не напоминать' },
  { value: '1_day', label: 'За 1 день' },
  { value: '2_days', label: 'За 2 дня' },
  { value: '3_days', label: 'За 3 дня' },
  { value: '1_week', label: 'За 1 неделю' },
  { value: '1_hour', label: 'За 1 час' },
];

export function AutoPlan({ onTasksGenerated }: AutoPlanProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [dragOver, setDragOver] = useState(false);
  
  // Добавляем хранение самого файла, чтобы отправить его в Базу знаний позже
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [documentId, setDocumentId] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ title: '', date: '', responsible: '' });

  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<number[]>([]);
  const [isUnitsMenuOpen, setIsUnitsMenuOpen] = useState(false);

  useEffect(() => {
    api.getAvailableUnits()
      .then((res: any) => setUnits(Array.isArray(res) ? res : res.results || []))
      .catch(console.error);
  }, []);

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    setUploadedFile(file); // Сохраняем файл в стейт
    try {
      // Отправляем документ только на парсинг
      const result = await api.uploadDocument(file);
      if (!result || !result.id) throw new Error(result?.detail || result?.error || 'Сервер не вернул ID документа.');
      
      setDocumentId(result.id);
      checkDocumentStatus(result.id);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Ошибка: ${error.message || 'Отказано в доступе'}`);
      setStep('upload');
      setLoading(false);
    }
  };

  const checkDocumentStatus = async (id: number) => {
    try {
      const doc = await api.getDocument(id);
      if (doc.status === 'parsed') {
        const parsedEvents: ParsedEvent[] = (doc.parsed_data || []).map((item: any, idx: number) => {
          const titleStr = (item.title || '').toLowerCase();
          const isLikelyEvent = titleStr.includes('совещ') || titleStr.includes('построен') || titleStr.includes('сбор') || titleStr.includes('праздн');

          return {
            id: `e${idx}`,
            title: item.title || `Запись ${idx + 1}`,
            date: normalizeDateStr(item.date || (item.dates?.[0] || '')),
            responsible: item.responsible || '',
            selected: true,
            originalIndex: idx,
            parentTitle: item.parent_title,
            indentLevel: item.indent_level || 0,
            remindBefore: '',
            itemType: item.item_type || (isLikelyEvent ? 'event' : 'task'),
          };
        });
        
        setEvents(parsedEvents);
        setStep('preview');
        setLoading(false);
      } else if (doc.status === 'error') {
        alert(`Ошибка при обработке файла: ${doc.error_message}`);
        setStep('upload');
        setLoading(false);
      } else {
        setTimeout(() => checkDocumentStatus(id), 2000);
      }
    } catch (error) {
      console.error('Status check error:', error);
      setLoading(false);
    }
  };

  const startEdit = (event: ParsedEvent) => {
    setEditingId(event.id);
    setEditValues({ title: event.title, date: normalizeDateStr(event.date), responsible: event.responsible });
  };

  const saveEdit = (id: string) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, title: editValues.title, date: editValues.date, responsible: editValues.responsible } : e));
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const updateRemindBefore = (id: string, value: string) => {
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, remindBefore: value } : e)));
  };

  const updateItemType = (id: string, value: 'task' | 'event') => {
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, itemType: value } : e)));
  };

  const bulkUpdateItemType = (value: 'task' | 'event') => {
    setEvents(prev => prev.map(e => e.selected ? { ...e, itemType: value } : e));
  };

  const handleGenerate = async () => {
    if (!documentId) return;
    if (selectedUnits.length === 0) {
      alert('Пожалуйста, выберите хотя бы одно подразделение для направления задач.');
      return;
    }

    setLoading(true);
    const selectedEvents = events.filter(e => e.selected);
    const selectedIndices = selectedEvents.map(e => e.originalIndex);
    
    const customEvents = selectedEvents.map(e => ({
      index: e.originalIndex,
      title: e.title,
      date: e.date,
      responsible: e.responsible,
      remind_before: e.remindBefore,
      parent_title: e.parentTitle,
      indent_level: e.indentLevel,
      is_milestone: e.itemType === 'event', 
      item_type: e.itemType
    }));
    
    try {
      // 1. Генерируем задачи
      const result = await api.generateTasks(documentId as number, selectedIndices, 'medium', selectedUnits, customEvents);
      const taskList = Array.isArray(result) ? result : (result?.tasks || []);
      
      const generatedTasks: Task[] = [];
      
      for (let i = 0; i < taskList.length; i++) {
        const t = taskList[i];
        const originalEvent = customEvents.find(e => e.title === t.title) || customEvents[i] || customEvents[0] || {} as any;
        
        const rawDate = t.deadline || t.end_date || t.start_date || originalEvent.date;
        const parsedD = parseSafeDate(rawDate);
        const finalDateObj = parsedD ? parsedD : new Date();
        const isoDateString = finalDateObj.toISOString();
        
        const isEvent = t.is_milestone === true || String(t.is_milestone).toLowerCase() === 'true' || originalEvent.item_type === 'event';
        
        let currentTags: string[] = [];
        if (Array.isArray(t.tags)) {
          currentTags = [...t.tags];
        } else if (typeof t.tags === 'string') {
          currentTags = t.tags.split(',').map((s: string) => s.trim()).filter(Boolean);
        }

        if (currentTags.length === 0) currentTags.push('автоплан');
        if (isEvent && !currentTags.includes('мероприятие')) currentTags.push('мероприятие');

        if (t.id) {
           try {
             await api.updateTask(t.id, { 
               status: 'todo', 
               is_milestone: false, 
               tags: currentTags,
               deadline: isoDateString,
               start_date: isoDateString
             });
           } catch (e) {
             console.error(`Не удалось обновить статус и сроки для ${t.title}`, e);
           }
        }

        generatedTasks.push({
          id: t.id?.toString() || `auto_${Math.random()}`,
          title: t.title || originalEvent.title || 'Авто-задача',
          description: t.description || `Сгенерировано из документа: ${fileName}`,
          status: 'todo' as TaskStatus,
          priority: t.priority || 'medium',
          assigneeId: t.assigned_to?.toString() || t.assigneeId || '',
          creatorId: t.created_by?.toString() || t.creatorId || '',
          unitId: t.org_unit?.toString() || t.unitId || selectedUnits[0].toString(),
          deadline: isoDateString,
          start_date: t.start_date || isoDateString,
          createdAt: t.created_at || new Date().toISOString(),
          is_milestone: false,
          tags: currentTags,
        });
      }
      
      // 2. ИСПРАВЛЕНИЕ: Отправляем файл в Базу Знаний только после успешной генерации
      if (uploadedFile) {
        try {
          const kbFormData = new FormData();
          kbFormData.append('title', fileName.split('.')[0] || fileName);
          kbFormData.append('description', 'План загружен и разобран через модуль Автопланирования');
          kbFormData.append('category', 'plans');
          kbFormData.append('file', uploadedFile);
          await api.uploadKnowledgeDocument(kbFormData);
        } catch (kbError) {
          console.warn('Не удалось автоматически сохранить файл в Базу Знаний:', kbError);
        }
      }

      onTasksGenerated(generatedTasks);
      setStep('done');
    } catch (error) {
      console.error('Generation error:', error);
      alert('Ошибка при генерации задач');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    setEvents(events.map(e => ({ ...e, selected: checked })));
  };

  const selectedCount = events.filter(e => e.selected).length;

  return (
    <div className="space-y-6 relative animate-in fade-in duration-300">
      <div>
        <h1 className="text-xl font-bold text-slate-800 uppercase tracking-widest">Автопланирование</h1>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">Парсинг плана‑календаря и автоматическая генерация задач</p>
      </div>

      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            className={cn(
              'border-2 border-dashed rounded-md p-12 text-center transition-colors cursor-pointer',
              dragOver ? 'border-green-600 bg-green-50' : 'border-slate-300 bg-white hover:bg-slate-50'
            )}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { 
              e.preventDefault(); 
              setDragOver(false); 
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Upload size={48} className="mx-auto text-slate-400 mb-4" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-2">Загрузите документ</h3>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6">Поддерживаемые форматы: DOCX, XLSX, XLS</p>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".docx,.xlsx,.xls"
              onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              disabled={loading}
            />
            <button
              disabled={loading}
              className="px-6 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 text-xs font-bold uppercase tracking-wider disabled:opacity-50 shadow-sm transition-colors"
            >
              {loading ? 'Загрузка...' : 'Выбрать файл'}
            </button>
            <p className="text-[10px] uppercase font-bold text-slate-400 mt-4">или перетащите файл сюда</p>
          </div>

          <div className="bg-white rounded-md border border-slate-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-2">
              <FileText size={16} className="text-blue-500" />
              Поддерживаемые форматы
            </h3>
            <div className="space-y-3">
              {[
                { format: 'DOCX', desc: 'Таблицы из документов Word с расписанием мероприятий', icon: '📄' },
                { format: 'XLSX / XLS', desc: 'Таблицы Excel с планами-графиками', icon: '📊' },
              ].map(f => (
                <div key={f.format} className="flex items-start gap-3 p-3 bg-slate-50 rounded-md border border-slate-100">
                  <span className="text-xl">{f.icon}</span>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">{f.format}</div>
                    <div className="text-[11px] font-medium text-slate-500 mt-0.5">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-md border border-slate-200 p-5 shadow-sm">
            
            <div className="flex flex-wrap items-center justify-between mb-4 border-b border-slate-100 pb-4 gap-4">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-blue-500" />
                <span className="text-sm font-bold text-slate-700">{fileName}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-green-100 text-green-700 rounded">Разобрано</span>
              </div>
              
              <div className="flex items-center gap-4">
                {selectedCount > 0 && (
                  <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Сделать выбранные:</span>
                    <button 
                      onClick={() => bulkUpdateItemType('task')}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                      title="Отмеченные записи станут Задачами (попадут в Канбан, если срок < 2 дн)"
                    >
                      Задачами
                    </button>
                    <button 
                      onClick={() => bulkUpdateItemType('event')}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
                      title="Отмеченные записи станут Мероприятиями (только Календарь)"
                    >
                      Мероприятиями
                    </button>
                  </div>
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Найдено: {events.length}</span>
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-8">
                      <input
                        type="checkbox"
                        checked={events.length > 0 && events.every(e => e.selected)}
                        onChange={e => toggleSelectAll(e.target.checked)}
                        className="rounded border-slate-300 text-green-600 focus:ring-green-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-1/3">Запись / Мероприятие</th>
                    <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Дата</th>
                    <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Тип</th>
                    <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Ответственный</th>
                    <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Напомнить за</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={e.selected}
                          onChange={() => setEvents(events.map(ev => ev.id === e.id ? { ...ev, selected: !ev.selected } : ev))}
                          className="rounded border-slate-300 text-green-600 focus:ring-green-600 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-3" style={{ paddingLeft: `${(e.indentLevel || 0) * 16 + 12}px` }}>
                        {editingId === e.id ? (
                          <input
                            value={editValues.title}
                            onChange={e => setEditValues({ ...editValues, title: e.target.value })}
                            className="border border-slate-300 rounded-md px-2 py-1 w-full text-xs font-bold outline-none focus:border-green-600 bg-white"
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span className={cn(
                              "font-bold flex items-center gap-1.5 text-xs transition-colors",
                              e.selected ? "text-slate-800" : "text-slate-400"
                            )}>
                              {((e.indentLevel ?? 0) > 0 || e.parentTitle) && <span className="text-slate-300">↳</span>}
                              {e.title}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 w-32">
                        {editingId === e.id ? (
                          <input
                            type="date"
                            value={editValues.date}
                            onChange={e => setEditValues({ ...editValues, date: e.target.value })}
                            className="border border-slate-300 rounded-md px-2 py-1 w-full text-xs font-bold outline-none focus:border-green-600 bg-white"
                          />
                        ) : (
                          <span className={cn(
                            "text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap",
                            e.selected ? "text-slate-700" : "text-slate-400"
                          )}>
                            <Calendar size={12} className={e.selected ? "text-slate-400" : "text-slate-300"} />
                            {e.date ? new Date(e.date).toLocaleDateString('ru-RU') : '—'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                         <select
                          value={e.itemType}
                          onChange={(ev) => updateItemType(e.id, ev.target.value as 'task' | 'event')}
                          disabled={!e.selected}
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider border rounded-md px-2 py-1 outline-none transition-colors cursor-pointer",
                            !e.selected ? "bg-slate-50 border-slate-200 text-slate-400" :
                            e.itemType === 'event' ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-blue-50 border-blue-200 text-blue-700"
                          )}
                        >
                          <option value="task">📝 Задача</option>
                          <option value="event">📅 Мероприятие</option>
                        </select>
                      </td>

                      <td className="py-2 px-3 text-xs font-bold text-slate-700">
                        {editingId === e.id ? (
                          <input
                            value={editValues.responsible}
                            onChange={e => setEditValues({ ...editValues, responsible: e.target.value })}
                            className="border border-slate-300 rounded-md px-2 py-1 w-full text-xs font-bold outline-none focus:border-green-600 bg-white"
                          />
                        ) : (
                          <span className={cn(
                            "truncate max-w-[150px] block",
                            e.selected ? "text-slate-700" : "text-slate-400"
                          )}>
                            {e.responsible || '—'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={e.remindBefore}
                          onChange={(ev) => updateRemindBefore(e.id, ev.target.value)}
                          disabled={!e.selected}
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider border rounded-md px-2 py-1 outline-none w-full transition-colors cursor-pointer",
                            e.selected ? "border-slate-200 bg-white focus:border-green-600 text-slate-700" : "border-slate-100 bg-slate-50/50 text-slate-400"
                          )}
                        >
                          {remindOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right">
                        {editingId === e.id ? (
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => saveEdit(e.id)} className="text-green-600 hover:text-white hover:bg-green-600 border border-green-200 p-1 rounded transition-colors shadow-sm"><Save size={14} /></button>
                            <button onClick={cancelEdit} className="text-red-500 hover:text-white hover:bg-red-500 border border-red-200 p-1 rounded transition-colors shadow-sm"><X size={14} /></button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(e)} disabled={!e.selected} className="text-slate-500 hover:text-blue-600 border border-transparent hover:border-blue-200 hover:bg-blue-50 p-1 rounded transition-colors disabled:opacity-50"><Edit2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                К генерации: <span className="text-green-600 text-sm">{selectedCount}</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => setStep('upload')}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Отмена
                </button>
                
                <div className="relative">
                  <button 
                    onClick={() => setIsUnitsMenuOpen(!isUnitsMenuOpen)} 
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded-md transition-colors shadow-sm",
                      selectedUnits.length > 0 ? "border-green-600 text-green-700 bg-green-50" : "border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
                    )}
                  >
                    <Users size={14} />
                    Направить: {selectedUnits.length > 0 ? `${selectedUnits.length} подр.` : 'Кому?'}
                    <ChevronDown size={14} className={cn("transition-transform", isUnitsMenuOpen && "rotate-180")} />
                  </button>

                  {isUnitsMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsUnitsMenuOpen(false)} />
                      <div className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-md shadow-xl border border-slate-200 z-50 overflow-hidden">
                        <div className="p-2 border-b border-slate-100 bg-slate-50">
                          <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-white rounded transition-colors">
                            <input 
                              type="checkbox" 
                              checked={selectedUnits.length === units.length && units.length > 0} 
                              onChange={e => e.target.checked ? setSelectedUnits(units.map(u => u.id)) : setSelectedUnits([])}
                              className="rounded border-slate-300 text-green-600 focus:ring-green-600"
                            />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Выбрать все</span>
                          </label>
                        </div>
                        <div className="max-h-48 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                          {units.map(u => (
                            <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-50 rounded transition-colors border border-transparent hover:border-slate-200">
                              <input 
                                type="checkbox" 
                                checked={selectedUnits.includes(u.id)}
                                onChange={() => setSelectedUnits(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                                className="rounded border-slate-300 text-green-600 focus:ring-green-600"
                              />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">{u.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={loading || selectedCount === 0 || selectedUnits.length === 0}
                  className="flex items-center gap-2 px-6 py-2 text-xs font-bold uppercase tracking-wider bg-green-700 text-white rounded-md hover:bg-green-800 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <Zap size={14} />
                  {loading ? 'Генерация...' : 'Сгенерировать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="bg-white rounded-md border border-slate-200 p-12 text-center shadow-sm animate-in zoom-in duration-500">
          <CheckCircle2 size={56} className="mx-auto text-green-600 mb-4" />
          <h3 className="text-lg font-bold uppercase tracking-wider text-slate-800 mb-2">Генерация завершена!</h3>
          <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed max-w-md mx-auto">
            Обработано <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{events.filter(e => e.selected).length}</span> записей из документа «{fileName}».<br/>
            Они направлены в выбранные подразделения.<br/>
          </p>
          <div className="flex justify-center">
            <button
              onClick={() => { 
                setStep('upload'); 
                setEvents([]); 
                setFileName(''); 
                setDocumentId(null); 
                setSelectedUnits([]); 
                setUploadedFile(null); // Очищаем файл
              }}
              className="flex items-center gap-2 px-6 py-2 text-xs font-bold uppercase tracking-wider border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Plus size={14} />
              Загрузить новый план
            </button>
          </div>
        </div>
      )}
    </div>
  );
}