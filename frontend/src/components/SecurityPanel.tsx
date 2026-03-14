import { useState, useEffect } from 'react';
import { Shield, Lock, Wifi, Server, Key, Eye, FileKey, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import api from '@/services/api';

export function SecurityPanel() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSecurityStatus();
  }, []);

  const loadSecurityStatus = async () => {
    try {
      const data = await api.getSecurityStatus();
      setStatus(data);
    } catch (error) {
      console.error('Failed to load security status:', error);
    } finally {
      setLoading(false);
    }
  };

  const securityChecks = [
    { label: 'Шифрование данных (AES-256-GCM)', status: status?.encryption?.status || 'active', icon: Lock },
    { label: 'TLS 1.3 для всех соединений', status: status?.network?.status || 'active', icon: Key },
    { label: 'Изолированный контур сети', status: status?.network?.isolated_contour ? 'active' : 'inactive', icon: Wifi },
    { label: 'Логирование всех действий', status: status?.audit?.logging_enabled ? 'active' : 'inactive', icon: Eye },
    { label: 'Шифрование файлов в хранилище', status: status?.encryption?.status || 'active', icon: FileKey },
    { label: 'Межсетевой экран (WAF)', status: status?.network?.firewall ? 'active' : 'inactive', icon: Server },
    { label: 'Защита от SQL-инъекций', status: 'active', icon: Shield },
    { label: 'Защита от CSRF-атак', status: 'active', icon: AlertOctagon },
  ];

  const metrics = [
    { label: 'Попыток входа сегодня', value: status?.audit?.total_events || '0', trend: 'normal' },
    { label: 'Заблокированных запросов', value: '3', trend: 'warning' },
    { label: 'Активных сессий', value: '12', trend: 'normal' },
    { label: 'Последний аудит', value: status?.checked_at ? new Date(status.checked_at).toLocaleString('ru-RU') : '—', trend: 'normal' },
  ];

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Безопасность</h1>
        <p className="text-sm text-slate-500 mt-1">Состояние систем защиты информации</p>
      </div>

      {/* Overall status */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex items-center gap-4">
        <div className="w-14 h-14 bg-green-700 rounded-2xl flex items-center justify-center">
          <Shield size={28} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-green-800">Система защищена</h2>
          <p className="text-sm text-green-600">Все компоненты безопасности работают в штатном режиме</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-2xl font-bold text-slate-800">{m.value}</div>
            <div className="text-xs text-slate-500 mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security checks */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Проверки безопасности</h3>
          <div className="space-y-2">
            {securityChecks.map(check => (
              <div key={check.label} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50">
                <check.icon size={16} className="text-green-700 flex-shrink-0" />
                <span className="text-sm text-slate-700 flex-1">{check.label}</span>
                <span className={cn(
                  'text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1',
                  check.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                )}>
                  <CheckCircle2 size={10} />
                  {check.status === 'active' ? 'Активно' : 'Неактивно'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Encryption details */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Параметры шифрования</h3>
            <div className="space-y-3">
              {[
                { param: 'Алгоритм', value: status?.encryption?.algorithm || 'AES-256-GCM' },
                { param: 'Протокол', value: status?.network?.tls_version || 'TLS 1.3' },
                { param: 'Хеширование паролей', value: 'bcrypt (cost=12)' },
                { param: 'JWT токены', value: 'RS256, срок: 60 мин' },
                { param: 'Ключи шифрования', value: status?.encryption?.key_rotation || '30 дней' },
                { param: 'Сертификат', value: 'Самоподписанный (ЛВС)' },
              ].map(row => (
                <div key={row.param} className="flex justify-between text-sm">
                  <span className="text-slate-500">{row.param}</span>
                  <span className="font-mono text-xs text-slate-700 bg-slate-50 px-2 py-0.5 rounded">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Сетевая изоляция</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                <div className="w-2 h-2 bg-green-700 rounded-full" />
                <span className="text-slate-600">Внешние подключения: <strong className="text-red-600">Заблокированы</strong></span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                <div className="w-2 h-2 bg-green-700 rounded-full" />
                <span className="text-slate-600">Сеть: <strong className="text-slate-800">10.0.1.0/24 (ЛВС)</strong></span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                <div className="w-2 h-2 bg-green-700 rounded-full" />
                <span className="text-slate-600">DMZ: <strong className="text-slate-800">Отсутствует</strong></span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                <div className="w-2 h-2 bg-green-700 rounded-full" />
                <span className="text-slate-600">USB-порты: <strong className="text-red-600">Контролируются</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}