import { useState, useEffect } from 'react';
import { Download, Calendar, Filter, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import api from '@/services/api';

interface ReportGeneratorProps {
  onClose: () => void;
}

export function ReportGenerator({ onClose }: ReportGeneratorProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [unitId, setUnitId] = useState('');
  const [status, setStatus] = useState('');
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getUnits().then(data => {
      setUnits(Array.isArray(data) ? data : (data.results || []));
    }).catch(console.error);
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (unitId) params.append('unit_id', unitId);
      if (status) params.append('status', status);

      const url = `/api/reports/generate/?${params.toString()}`;
      // Используем fetch для получения файла
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${api.getToken()}`,
        },
      });
      if (!response.ok) {
        throw new Error('Ошибка при генерации отчёта');
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `report_${new Date().toISOString().slice(0,19)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Report generation error:', error);
      alert('Не удалось сформировать отчёт');
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Download size={20} className="text-green-700" />
              Сформировать отчёт
            </h2>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Дата начала</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Дата окончания</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Подразделение</label>
              <select
                value={unitId}
                onChange={e => setUnitId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
              >
                <option value="">Все подразделения</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Статус задачи</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
              >
                <option value="">Все статусы</option>
                <option value="planned">Запланирована</option>
                <option value="todo">К выполнению</option>
                <option value="in_progress">В работе</option>
                <option value="review">На проверке</option>
                <option value="done">Выполнена</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
              Отмена
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50"
            >
              <Download size={14} />
              {loading ? 'Формирование...' : 'Скачать отчёт'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}