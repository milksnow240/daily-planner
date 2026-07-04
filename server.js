const express = require('express');
const path = require('path');
const { initDatabase, getAllTasks, addTask, deleteTask, getTasksByDate,
        toggleTaskCompletion, getDailyStats, getDateStats, getSetting, setSetting,
        getAllSettings, getTodayDate } = require('./database');
const { startScheduler, testReminder } = require('./scheduler');

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
  res.json(setSetting(key, value));
});

// 提醒测试
app.post('/api/test-reminder', (req, res) => {
  testReminder();
  res.json({ success: true });
});

// 今日日期
app.get('/api/today', (req, res) => res.json({ date: getTodayDate() }));

// ==================== 监听端口 ====================

async function main() {
  // 初始化数据库
  await initDatabase();

  // 启动定时提醒
  startScheduler(() => {
    console.log('⏰ 提醒时间到！请打开 http://localhost:' + PORT + '/reminder.html');

    // 尝试系统通知（桌面环境）
    if (process.env.OS && process.env.OS.includes('Windows')) {
      const { exec } = require('child_process');
      exec(`msg * "📋 该更新每日计划了！打开 http://localhost:${PORT}"`, () => {});
    }
  });

  app.listen(PORT, () => {
    console.log('=========================================');
    console.log('  📋 每日计划服务已启动！');
    console.log('  🌐 打开浏览器访问:');
    console.log('  http://localhost:' + PORT);
    console.log('=========================================');
    console.log('  ⏰ 每天 21:30 自动提醒');
    console.log('=========================================');
  });
}

main();
