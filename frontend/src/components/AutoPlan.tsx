import { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, Zap, Plus, Calendar, Edit2, Save, X } from 'lucide-react';
import type { Task } from '@/types';
import { cn } from '@/utils/cn';
import api from '@/services/api';

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
  const [fileName, setFileName] = useState('');
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ title: '', date: '', responsible: '' });

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    try {
      const result = await api.uploadDocument(file);
      setDocumentId(result.id);
      checkDocumentStatus(result.id);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Ошибка при загрузке файла');
      setLoading(false);
    }
  };

  const checkDocumentStatus = async (id: number) => {
    try {
      const doc = await api.getDocument(id);
      if (doc.status === 'parsed') {
        const parsedEvents: ParsedEvent[] = (doc.parsed_data || []).map((item: any, idx: number) => ({
          id: `e${idx}`,
          title: item.title || `Мероприятие ${idx + 1}`,
          date: item.date || (item.dates?.[0] || ''),
          responsible: item.responsible || '',
          selected: true,
          originalIndex: idx,
          parentTitle: item.parent_title,
          indentLevel: item.indent_level || 0,
          remindBefore: '',
        }));
        setEvents(parsedEvents);
        setStep('preview');
        setLoading(false);
      } else if (doc.status === 'error') {
        alert(`Ошибка: ${doc.error_message}`);
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
    setEditValues({
      title: event.title,
      date: event.date.split('T')[0],
      responsible: event.responsible,
    });
  };

  const saveEdit = (id: string) => {
    setEvents(prev =>
      prev.map(e =>
        e.id === id
          ? { ...e, title: editValues.title, date: editValues.date, responsible: editValues.responsible }
          : e
      )
    );
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const updateRemindBefore = (id: string, value: string) => {
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, remindBefore: value } : e)));
  };

  const handleGenerate = async () => {
    if (!documentId) return;
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
    }));
    try {
      const result = await api.generateTasks(documentId as number, selectedIndices, 'medium', undefined, customEvents);
      const generatedTasks: Task[] = result.tasks.map((t: any) => ({
        id: t.id.toString(),
        title: t.title,
        description: `Автоматически сгенерированная задача`,
        status: 'planned',
        priority: 'medium',
        assigneeId: '',
        creatorId: '',
        unitId: '',
        deadline: t.deadline || '',
        createdAt: new Date().toISOString(),
        tags: ['автоплан'],
      }));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Автопланирование</h1>
        <p className="text-sm text-slate-500 mt-1">Парсинг плана‑календаря и автоматическая генерация задач</p>
      </div>

      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            className={cn(
              'border-2 border-dashed rounded-2xl p-12 text-center transition-colors',
              dragOver ? 'border-green-700 bg-green-50' : 'border-slate-300 bg-white'
            )}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { 
              e.preventDefault(); 
              setDragOver(false); 
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}
          >
            <Upload size={48} className="mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">Загрузите документ</h3>
            <p className="text-sm text-slate-500 mb-4">Поддерживаемые форматы: DOCX, XLSX, XLS</p>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".docx,.xlsx,.xls"
              onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              disabled={loading}
            />
            <button
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={loading}
              className="px-6 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 text-sm disabled:opacity-50"
            >
              {loading ? 'Загрузка...' : 'Выбрать файл'}
            </button>
            <p className="text-xs text-slate-400 mt-3">или перетащите файл сюда</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <FileText size={16} className="text-blue-500" />
              Поддерживаемые форматы
            </h3>
            <div className="space-y-3">
              {[
                { format: 'DOCX', desc: 'Таблицы из документов Word с расписанием мероприятий', icon: '📄' },
                { format: 'XLSX / XLS', desc: 'Таблицы Excel с планами-графиками', icon: '📊' },
              ].map(f => (
                <div key={f.format} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <span className="text-xl">{f.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-slate-700">{f.format}</div>
                    <div className="text-xs text-slate-500">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-amber-50 rounded-lg flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-700">
                Старый формат .doc не поддерживается. Пожалуйста, сохраните документ как .docx.
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-blue-500" />
                <span className="text-sm font-medium text-slate-700">{fileName}</span>
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Разобрано</span>
              </div>
              <span className="text-xs text-slate-400">Найдено мероприятий: {events.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 w-8">
                      <input
                        type="checkbox"
                        checked={events.length > 0 && events.every(e => e.selected)}
                        onChange={e => toggleSelectAll(e.target.checked)}
                        className="rounded border-slate-300 text-green-700"
                      />
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Мероприятие</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Дата</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Ответственный</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Напомнить за</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(e => (
                    <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={e.selected}
                          onChange={() => setEvents(events.map(ev => ev.id === e.id ? { ...ev, selected: !ev.selected } : ev))}
                          className="rounded border-slate-300 text-green-700"
                        />
                      </td>
                      <td className="py-2 px-3" style={{ paddingLeft: `${(e.indentLevel || 0) * 24 + 12}px` }}>
                        {editingId === e.id ? (
                          <input
                            value={editValues.title}
                            onChange={e => setEditValues({ ...editValues, title: e.target.value })}
                            className="border rounded px-2 py-1 w-full"
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700 flex items-center gap-1.5">
                              {((e.indentLevel ?? 0) > 0 || e.parentTitle) && <span className="text-slate-300">↳</span>}
                              {e.title}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {editingId === e.id ? (
                          <input
                            type="date"
                            value={editValues.date}
                            onChange={e => setEditValues({ ...editValues, date: e.target.value })}
                            className="border rounded px-2 py-1"
                          />
                        ) : (
                          <span className="text-slate-600 flex items-center gap-1">
                            <Calendar size={12} />
                            {e.date ? new Date(e.date).toLocaleDateString('ru-RU') : '—'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {editingId === e.id ? (
                          <input
                            value={editValues.responsible}
                            onChange={e => setEditValues({ ...editValues, responsible: e.target.value })}
                            className="border rounded px-2 py-1 w-full"
                          />
                        ) : (
                          <span className="text-slate-600">{e.responsible || '—'}</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={e.remindBefore}
                          onChange={(ev) => updateRemindBefore(e.id, ev.target.value)}
                          className="text-sm border rounded px-2 py-1"
                        >
                          {remindOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right">
                        {editingId === e.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(e.id)} className="text-green-700"><Save size={16} /></button>
                            <button onClick={cancelEdit} className="text-red-500"><X size={16} /></button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(e)} className="text-slate-400 hover:text-green-700"><Edit2 size={16} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                Выбрано: {events.filter(e => e.selected).length} из {events.length}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('upload')}
                  disabled={loading}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Назад
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading || events.filter(e => e.selected).length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50"
                >
                  <Zap size={14} />
                  {loading ? 'Генерация...' : `Сгенерировать задачи (${events.filter(e => e.selected).length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <CheckCircle2 size={64} className="mx-auto text-green-700 mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-2">Задачи сгенерированы!</h3>
          <p className="text-sm text-slate-500 mb-6">
            Создано {events.filter(e => e.selected).length} задач из документа «{fileName}».
            <br />Все задачи добавлены в календарь со статусом «Запланировано».
            <br />За 2 дня до дедлайна они автоматически попадут в канбан-доску.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => { setStep('upload'); setEvents([]); setFileName(''); setDocumentId(null); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <Plus size={14} />
              Загрузить ещё
            </button>
          </div>
        </div>
      )}
    </div>
  );
}