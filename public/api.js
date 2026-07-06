// 浏览器模式 API 桥接
(function () {
  if (window.api) return;

  async function request(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }
    return res.json();
  }

  window.api = {
    getTasks: () => request('/api/tasks'),
    getTasksByDate: (date) => request(`/api/tasks/${date}`),
    addTask: (title, category) => request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, category })
    }),
    deleteTask: (taskId) => request(`/api/tasks/${taskId}`, { method: 'DELETE' }),
    toggleTask: (taskId, date, completed) => request(`/api/tasks/${taskId}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ date, completed })
    }),
    getDailyStats: (year, month) => request(`/api/stats/${year}/${month}`),
    getDateStats: (date) => request(`/api/stats/date/${date}`),
    getSettings: () => request('/api/settings'),
    getSetting: (key) => request(`/api/settings/${key}`).then(r => r.value),
    setSetting: (key, value) => request('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ key, value })
    }),
    getPhases: () => request('/api/phases'),
    getPhase: (id) => request(`/api/phases/${id}`),
    addPhase: (data) => request('/api/phases', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    updatePhase: (id, data) => request(`/api/phases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    deletePhase: (id) => request(`/api/phases/${id}`, { method: 'DELETE' }),
    setPhaseMilestones: (phaseId, milestones) => request(`/api/phases/${phaseId}/milestones`, {
      method: 'POST',
      body: JSON.stringify({ milestones })
    }),
    togglePhaseMilestone: (milestoneId, completed) => request(`/api/phase-milestones/${milestoneId}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ completed })
    }),
    closeReminder: () => window.close(),
    openMainWindow: () => { window.location.href = '/'; },
    testReminder: () => request('/api/test-reminder', { method: 'POST' })
  };
})();
