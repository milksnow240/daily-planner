const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { initDatabase, closeDatabase, getAllTasks, addTask, deleteTask, getTasksByDate,
        toggleTaskCompletion, getDailyStats, getDateStats, getSetting, setSetting,
        getAllSettings, getTodayDate } = require('./database');
const { startScheduler, stopScheduler, testReminder } = require('./scheduler');

let mainWindow = null;
let reminderWindow = null;
let tray = null;
let isQuitting = false;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'public', 'icon.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('Main window ready');
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // 打开外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createReminderWindow() {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.show();
    reminderWindow.focus();
    return;
  }

  reminderWindow = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    transparent: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  reminderWindow.loadFile(path.join(__dirname, 'public', 'reminder.html'));
  reminderWindow.setMenu(null);

  reminderWindow.on('closed', () => {
    reminderWindow = null;
  });
}

function createTray() {
  // 创建一个简单的托盘图标（使用纯色方块作为示例）
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开每日计划',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '测试提醒',
      click: () => testReminder()
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('每日计划');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function showReminder() {
  createReminderWindow();
}

// 注册 IPC 处理器
function registerIpcHandlers() {
  // 任务相关
  ipcMain.handle('get-tasks', () => getAllTasks());
  ipcMain.handle('get-tasks-by-date', (_, date) => getTasksByDate(date));
  ipcMain.handle('add-task', (_, title, category) => addTask(title, category));
  ipcMain.handle('delete-task', (_, taskId) => deleteTask(taskId));
  ipcMain.handle('toggle-task', (_, taskId, date, completed) => toggleTaskCompletion(taskId, date, completed));

  // 统计相关
  ipcMain.handle('get-daily-stats', (_, year, month) => getDailyStats(year, month));
  ipcMain.handle('get-date-stats', (_, date) => getDateStats(date));

  // 设置相关
  ipcMain.handle('get-settings', () => getAllSettings());
  ipcMain.handle('get-setting', (_, key) => getSetting(key));
  ipcMain.handle('set-setting', (_, key, value) => setSetting(key, value));

  // 窗口控制
  ipcMain.handle('close-reminder', () => {
    if (reminderWindow && !reminderWindow.isDestroyed()) {
      reminderWindow.close();
    }
  });

  ipcMain.handle('open-main-window', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // 测试提醒
  ipcMain.handle('test-reminder', () => testReminder());
}

app.whenReady().then(async () => {
  console.log('App starting...');

  // 初始化数据库（异步）
  await initDatabase();

  // 注册 IPC 处理器
  registerIpcHandlers();

  // 创建主窗口
  createMainWindow();

  // 创建系统托盘
  createTray();

  // 启动定时提醒
  startScheduler(showReminder);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // 在 macOS 上不退出，保持托盘运行
  if (process.platform !== 'darwin') {
    // 不退出，保持后台运行
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopScheduler();
  closeDatabase();
});
