import type { User, OrgUnit, Task, Notification, AuditLog, StructureHistory } from '../types';

export const users: User[] = [
  { id: 'u1', fullName: 'Иванов А.П.', rank: 'Полковник', position: 'Командир в/ч 2103', unitId: 'root', avatarColor: '#dc2626' },
  { id: 'u2', fullName: 'Петров С.В.', rank: 'Подполковник', position: 'Зам. командира в/ч', unitId: 'root', avatarColor: '#ea580c' },
  { id: 'u3', fullName: 'Сидоров И.К.', rank: 'Майор', position: 'Командир 1 отдела', unitId: 'dept1', avatarColor: '#ca8a04' },
  { id: 'u4', fullName: 'Козлов Д.А.', rank: 'Майор', position: 'Командир 2 отдела', unitId: 'dept2', avatarColor: '#16a34a' },
  { id: 'u5', fullName: 'Новиков М.Е.', rank: 'Капитан', position: 'Командир группы', unitId: 'grp3', avatarColor: '#2563eb' },
  { id: 'u6', fullName: 'Морозов В.Г.', rank: 'Капитан', position: 'Командир 1 группы 1 отд.', unitId: 'grp1_1', avatarColor: '#7c3aed' },
  { id: 'u7', fullName: 'Волков Р.Н.', rank: 'Капитан', position: 'Командир 2 группы 1 отд.', unitId: 'grp1_2', avatarColor: '#db2777' },
  { id: 'u8', fullName: 'Лебедев О.С.', rank: 'Капитан', position: 'Командир 1 группы 2 отд.', unitId: 'grp2_1', avatarColor: '#0891b2' },
  { id: 'u9', fullName: 'Соколов К.И.', rank: 'Капитан', position: 'Командир 2 группы 2 отд.', unitId: 'grp2_2', avatarColor: '#65a30d' },
  { id: 'u10', fullName: 'Кузнецов А.М.', rank: 'Ст. лейтенант', position: 'Специалист', unitId: 'grp1_1', avatarColor: '#e11d48' },
  { id: 'u11', fullName: 'Попов Д.В.', rank: 'Лейтенант', position: 'Специалист', unitId: 'grp1_1', avatarColor: '#9333ea' },
  { id: 'u12', fullName: 'Васильев Н.Р.', rank: 'Ст. лейтенант', position: 'Специалист', unitId: 'grp1_2', avatarColor: '#0d9488' },
  { id: 'u13', fullName: 'Зайцев П.Л.', rank: 'Лейтенант', position: 'Специалист', unitId: 'grp2_1', avatarColor: '#b45309' },
  { id: 'u14', fullName: 'Павлов Е.Д.', rank: 'Ст. лейтенант', position: 'Специалист', unitId: 'grp2_2', avatarColor: '#4f46e5' },
  { id: 'u15', fullName: 'Семенов И.А.', rank: 'Лейтенант', position: 'Специалист', unitId: 'grp3', avatarColor: '#059669' },
  { id: 'u16', fullName: 'Голубев А.Ф.', rank: 'Прапорщик', position: 'Специалист', unitId: 'grp3', avatarColor: '#6d28d9' },
];

export const orgUnits: OrgUnit[] = [
  { id: 'root', name: 'в/ч 2103', parentId: null, commanderId: 'u1', type: 'unit' },
  { id: 'dept1', name: '1-й отдел', parentId: 'root', commanderId: 'u3', type: 'department' },
  { id: 'dept2', name: '2-й отдел', parentId: 'root', commanderId: 'u4', type: 'department' },
  { id: 'grp3', name: 'Отдельная группа', parentId: 'root', commanderId: 'u5', type: 'group' },
  { id: 'grp1_1', name: '1-я группа 1-го отд.', parentId: 'dept1', commanderId: 'u6', type: 'group' },
  { id: 'grp1_2', name: '2-я группа 1-го отд.', parentId: 'dept1', commanderId: 'u7', type: 'group' },
  { id: 'grp2_1', name: '1-я группа 2-го отд.', parentId: 'dept2', commanderId: 'u8', type: 'group' },
  { id: 'grp2_2', name: '2-я группа 2-го отд.', parentId: 'dept2', commanderId: 'u9', type: 'group' },
];

