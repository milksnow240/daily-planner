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

  // 创建阶段任务表
  db.run(`
    CREATE TABLE IF NOT EXISTS phase_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      category TEXT DEFAULT 'study',
      progress INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建阶段目标（里程碑）表
  db.run(`
    CREATE TABLE IF NOT EXISTS phase_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phase_id INTEGER NOT NULL,
      stage_index INTEGER NOT NULL DEFAULT 0,
      stage_title TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      completed INTEGER DEFAULT 0,
      completed_at DATETIME,
      FOREIGN KEY (phase_id) REFERENCES phase_tasks(id)
    )
  `);

  // 初始化默认设置
  const defaultSettings = [
    ['reminder_time', '09:25'],
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

// ==================== 阶段任务操作 ====================

function getMilestonesByPhaseId(phaseId) {
  const result = db.exec(`
    SELECT * FROM phase_milestones
    WHERE phase_id = ?
    ORDER BY stage_index ASC, sort_order ASC
  `, [phaseId]);
  return resultToArray(result);
}

function getMilestoneById(id) {
  const result = db.exec('SELECT * FROM phase_milestones WHERE id = ?', [id]);
  return resultToObject(result);
}

function calculateProgressFromMilestones(milestones) {
  if (!milestones.length) return 0;
  const completed = milestones.filter(m => m.completed === 1 || m.completed === true).length;
  return Math.round(completed / milestones.length * 100);
}

function syncPhaseProgress(phaseId) {
  const milestones = getMilestonesByPhaseId(phaseId);
  const progress = calculateProgressFromMilestones(milestones);
  db.run('UPDATE phase_tasks SET progress = ? WHERE id = ?', [progress, phaseId]);
  saveDatabase();
  return progress;
}

function enrichPhase(phase) {
  const milestones = getMilestonesByPhaseId(phase.id);
  const progress = milestones.length > 0
    ? calculateProgressFromMilestones(milestones)
    : (phase.progress || 0);

  if (milestones.length > 0 && progress !== phase.progress) {
    db.run('UPDATE phase_tasks SET progress = ? WHERE id = ?', [progress, phase.id]);
    saveDatabase();
  }

  return { ...phase, progress, milestones };
}

function getAllPhases() {
  const result = db.exec('SELECT * FROM phase_tasks ORDER BY start_date ASC, created_at DESC');
  return resultToArray(result).map(enrichPhase);
}

function getPhaseById(id) {
  const result = db.exec('SELECT * FROM phase_tasks WHERE id = ?', [id]);
  const phase = resultToObject(result);
  return phase ? enrichPhase(phase) : null;
}

function addPhase({ title, description = '', start_date, end_date, category = 'study', progress = 0 }) {
  db.run(
    'INSERT INTO phase_tasks (title, description, start_date, end_date, category, progress) VALUES (?, ?, ?, ?, ?, ?)',
    [title, description, start_date, end_date, category, progress]
  );
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDatabase();
  return getPhaseById(lastId);
}

function updatePhase(id, { title, description, start_date, end_date, category, progress }) {
  const existing = getPhaseById(id);
  if (!existing) return null;

  const milestones = existing.milestones || [];
  const resolvedProgress = milestones.length > 0
    ? calculateProgressFromMilestones(milestones)
    : (progress ?? existing.progress);

  db.run(
    `UPDATE phase_tasks SET
      title = ?,
      description = ?,
      start_date = ?,
      end_date = ?,
      category = ?,
      progress = ?
    WHERE id = ?`,
    [
      title ?? existing.title,
      description ?? existing.description,
      start_date ?? existing.start_date,
      end_date ?? existing.end_date,
      category ?? existing.category,
      resolvedProgress,
      id
    ]
  );
  saveDatabase();
  return getPhaseById(id);
}

function deletePhase(id) {
  db.run('DELETE FROM phase_milestones WHERE phase_id = ?', [id]);
  db.run('DELETE FROM phase_tasks WHERE id = ?', [id]);
  saveDatabase();
  return true;
}

function bulkSetMilestones(phaseId, milestones) {
  db.run('DELETE FROM phase_milestones WHERE phase_id = ?', [phaseId]);
  milestones.forEach((m, index) => {
    db.run(
      `INSERT INTO phase_milestones (phase_id, stage_index, stage_title, title, sort_order, completed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        phaseId,
        m.stage_index,
        m.stage_title,
        m.title,
        m.sort_order ?? index,
        m.completed ? 1 : 0
      ]
    );
  });
  syncPhaseProgress(phaseId);
  saveDatabase();
  return getPhaseById(phaseId);
}

function toggleMilestone(milestoneId, completed) {
  const existing = getMilestoneById(milestoneId);
  if (!existing) return null;

  const completedAt = completed ? new Date().toISOString() : null;
  db.run(
    'UPDATE phase_milestones SET completed = ?, completed_at = ? WHERE id = ?',
    [completed ? 1 : 0, completedAt, milestoneId]
  );
  const progress = syncPhaseProgress(existing.phase_id);
  saveDatabase();
  return {
    ...getMilestoneById(milestoneId),
    phase_progress: progress
  };
}

function addMilestone(phaseId, { stage_index, stage_title, title, sort_order }) {
  const milestones = getMilestonesByPhaseId(phaseId);
  const order = sort_order ?? milestones.length;
  db.run(
    `INSERT INTO phase_milestones (phase_id, stage_index, stage_title, title, sort_order, completed)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [phaseId, stage_index ?? 0, stage_title ?? '', title, order]
  );
  syncPhaseProgress(phaseId);
  saveDatabase();
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  return getMilestoneById(lastId);
}

function deleteMilestone(milestoneId) {
  const existing = getMilestoneById(milestoneId);
  if (!existing) return false;
  db.run('DELETE FROM phase_milestones WHERE id = ?', [milestoneId]);
  syncPhaseProgress(existing.phase_id);
  saveDatabase();
  return true;
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
  getAllPhases,
  getPhaseById,
  addPhase,
  updatePhase,
  deletePhase,
  getMilestonesByPhaseId,
  bulkSetMilestones,
  toggleMilestone,
  addMilestone,
  deleteMilestone,
  getSetting,
  setSetting,
  getAllSettings,
  getTodayDate,
  closeDatabase
};
