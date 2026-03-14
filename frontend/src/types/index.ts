export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type NotificationType = 'task_assigned' | 'deadline_approaching' | 'task_completed' | 'structure_changed' | 'comment';

export interface User {
  id: string | number;
  fullName?: string;
  first_name?: string;
  last_name?: string;
  patronymic?: string;
  rank: string;
  position: string;
  unitId?: string;
  avatarColor?: string;
  role?: string;
  clearance_level?: number;
  date_joined?: string;
  last_login?: string;
}

export interface OrgUnit {
  id: string;
  name: string;
  parentId: string | null;
  commanderId: string | null;
  type: 'unit' | 'department' | 'group';
  children?: OrgUnit[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string;
  creatorId: string;
  unitId: string;
  deadline: string;
  createdAt: string;
  tags: string[];
  subtasks?: { id: string; title: string; done: boolean }[];
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: string;
  read: boolean;
  taskId?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  timestamp: string;
  details: string;
  category: 'auth' | 'task' | 'structure' | 'security';
}

export interface StructureHistory {
  id: string;
  action: string;
  timestamp: string;
  userId: string;
  details: string;
}