export const initialTasks: Task[] = [
  {
    id: 't1', title: 'Подготовка плана боевой подготовки', description: 'Разработать план боевой подготовки на следующий квартал с учетом новых директив.',
    status: 'in_progress', priority: 'critical', assigneeId: 'u3', creatorId: 'u1', unitId: 'dept1',
    deadline: '2025-02-15', createdAt: '2025-01-20', tags: ['план', 'боевая подготовка'],
    subtasks: [
      { id: 'st1', title: 'Анализ текущих показателей', done: true },
      { id: 'st2', title: 'Согласование с ЗКВ', done: false },
      { id: 'st3', title: 'Утверждение командиром', done: false },
    ]
  },
  {
    id: 't2', title: 'Проверка средств связи', description: 'Провести полную проверку и тестирование средств связи во всех подразделениях.',
    status: 'todo', priority: 'high', assigneeId: 'u6', creatorId: 'u3', unitId: 'grp1_1',
    deadline: '2025-02-10', createdAt: '2025-01-22', tags: ['связь', 'проверка'],
    subtasks: [
      { id: 'st4', title: 'Инвентаризация оборудования', done: false },
      { id: 'st5', title: 'Тестирование каналов', done: false },
    ]
  },
  {
    id: 't3', title: 'Инструктаж по ИБ', description: 'Провести инструктаж по информационной безопасности для всего личного состава.',
    status: 'backlog', priority: 'medium', assigneeId: 'u4', creatorId: 'u2', unitId: 'dept2',
    deadline: '2025-02-28', createdAt: '2025-01-25', tags: ['ИБ', 'инструктаж'],
  },
  {
    id: 't4', title: 'Обновление документации', description: 'Актуализировать служебную документацию в соответствии с новыми требованиями.',
    status: 'review', priority: 'medium', assigneeId: 'u10', creatorId: 'u6', unitId: 'grp1_1',
    deadline: '2025-02-05', createdAt: '2025-01-18', tags: ['документация'],
  },
  {
    id: 't5', title: 'Подготовка отчета', description: 'Подготовить ежемесячный отчет о состоянии дел подразделения.',
    status: 'done', priority: 'high', assigneeId: 'u7', creatorId: 'u3', unitId: 'grp1_2',
    deadline: '2025-01-31', createdAt: '2025-01-15', tags: ['отчет'],
  },
  {
    id: 't6', title: 'Тренировка по РХБЗ', description: 'Организовать и провести тренировку по радиационной, химической и биологической защите.',
    status: 'todo', priority: 'critical', assigneeId: 'u8', creatorId: 'u4', unitId: 'grp2_1',
    deadline: '2025-02-12', createdAt: '2025-01-28', tags: ['РХБЗ', 'тренировка'],
  },
  {
    id: 't7', title: 'Проверка вооружения', description: 'Провести плановую проверку и обслуживание вооружения.',
    status: 'in_progress', priority: 'high', assigneeId: 'u9', creatorId: 'u4', unitId: 'grp2_2',
    deadline: '2025-02-08', createdAt: '2025-01-20', tags: ['вооружение', 'проверка'],
  },
  {
    id: 't8', title: 'Физическая подготовка', description: 'Составить график физической подготовки на месяц.',
    status: 'backlog', priority: 'low', assigneeId: 'u5', creatorId: 'u2', unitId: 'grp3',
    deadline: '2025-03-01', createdAt: '2025-01-30', tags: ['физ. подготовка'],
  },
  {
    id: 't9', title: 'Караульная служба', description: 'Составить график караульной службы на февраль.',
    status: 'in_progress', priority: 'high', assigneeId: 'u15', creatorId: 'u5', unitId: 'grp3',
    deadline: '2025-02-01', createdAt: '2025-01-25', tags: ['караул', 'график'],
  },
  {
    id: 't10', title: 'Техническое обслуживание', description: 'Провести ТО-2 техники подразделения.',
    status: 'todo', priority: 'medium', assigneeId: 'u13', creatorId: 'u8', unitId: 'grp2_1',
    deadline: '2025-02-20', createdAt: '2025-01-28', tags: ['техника', 'ТО'],
  },
  {
    id: 't11', title: 'Подготовка к учениям', description: 'Подготовить л/с и технику к тактическим учениям.',
    status: 'todo', priority: 'critical', assigneeId: 'u12', creatorId: 'u7', unitId: 'grp1_2',
    deadline: '2025-02-18', createdAt: '2025-01-29', tags: ['учения', 'подготовка'],
  },
  {
    id: 't12', title: 'Зачет по специальности', description: 'Провести зачет по специальной подготовке.',
    status: 'backlog', priority: 'medium', assigneeId: 'u14', creatorId: 'u9', unitId: 'grp2_2',
    deadline: '2025-02-25', createdAt: '2025-01-30', tags: ['зачет', 'спец. подготовка'],
  },
];

