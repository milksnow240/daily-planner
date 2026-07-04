const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('api', {
  // 任务相关
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  getTasksByDate: (date) => ipcRenderer.invoke('get-tasks-by-date', date),
  addTask: (title, category) => ipcRenderer.invoke('add-task', title, category),
  deleteTask: (taskId) => ipcRenderer.invoke('delete-task', taskId),
  toggleTask: (taskId, date, completed) => ipcRenderer.invoke('toggle-task', taskId, date, completed),

  // 统计相关
  getDailyStats: (year, month) => ipcRenderer.invoke('get-daily-stats', year, month),
  getDateStats: (date) => ipcRenderer.invoke('get-date-stats', date),

  // 设置相关
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // 窗口控制
  closeReminder: () => ipcRenderer.invoke('close-reminder'),
  openMainWindow: () => ipcRenderer.invoke('open-main-window'),

  // 测试提醒
  testReminder: () => ipcRenderer.invoke('test-reminder')
});
