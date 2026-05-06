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
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      let response = await fetch(url, { 
        ...options, 
        headers 
      });

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
        console.error('Server error response:', {
          status: response.status,
          statusText: response.statusText,
          data: errorData
        });
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

    while (hasNext) {
      const response = await this.request(`/users/?page=${page}`);
      if (response.results) {
        allUsers = [...allUsers, ...response.results];
        hasNext = !!response.next;
        page++;
      } else {
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
      body: JSON.stringify({ 
        old_password: oldPassword, 
        new_password: newPassword, 
        confirm_password: confirmPassword 
      }),
    });
  }

  updateUser(id: number, data: any) {
    return this.request(`/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ========== Задачи ==========
  getTasks(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params) : '';
    return this.request(`/tasks/${query}`);
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

  updateTask(id: number, task: any) {
    return this.request(`/tasks/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(task),
    });
  }

  deleteTask(id: number) {
    return this.request(`/tasks/${id}/`, {
      method: 'DELETE',
    });
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
    let endpoint = '';
    if (fileType === 'attachment') {
      endpoint = `/tasks/${taskId}/attachments/`;
    } else {
      endpoint = `/tasks/${taskId}/submission-attachments/`;
    }
    return fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
      },
      body: formData,
    }).then(res => {
      if (!res.ok) {
        return res.text().then(text => { throw new Error(text); });
      }
      return res.json();
    });
  }

  getTaskFiles(taskId: number) {
    return this.request(`/tasks/${taskId}/attachments/`);
  }

  deleteTaskFile(fileId: number) {
    return this.request(`/tasks/attachments/${fileId}/`, {
      method: 'DELETE',
    });
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

  addTaskComment(taskId: number, text: string, attachments?: File[]) {
    return this.request(`/tasks/${taskId}/comments/`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  updateTaskComment(commentId: number, text: string) {
    return this.request(`/tasks/comments/${commentId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ text }),
    });
  }

  deleteTaskComment(commentId: number) {
    return this.request(`/tasks/comments/${commentId}/`, {
      method: 'DELETE',
    });
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
    return this.request(`/structure/units/${id}/`, {
      method: 'DELETE',
    });
  }

  // ВНИМАНИЕ: Здесь мы разрешаем передавать null в targetUnitId для удаления!
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
    return this.request(`/notifications/${id}/read/`, {
      method: 'PATCH',
    });
  }

  markAllNotificationsRead() {
    return this.request('/notifications/read-all/', {
      method: 'POST',
    });
  }

  deleteNotification(id: number) {
    return this.request(`/notifications/${id}/delete/`, {
      method: 'DELETE',
    });
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
  uploadDocument(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return fetch(`${API_BASE_URL}/autoplan/upload/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.getToken()}` },
      body: formData,
    }).then(res => res.json());
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

  generateTasks(documentId: number, selectedIndices: number[], priority: string, orgUnitId?: number, customEvents?: any[]) {
    const payload: any = {
      selected_indices: selectedIndices,
      priority: priority,
    };
    if (orgUnitId) payload.org_unit_id = orgUnitId;
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
    return this.request('/tasks/update-planned/', {
      method: 'POST',
    });
  }
}

export default new ApiService();