export const initialNotifications: Notification[] = [
  { id: 'n1', type: 'task_assigned', message: 'Вам назначена задача: "Подготовка плана боевой подготовки"', timestamp: '2025-01-20T08:00:00', read: false, taskId: 't1' },
  { id: 'n2', type: 'deadline_approaching', message: 'Дедлайн задачи "Обновление документации" через 2 дня', timestamp: '2025-02-03T09:00:00', read: false, taskId: 't4' },
  { id: 'n3', type: 'task_completed', message: 'Задача "Подготовка отчета" выполнена', timestamp: '2025-01-30T16:00:00', read: true, taskId: 't5' },
  { id: 'n4', type: 'structure_changed', message: 'Изменена структура: добавлена "Отдельная группа"', timestamp: '2025-01-19T10:00:00', read: true },
  { id: 'n5', type: 'task_assigned', message: 'Новая задача от командира: "Тренировка по РХБЗ"', timestamp: '2025-01-28T11:00:00', read: false, taskId: 't6' },
];

export const auditLogs: AuditLog[] = [
  { id: 'l1', action: 'Вход в систему', userId: 'u1', timestamp: '2025-01-30T07:55:00', details: 'IP: 10.0.1.1, Сессия: #48291', category: 'auth' },
  { id: 'l2', action: 'Создание задачи', userId: 'u1', timestamp: '2025-01-30T08:10:00', details: 'Задача: "Подготовка плана боевой подготовки" (t1)', category: 'task' },
  { id: 'l3', action: 'Изменение структуры', userId: 'u1', timestamp: '2025-01-19T10:00:00', details: 'Добавлено подразделение: "Отдельная группа"', category: 'structure' },
  { id: 'l4', action: 'Попытка несанкц. доступа', userId: 'u11', timestamp: '2025-01-29T14:22:00', details: 'Попытка доступа к задачам 2 отдела. Отклонено.', category: 'security' },
  { id: 'l5', action: 'Экспорт данных', userId: 'u2', timestamp: '2025-01-30T09:15:00', details: 'Экспорт отчета по задачам за январь', category: 'security' },
  { id: 'l6', action: 'Назначение задачи', userId: 'u3', timestamp: '2025-01-22T08:30:00', details: 'Задача "Проверка средств связи" назначена Морозову В.Г.', category: 'task' },
  { id: 'l7', action: 'Вход в систему', userId: 'u3', timestamp: '2025-01-30T07:50:00', details: 'IP: 10.0.1.15, Сессия: #48287', category: 'auth' },
  { id: 'l8', action: 'Смена пароля', userId: 'u6', timestamp: '2025-01-28T16:00:00', details: 'Пароль успешно изменён', category: 'auth' },
];

export const structureHistory: StructureHistory[] = [
  { id: 'sh1', action: 'Создание подразделения', timestamp: '2025-01-10T08:00:00', userId: 'u1', details: 'Создана в/ч 2103 (корневое подразделение)' },
  { id: 'sh2', action: 'Создание подразделения', timestamp: '2025-01-10T08:05:00', userId: 'u1', details: 'Создан 1-й отдел' },
  { id: 'sh3', action: 'Создание подразделения', timestamp: '2025-01-10T08:10:00', userId: 'u1', details: 'Создан 2-й отдел' },
  { id: 'sh4', action: 'Создание подразделения', timestamp: '2025-01-19T10:00:00', userId: 'u1', details: 'Создана Отдельная группа' },
  { id: 'sh5', action: 'Перемещение пользователя', timestamp: '2025-01-20T11:00:00', userId: 'u2', details: 'Семенов И.А. перемещён в Отдельную группу' },
  { id: 'sh6', action: 'Назначение командира', timestamp: '2025-01-19T10:05:00', userId: 'u1', details: 'Новиков М.Е. назначен командиром Отдельной группы' },
];
