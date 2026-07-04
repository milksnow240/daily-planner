const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// 数据库文件路径（项目目录下的 data 文件夹）
const dbDir = path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'daily-planner.db');

let db = null;

async function initDatabase() {
  // 确保 data 目录存在
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log('Database path:', dbPath);

  const SQL = await initSqlJs();

  // 尝试加载现有数据库
  try {
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      console.log('Loaded existing database');
    } else {
      db = new SQL.Database();
      console.log('Created new database');
    }
  } catch (err) {
    console.error('Error loading database, creating new one:', err);
    db = new SQL.Database();
  }

  // 创建 tasks 表
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建 daily_records 表
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      task_id INTEGER NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_at DATETIME,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      UNIQUE(date, task_id)
    )
  `);

  // 创建 settings 表
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // 初始化默认设置
  const defaultSettings = [
    ['reminder_time', '21:30'],
    ['reminder_enabled', 'true']
  ];

  for (const [key, value] of defaultSettings) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  saveDatabase();
  console.log('Database initialized successfully');
  return db;
}

function saveDatabase() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function getDatabase() {
  return db;
}

// 辅助函数：将 sql.js 结果转换为数组
function resultToArray(result) {
  if (!result || result.length === 0) return [];
  const columns = result[0].columns;
  const values = result[0].values;
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

// 辅助函数：获取单行结果
function resultToObject(result) {
  const arr = resultToArray(result);
  return arr.length > 0 ? arr[0] : null;
}

// ==================== 任务操作 ====================

function getAllTasks() {
  const result = db.exec('SELECT * FROM tasks ORDER BY created_at DESC');
  return resultToArray(result);
}

function addTask(title, category = 'general') {
  db.run('INSERT INTO tasks (title, category) VALUES (?, ?)', [title, category]);

  // 获取最后插入的 ID
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  // 为今天的日期添加任务记录
  const today = getTodayDate();
  db.run('INSERT INTO daily_records (date, task_id, completed) VALUES (?, ?, 0)', [today, lastId]);

  saveDatabase();
  return { id: lastId, title, category };
}

function deleteTask(taskId) {
  db.run('DELETE FROM daily_records WHERE task_id = ?', [taskId]);
  db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
  saveDatabase();
  return true;
}

function getTasksByDate(date) {
  const result = db.exec(`
    SELECT t.*, dr.completed, dr.completed_at
    FROM tasks t
    LEFT JOIN daily_records dr ON t.id = dr.task_id AND dr.date = ?
    ORDER BY t.created_at DESC
  `, [date]);
  return resultToArray(result);
}

// ==================== 每日记录操作 ====================

function toggleTaskCompletion(taskId, date, completed) {
  const completedAt = completed ? new Date().toISOString() : null;

  db.run(`
    INSERT OR REPLACE INTO daily_records (date, task_id, completed, completed_at)
    VALUES (?, ?, ?, ?)
  `, [date, taskId, completed ? 1 : 0, completedAt]);

  saveDatabase();
  return true;
}

function getDailyStats(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  const result = db.exec(`
    SELECT
      dr.date,
      COUNT(dr.task_id) as total_tasks,
      SUM(dr.completed) as completed_tasks
    FROM daily_records dr
    WHERE dr.date >= ? AND dr.date <= ?
    GROUP BY dr.date
  `, [startDate, endDate]);

  return resultToArray(result);
}

function getDateStats(date) {
  const result = db.exec(`
    SELECT
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN dr.completed = 1 THEN 1 ELSE 0 END) as completed_tasks
    FROM tasks t
    LEFT JOIN daily_records dr ON t.id = dr.task_id AND dr.date = ?
  `, [date]);

  const stats = resultToObject(result);
  return {
    total_tasks: stats ? (stats.total_tasks || 0) : 0,
    completed_tasks: stats ? (stats.completed_tasks || 0) : 0
  };
}

// ==================== 设置操作 ====================

function getSetting(key) {
  const result = db.exec('SELECT value FROM settings WHERE key = ?', [key]);
  const row = resultToObject(result);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  saveDatabase();
  return true;
}

function getAllSettings() {
  const result = db.exec('SELECT key, value FROM settings');
  const rows = resultToArray(result);
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

// ==================== 工具函数 ====================

function getTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  getAllTasks,
  addTask,
  deleteTask,
  getTasksByDate,
  toggleTaskCompletion,
  getDailyStats,
  getDateStats,
  getSetting,
  setSetting,
  getAllSettings,
  getTodayDate,
  closeDatabase
};
