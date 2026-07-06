const express = require('express');
const path = require('path');
const { initDatabase, getAllTasks, addTask, deleteTask, getTasksByDate,
        toggleTaskCompletion, getDailyStats, getDateStats, getSetting, setSetting,
        getAllSettings, getTodayDate, getAllPhases, getPhaseById, addPhase,
        updatePhase, deletePhase, bulkSetMilestones, toggleMilestone,
        addMilestone, deleteMilestone } = require('./database');
const { exec } = require('child_process');
const { startScheduler, testReminder, updateReminderTime, toggleReminder } = require('./scheduler');

const app = express();
const PORT = 18930;

// 解析 JSON 请求体
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// ==================== API 路由 ====================

// 任务相关
app.get('/api/tasks', (req, res) => res.json(getAllTasks()));

app.get('/api/tasks/:date', (req, res) => {
  res.json(getTasksByDate(req.params.date));
});

app.post('/api/tasks', (req, res) => {
  const { title, category } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  res.json(addTask(title, category || 'general'));
});

app.delete('/api/tasks/:id', (req, res) => {
  res.json(deleteTask(parseInt(req.params.id)));
});

app.post('/api/tasks/:id/toggle', (req, res) => {
  const { date, completed } = req.body;
  res.json(toggleTaskCompletion(parseInt(req.params.id), date, !!completed));
});

// 阶段任务
app.get('/api/phases', (req, res) => res.json(getAllPhases()));

app.get('/api/phases/:id', (req, res) => {
  const phase = getPhaseById(parseInt(req.params.id));
  if (!phase) return res.status(404).json({ error: 'Phase not found' });
  res.json(phase);
});

app.post('/api/phases', (req, res) => {
  const { title, description, start_date, end_date, category, progress } = req.body;
  if (!title || !start_date || !end_date) {
    return res.status(400).json({ error: 'Title, start_date and end_date are required' });
  }
  res.json(addPhase({ title, description, start_date, end_date, category, progress }));
});

app.put('/api/phases/:id', (req, res) => {
  const phase = updatePhase(parseInt(req.params.id), req.body);
  if (!phase) return res.status(404).json({ error: 'Phase not found' });
  res.json(phase);
});

app.delete('/api/phases/:id', (req, res) => {
  res.json(deletePhase(parseInt(req.params.id)));
});

app.post('/api/phases/:id/milestones', (req, res) => {
  const phaseId = parseInt(req.params.id);
  const phase = getPhaseById(phaseId);
  if (!phase) return res.status(404).json({ error: 'Phase not found' });
  if (!Array.isArray(req.body.milestones)) {
    return res.status(400).json({ error: 'milestones array is required' });
  }
  res.json(bulkSetMilestones(phaseId, req.body.milestones));
});

app.post('/api/phase-milestones/:id/toggle', (req, res) => {
  const { completed } = req.body;
  const result = toggleMilestone(parseInt(req.params.id), !!completed);
  if (!result) return res.status(404).json({ error: 'Milestone not found' });
  res.json(result);
});

app.post('/api/phases/:id/milestones/add', (req, res) => {
  const phaseId = parseInt(req.params.id);
  const { title, stage_index, stage_title, sort_order } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const phase = getPhaseById(phaseId);
  if (!phase) return res.status(404).json({ error: 'Phase not found' });
  res.json(addMilestone(phaseId, { title, stage_index, stage_title, sort_order }));
});

app.delete('/api/phase-milestones/:id', (req, res) => {
  res.json(deleteMilestone(parseInt(req.params.id)));
});

// 统计
app.get('/api/stats/:year/:month', (req, res) => {
  res.json(getDailyStats(parseInt(req.params.year), parseInt(req.params.month)));
});

app.get('/api/stats/date/:date', (req, res) => {
  res.json(getDateStats(req.params.date));
});

// 设置
app.get('/api/settings', (req, res) => res.json(getAllSettings()));
app.get('/api/settings/:key', (req, res) => res.json({ value: getSetting(req.params.key) }));
app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  setSetting(key, value);
  if (key === 'reminder_time') {
    updateReminderTime(value);
  } else if (key === 'reminder_enabled') {
    toggleReminder(value === 'true');
  }
  res.json({ success: true });
});

// 提醒测试
app.post('/api/test-reminder', (req, res) => {
  testReminder();
  res.json({ success: true });
});

// 今日日期
app.get('/api/today', (req, res) => res.json({ date: getTodayDate() }));

// ==================== 监听端口 ====================

function openReminderPage() {
  const url = `http://localhost:${PORT}/reminder.html`;
  console.log('⏰ 提醒时间到！正在打开:', url);

  if (process.platform === 'win32') {
    exec(`start "" "${url}"`, { shell: true }, (err) => {
      if (err) console.error('打开提醒页面失败:', err.message);
    });
  } else if (process.platform === 'darwin') {
    exec(`open "${url}"`, (err) => {
      if (err) console.error('打开提醒页面失败:', err.message);
    });
  } else {
    exec(`xdg-open "${url}"`, (err) => {
      if (err) console.error('打开提醒页面失败:', err.message);
    });
  }
}

async function main() {
  // 初始化数据库
  await initDatabase();

  // 启动定时提醒
  startScheduler(openReminderPage);

  app.listen(PORT, () => {
    const reminderTime = getSetting('reminder_time') || '09:25';
    console.log('=========================================');
    console.log('  📋 每日计划服务已启动！');
    console.log('  🌐 打开浏览器访问:');
    console.log('  http://localhost:' + PORT);
    console.log('=========================================');
    console.log(`  ⏰ 每天 ${reminderTime} 自动提醒`);
    console.log('=========================================');
  });
}

main();
