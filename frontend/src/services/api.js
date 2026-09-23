import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8009',
  adapter: 'xhr'
});

// Reads the JWT's exp claim (no verification, that's the server's job) so the
// client can stop using a dead token before the server has to reject it.
export const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

const getValidToken = () => {
  const token = localStorage.getItem('token');
  return token && !isTokenExpired(token) ? token : null;
};

// Clear the session and send the user to /login. Guarded so a burst of 401s
// only triggers one navigation and a failed login attempt never loops.
export const forceLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('username');
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
};

const isAuthRequest = (config) => /\/auth\/(login|register)/.test(config?.url || '');

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  // Login/register must never bounce the user to /login, but register still
  // needs the admin's token because only admins may create users.
  if (token && isTokenExpired(token) && !isAuthRequest(config)) {
    forceLogout();
    return Promise.reject(new axios.CanceledError('Session expired'));
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest(error.config)) {
      forceLogout();
    }
    return Promise.reject(error);
  }
);

// Auth
export const loginUser = (credentials) => API.post('/auth/login', credentials);
export const registerUser = (userData) => API.post('/auth/register', userData);

// Projects
export const fetchProjects = () => API.get('/projects/');
export const createProject = (projectData) => API.post('/projects/', projectData);
export const deleteProject = (projectId) => API.delete(`/projects/${projectId}`);

// Users & Access (Admin)
export const fetchUsers = () => API.get('/users/');
export const deleteUser = (userId) => API.delete(`/users/${userId}`);
export const fetchProjectUsers = (projectId) => API.get(`/projects/${projectId}/users`);
export const grantProjectAccess = (projectId, userId) => API.post(`/projects/${projectId}/access`, { user_id: userId, project_id: projectId });
export const revokeProjectAccess = (projectId, userId) => API.delete(`/projects/${projectId}/access/${userId}`);

// Tasks
export const fetchTasks = (projectId) => API.get('/tasks/', { params: { project_id: projectId } });
export const createTask = (taskData) => API.post('/tasks/', taskData);
export const deleteTask = (taskId) => API.delete(`/tasks/${taskId}`);
export const completeTask = (taskId) => API.patch(`/tasks/${taskId}/complete`);
export const updateTaskStatus = (taskId, status) => API.patch(`/tasks/${taskId}/status`, { status });
export const assignTask = (taskId, userIds) => {
  if (Array.isArray(userIds)) {
    return API.patch(`/tasks/${taskId}/assign`, { user_ids: userIds });
  }
  return API.patch(`/tasks/${taskId}/assign`, { user_id: userIds });
};
export const updateTaskSprint = (taskId, sprintId) => API.patch(`/tasks/${taskId}/sprint`, { sprint_id: sprintId });
export const fetchTaskActivity = (taskId) => API.get(`/tasks/${taskId}/activity`);

// Project Intelligence
export const fetchPrioritizedTasks = (projectId) => API.get('/project/priorities', { params: { project_id: projectId } });
export const fetchCriticalPath = (projectId, sprintId) => API.get('/project/critical-path', { params: { project_id: projectId, sprint_id: sprintId } });
export const createDependency = (taskId, dependsOnId) => 
  API.post(`/dependencies/`, { 
    task_id: taskId, 
    depends_on_id: dependsOnId 
  });

// Sprints
export const fetchSprints = (projectId) => API.get('/sprints/', { params: { project_id: projectId } });
export const createSprint = (sprintData) => API.post('/sprints/', sprintData);
export const getSprint = (sprintId) => API.get(`/sprints/${sprintId}`);
export const updateSprint = (sprintId, data) => API.patch(`/sprints/${sprintId}`, data);
export const deleteSprint = (sprintId) => API.delete(`/sprints/${sprintId}`);
export const autoAssignSprint = (sprintId) => API.post(`/sprints/${sprintId}/auto-assign`);
export const fetchSprintTasks = (sprintId) => API.get(`/sprints/${sprintId}/tasks`);
export const fetchBurndown = (sprintId) => API.get(`/sprints/${sprintId}/burndown`);

// Notifications
export const fetchNotifications = () => API.get('/notifications/');
export const markNotificationRead = (notifId) => API.patch(`/notifications/${notifId}/read`);
export const markAllNotificationsRead = () => API.patch('/notifications/read-all');

// Reports
export const exportSprintPDF = async (sprintId) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8009'}/reports/sprint/${sprintId}/export`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to export report');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sprint_${sprintId}_report.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

// SSE Notification stream
// Returns a handle whose close() also stops any pending reconnect, so the
// caller can tear the stream down after it has reconnected.
export const createNotificationStream = (onMessage) => {
  let eventSource = null;
  let reconnectTimer = null;
  let closed = false;

  const connect = () => {
    if (closed) return;
    const token = getValidToken();
    if (!token) {
      // EventSource can't tell a 401 from a network blip, so we check the
      // token ourselves instead of retrying a dead session every 5 seconds.
      forceLogout();
      return;
    }
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8009'}/notifications/stream?token=${token}`;
    eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      if (!closed) reconnectTimer = setTimeout(connect, 5000);
    };
  };

  connect();

  return {
    close: () => {
      closed = true;
      clearTimeout(reconnectTimer);
      if (eventSource) eventSource.close();
    },
  };
};

export default API;