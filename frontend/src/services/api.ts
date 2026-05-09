const API_BASE_URL = 'http://localhost:8000/api';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('access_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('access_token', token);
  }

  getAvailableUnits() {
    return this.request('/structure/units/?available_for_tasks=true');
  }

  getToken() {
    return this.token || localStorage.getItem('access_token');
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  async refreshToken() {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) throw new Error('No refresh token');

    const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    if (response.ok) {
      const data = await response.json();
      this.setToken(data.access);
      return data.access;
    }
    throw new Error('Failed to refresh token');
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      let response = await fetch(url, { ...options, headers });

      if (response.status === 401 && token) {
        try {
          const newToken = await this.refreshToken();
          headers['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(url, { ...options, headers });
        } catch (refreshError) {
          this.clearToken();
          window.location.href = '/login';
          throw new Error('Session expired');
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || JSON.stringify(errorData) || `API Error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // ========== Аутентификация ==========
  async login(username: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    this.setToken(data.access);
    localStorage.setItem('refresh_token', data.refresh);
    return data;
  }

  async logout() {
    const refresh = localStorage.getItem('refresh_token');
    if (refresh) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    this.clearToken();
  }

  // ========== Пользователи ==========
  getUsers() {
    return this.request('/users/');
  }

  async getAllUsers() {
    let page = 1;
    let allUsers: any[] = [];
    let hasNext = true;

    // ЗАЩИТА: Собираем максимум 10 страниц, чтобы браузер не зависал
    while (hasNext && page <= 10) {
      try {
        const response: any = await this.request(`/users/?page=${page}`);
        if (response && response.results) {
          allUsers = [...allUsers, ...response.results];
          hasNext = !!response.next;
          page++;
        } else if (Array.isArray(response)) {
          allUsers = [...allUsers, ...response];
          hasNext = false;
        } else {
          hasNext = false;
        }
      } catch (e) {
        hasNext = false;
      }
    }
    return allUsers;
  }

  getCurrentUser() {
    return this.request('/users/me/');
  }

  getUser(id: number) {
    return this.request(`/users/${id}/`);
  }

  changePassword(oldPassword: string, newPassword: string, confirmPassword: string) {
    return this.request('/users/change-password/', {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword, confirm_password: confirmPassword }),
    });
  }

  updateUser(id: number, data: any) {
    return this.request(`/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ========== Задачи ==========
  async getTasks(params?: Record<string, string>) {
    let page = 1;
    let allTasks: any[] = [];
    let hasNext = true;
    
    const baseQuery = params ? new URLSearchParams(params).toString() : '';

    // ЗАЩИТА: Максимум 10 страниц
    while (hasNext && page <= 10) {
      const query = baseQuery ? `?${baseQuery}&page=${page}` : `?page=${page}`;
      try {
        const response: any = await this.request(`/tasks/${query}`);
        if (response && response.results) {
          allTasks = [...allTasks, ...response.results];
          hasNext = !!response.next;
          page++;
        } else if (Array.isArray(response)) {
          allTasks = [...allTasks, ...response];
          hasNext = false;
        } else {
          hasNext = false;
        }
      } catch (error) {
        hasNext = false;
      }
    }
    
    return allTasks;
  }

  getTask(id: number) {
    return this.request(`/tasks/${id}/`);
  }

  createTask(task: any) {
    return this.request('/tasks/', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  updateTask(id: number | string, task: any) {
    return this.request(`/tasks/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(task),
    });
  }

  deleteTask(id: number) {
    return this.request(`/tasks/${id}/`, { method: 'DELETE' });
  }

  moveTask(id: number, status: string, order?: number) {
    return this.request(`/tasks/${id}/move/`, {
      method: 'PATCH',
      body: JSON.stringify({ status, order: order || 0 }),
    });
  }

  getKanban() {
    return this.request('/tasks/kanban/');
  }

  getDashboardStats() {
    return this.request('/tasks/dashboard/');
  }

  // ========== Файлы задания ==========
  uploadTaskFile(taskId: number, file: File, fileType: 'attachment' | 'submission') {
    const formData = new FormData();
    formData.append('file', file);
    let endpoint = fileType === 'attachment' ? `/tasks/${taskId}/attachments/` : `/tasks/${taskId}/submission-attachments/`;
    return fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.getToken()}` },
      body: formData,
    }).then(res => {
      if (!res.ok) return res.text().then(text => { throw new Error(text); });
      return res.json();
    });
  }

  getTaskFiles(taskId: number) {
    return this.request(`/tasks/${taskId}/attachments/`);
  }

  deleteTaskFile(fileId: number) {
    return this.request(`/tasks/attachments/${fileId}/`, { method: 'DELETE' });
  }

  // ========== Выполнение задания ==========
  submitTask(taskId: number, comment?: string) {
    return this.request(`/tasks/${taskId}/submit/`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  approveTask(taskId: number, comment?: string) {
    return this.request(`/tasks/${taskId}/approve/`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  rejectTask(taskId: number, comment: string) {
    return this.request(`/tasks/${taskId}/reject/`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  // ========== Комментарии к задачам ==========
  getTaskComments(taskId: number) {
    return this.request(`/tasks/${taskId}/comments/`);
  }

  addComment(taskId: number | string, text: string) {
    return this.request(`/tasks/${taskId}/comments/`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  uploadCommentFile(taskId: number | string, commentId: number | string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_BASE_URL}/tasks/${taskId}/comments/${commentId}/attachments/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.getToken()}` },
      body: formData
    }).then(res => {
      if (!res.ok) throw new Error('Не удалось загрузить файл комментария');
      return res.json();
    });
  }

  updateTaskComment(commentId: number, text: string) {
    return this.request(`/tasks/comments/${commentId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ text }),
    });
  }

  deleteTaskComment(commentId: number) {
    return this.request(`/tasks/comments/${commentId}/`, { method: 'DELETE' });
  }

  // ========== Оргструктура ==========
  getOrgTree() {
    return this.request('/structure/tree/');
  }

  getUnits() {
    return this.request('/structure/units/');
  }

  getUnit(id: number) {
    return this.request(`/structure/units/${id}/`);
  }

  createUnit(unit: any) {
    return this.request('/structure/units/', {
      method: 'POST',
      body: JSON.stringify(unit),
    });
  }

  updateUnit(id: number, unit: any) {
    return this.request(`/structure/units/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(unit),
    });
  }

  deleteUnit(id: number) {
    return this.request(`/structure/units/${id}/`, { method: 'DELETE' });
  }

  movePersonnel(userId: number, targetUnitId: number | null) {
    return this.request('/structure/move-personnel/', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, target_unit_id: targetUnitId }),
    });
  }

  getStructureHistory() {
    return this.request('/structure/history/');
  }

  // ========== Уведомления ==========
  getNotifications(unreadOnly = false) {
    const query = unreadOnly ? '?unread=true' : '';
    return this.request(`/notifications/${query}`);
  }

  markNotificationRead(id: number) {
    return this.request(`/notifications/${id}/read/`, { method: 'PATCH' });
  }

  markAllNotificationsRead() {
    return this.request('/notifications/read-all/', { method: 'POST' });
  }

  deleteNotification(id: number) {
    return this.request(`/notifications/${id}/delete/`, { method: 'DELETE' });
  }

  getUnreadCount() {
    return this.request('/notifications/unread-count/');
  }

  // ========== Аудит ==========
  getAuditLogs(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params) : '';
    return this.request(`/audit/logs/${query}`);
  }

  getAuditStats() {
    return this.request('/audit/stats/');
  }

  // ========== Автопланирование ==========
  async uploadDocument(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/autoplan/upload/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.getToken()}` },
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.error || `Ошибка ${response.status}: Доступ запрещен или файл неверного формата`);
    }
    return response.json();
  }

  getDocuments() {
    return this.request('/autoplan/documents/');
  }

  getDocument(id: number) {
    return this.request(`/autoplan/documents/${id}/`);
  }

  deleteDocument(id: number) {
    return this.request(`/autoplan/documents/${id}/`, { method: 'DELETE' });
  }

  generateTasks(documentId: number, selectedIndices: number[], priority: string, orgUnitIds?: number[], customEvents?: any[]) {
    const payload: any = { selected_indices: selectedIndices, priority: priority };
    if (orgUnitIds && orgUnitIds.length > 0) payload.org_unit_ids = orgUnitIds;
    if (customEvents && customEvents.length) payload.custom_events = customEvents;
    return this.request(`/autoplan/documents/${documentId}/generate/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  parseDocumentSync(documentId: number) {
    return this.request(`/autoplan/documents/${documentId}/parse-sync/`, { method: 'POST' });
  }

  // ========== Безопасность ==========
  getSecurityStatus() {
    return this.request('/security/status/');
  }
  
  // ========== Автоматическое обновление статусов ==========
  async updatePlannedTasks() {
    return this.request('/tasks/update-planned/', { method: 'POST' });
  }

  // ========== База Знаний ==========
  getKnowledgeDocuments(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params) : '';
    return this.request(`/knowledge/${query}`);
  }

  deleteKnowledgeDocument(id: number) {
    return this.request(`/knowledge/${id}/`, { method: 'DELETE' });
  }

  uploadKnowledgeDocument(formData: FormData) {
    return fetch(`${API_BASE_URL}/knowledge/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.getToken()}` },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Upload failed');
      }
      return res.json();
    });
  }
}

export default new ApiService();