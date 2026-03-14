import { useState } from 'react';
import { Upload, FileText, Table, CheckCircle2, AlertTriangle, Zap, Plus, Calendar } from 'lucide-react';
import type { Task } from '@/types';
import { cn } from '@/utils/cn';
import api from '@/services/api';

interface AutoPlanProps {
  onTasksGenerated: (tasks: Task[]) => void;
}

interface ParsedEvent {
  id: string;
  name: string;
  date: string;
  responsible: string;
  selected: boolean;
}

export function AutoPlan({ onTasksGenerated }: AutoPlanProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    
    try {
      const result = await api.uploadDocument(file);
      setDocumentId(result.id);
      
      // Ждем обработки документа
      setTimeout(async () => {
        try {
          const doc = await api.getDocument(result.id);
          if (doc.status === 'parsed') {
            const parsedEvents: ParsedEvent[] = doc.parsed_data.map((item: any, index: number) => ({
              id: `e${index}`,
              name: item.title || item.name || `Мероприятие ${index + 1}`,
              date: item.deadline || item.date || '',
              responsible: item.responsible || '',
              selected: true,
            }));
            setEvents(parsedEvents);
            setStep('preview');
          } else if (doc.status === 'error') {
            alert(`Ошибка обработки: ${doc.error_message}`);
            setStep('upload');
          } else {
            // Еще обрабатывается
            setTimeout(() => checkDocumentStatus(result.id), 2000);
          }
        } catch (error) {
          console.error('Failed to get document:', error);
          alert('Ошибка при получении документа');
          setStep('upload');
        } finally {
          setLoading(false);
        }
      }, 1500);
    } catch (error) {
      console.error('Failed to upload document:', error);
      alert('Ошибка при загрузке файла');
      setLoading(false);
    }
  };

  const checkDocumentStatus = async (id: number) => {
    try {
      const doc = await api.getDocument(id);
      if (doc.status === 'parsed') {
        const parsedEvents: ParsedEvent[] = doc.parsed_data.map((item: any, index: number) => ({
          id: `e${index}`,
          name: item.title || item.name || `Мероприятие ${index + 1}`,
          date: item.deadline || item.date || '',
          responsible: item.responsible || '',
          selected: true,
        }));
        setEvents(parsedEvents);
        setStep('preview');
        setLoading(false);
      } else if (doc.status === 'error') {
        alert(`Ошибка обработки: ${doc.error_message}`);
        setStep('upload');
        setLoading(false);
      } else {
        setTimeout(() => checkDocumentStatus(id), 2000);
      }
    } catch (error) {
      console.error('Failed to check document status:', error);
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleGenerate = async () => {
    if (!documentId) return;
    
    setLoading(true);
    const selectedIndices = events
      .map((e, index) => e.selected ? index : -1)
      .filter(i => i !== -1);
    
    try {
      const result = await api.generateTasks(documentId, selectedIndices, 'medium');
      
      // Преобразуем созданные задачи в формат компонента
      const generatedTasks: Task[] = result.tasks.map((t: any) => ({
        id: t.id.toString(),
        title: t.title,
        description: `Автоматически сгенерированная задача`,
        status: 'backlog',
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
      console.error('Failed to generate tasks:', error);
      alert('Ошибка при генерации задач');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Автопланирование</h1>
        <p className="text-sm text-slate-500 mt-1">Парсинг документов и автоматическая генерация задач</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-3">
        {[
          { id: 'upload', label: '1. Загрузка', icon: Upload },
          { id: 'preview', label: '2. Предпросмотр', icon: Table },
          { id: 'done', label: '3. Готово', icon: CheckCircle2 },
        ].map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-slate-300" />}
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
              step === s.id ? 'bg-green-100 text-green-700' :
              ['upload', 'preview', 'done'].indexOf(step) > ['upload', 'preview', 'done'].indexOf(s.id) 
                ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'
            )}>
              <s.icon size={14} />
              {s.label}
            </div>
          </div>
        ))}
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
            <p className="text-sm text-slate-500 mb-4">Поддерживаемые форматы: DOC, DOCX, PDF, XLS, XLSX</p>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".doc,.docx,.pdf,.xls,.xlsx"
              onChange={handleFileSelect}
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
                { format: 'DOCX / DOC', desc: 'Таблицы из документов Word с расписанием мероприятий', icon: '📄' },
                { format: 'PDF', desc: 'Сканированные и текстовые PDF с планами', icon: '📋' },
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
                Все документы обрабатываются в изолированном контуре. Данные шифруются AES-256 и не покидают локальную сеть.
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
                        checked={events.every(e => e.selected)}
                        onChange={e => setEvents(events.map(ev => ({ ...ev, selected: e.target.checked })))}
                        className="rounded border-slate-300 text-green-700"
                      />
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Мероприятие</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Дата</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Ответственный</th>
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
                      <td className="py-2 px-3 font-medium text-slate-700">{e.name}</td>
                      <td className="py-2 px-3 text-slate-600 flex items-center gap-1">
                        <Calendar size={12} />
                        {e.date ? new Date(e.date).toLocaleDateString('ru-RU') : '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{e.responsible || '—'}</td>
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
            <br />Все задачи добавлены на канбан-доску в статусе «Запланировано».
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