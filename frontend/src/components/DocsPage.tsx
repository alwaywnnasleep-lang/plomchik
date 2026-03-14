import { FileText, Book, Server, Shield, Network, Code } from 'lucide-react';

export function DocsPage() {
  const sections = [
    {
      title: 'Архитектура системы',
      icon: Server,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      items: [
        'Frontend: React 19 + TypeScript + Tailwind CSS',
        'Backend: Django 5 + Django REST Framework',
        'База данных: PostgreSQL 16 (шифрование at-rest)',
        'Кэширование: Redis (сессии, JWT)',
        'Очереди задач: Celery (уведомления, парсинг)',
        'Развертывание: Docker Compose в ЛВС',
      ]
    },
    {
      title: 'Безопасность',
      icon: Shield,
      color: 'text-red-500',
      bg: 'bg-red-50',
      items: [
        'Шифрование: AES-256-GCM для данных, TLS 1.3 для транспорта',
        'Аутентификация: JWT RS256 + refresh-токены (httpOnly cookies)',
        'Авторизация: RBAC на основе иерархии подразделений',
        'Защита: CSRF, XSS, SQL-injection, rate limiting',
        'Логирование: все действия пользователей, аудит безопасности',
        'Пароли: bcrypt (cost factor = 12), политика сложности',
        'Сессии: автоматический таймаут 30 мин бездействия',
      ]
    },
    {
      title: 'Иерархия и права доступа',
      icon: Network,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
      items: [
        'Древовидная структура подразделений (конструктор)',
        'Командир может ставить задачи только своим подчиненным',
        'Подчиненные НЕ могут ставить задачи командирам',
        'Горизонтальная изоляция: командиры не ставят задачи чужим подчиненным',
        'История изменений структуры с аудитом',
        'Перемещение пользователей между подразделениями',
      ]
    },
    {
      title: 'Автопланирование',
      icon: FileText,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
      items: [
        'Парсинг DOC/DOCX: python-docx',
        'Парсинг PDF: PyMuPDF / pdfplumber',
        'Парсинг XLS/XLSX: openpyxl',
        'Извлечение таблиц мероприятий из документов',
        'Автоматическая генерация задач на канбан-доску',
        'Предпросмотр и выбор мероприятий перед генерацией',
      ]
    },
    {
      title: 'API Endpoints',
      icon: Code,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      items: [
        'POST /api/auth/login — аутентификация',
        'GET /api/tasks — список задач (фильтрация, поиск)',
        'POST /api/tasks — создание задачи',
        'PATCH /api/tasks/:id — обновление задачи',
        'GET /api/org-units — дерево подразделений',
        'POST /api/org-units — добавление подразделения',
        'POST /api/autoplan/upload — загрузка документа',
        'GET /api/notifications — уведомления',
        'GET /api/audit-logs — журнал аудита',
      ]
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Документация</h1>
        <p className="text-sm text-slate-500 mt-1">Техническая документация АСУ «Рубеж»</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Book size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">АСУ «Рубеж» v1.0</h2>
            <p className="text-sm text-slate-500 mt-1">
              Автоматизированная система управления для планирования и мониторинга задач в вооруженных силах.
              Предназначена для эксплуатации в рамках изолированной локальной сети воинской части.
            </p>
            <div className="flex gap-2 mt-3">
              <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">Django + React</span>
              <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">PostgreSQL</span>
              <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">AES-256</span>
              <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">Канбан</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sections.map(section => (
          <div key={section.title} className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <section.icon size={16} className={section.color} />
              {section.title}
            </h3>
            <ul className="space-y-1.5">
              {section.items.map((item, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-start gap-2 p-1.5 rounded hover:bg-slate-50">
                  <span className="text-slate-300 mt-0.5">•</span>
                  <span className="font-mono">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Стек технологий (планируемый)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'Django 5', role: 'Backend Framework' },
            { name: 'DRF', role: 'REST API' },
            { name: 'React 19', role: 'Frontend UI' },
            { name: 'TypeScript', role: 'Типизация' },
            { name: 'PostgreSQL 16', role: 'СУБД' },
            { name: 'Redis', role: 'Кэш / Сессии' },
            { name: 'Celery', role: 'Очереди задач' },
            { name: 'Docker', role: 'Контейнеризация' },
          ].map(tech => (
            <div key={tech.name} className="bg-white rounded-lg border border-slate-200 p-3 text-center">
              <div className="text-sm font-medium text-slate-700">{tech.name}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{tech.role}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
