export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'planned' | 'todo' | 'in_progress' | 'review' | 'done';
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
  org_unit?: string | number | null;
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
  commanderDetail?: any;
  personnelList?: any[];
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  userFullName: string;
  userRank: string;
  text: string;
  createdAt: string;
  attachments?: {
    id: string;
    url: string;
    name: string;
    type?: string;
  }[];
}

export interface TaskFile {
  id: string;
  fileName: string;
  fileUrl: string;
  taskId?: string;
  userId?: string;
  userFullName?: string;
  fileSize?: number;
  fileType?: 'attachment' | 'submission';
  uploadedAt?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  createdAt?: string;
  file?: string;      // для совместимости с сырыми данными
  filename?: string;  // для совместимости
}

export interface TaskSubmission {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  files?: TaskFile[];
  reviewFiles?: TaskFile[];
  taskId?: string;
  userId?: string;
  userFullName?: string;
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
  start_date?: string;
  end_date?: string;
  is_milestone?: boolean;
  subtasks?: { id: string; title: string; done: boolean }[];
  comments?: Comment[];
  attachments?: TaskFile[];
  submission?: TaskSubmission;
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