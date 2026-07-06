const cron = require('node-cron');
const { getSetting, setSetting } = require('./database');

let scheduledTask = null;
let reminderCallback = null;

/**
 * 解析时间字符串 "HH:MM" 并转换为 cron 表达式
 */
function timeToCron(timeStr) {
  const [hours, minutes] = timeStr.split(':');
  return `${minutes} ${hours} * * *`;
}

/**
 * 启动定时提醒
 * @param {Function} callback - 到达提醒时间时调用的回调函数
 */
function startScheduler(callback) {
  if (scheduledTask) {
    scheduledTask.stop();
  }

  reminderCallback = callback;
  const reminderTime = getSetting('reminder_time') || '09:25';
  const enabled = getSetting('reminder_enabled') !== 'false';

  if (!enabled) {
    console.log('Reminder is disabled');
    return;
  }

  const cronExpression = timeToCron(reminderTime);
  console.log(`Scheduler started with cron: ${cronExpression} (reminder at ${reminderTime})`);

  scheduledTask = cron.schedule(cronExpression, () => {
    console.log('Reminder triggered!');
    if (reminderCallback) {
      reminderCallback();
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });
}

/**
 * 停止定时提醒
 */
function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('Scheduler stopped');
  }
}

/**
 * 更新提醒时间
 * @param {string} newTime - 新时间 "HH:MM"
 */
function updateReminderTime(newTime) {
  setSetting('reminder_time', newTime);
  if (reminderCallback) {
    startScheduler(reminderCallback);
  }
}

/**
 * 切换提醒开关状态
 * @param {boolean} enabled
 */
function toggleReminder(enabled) {
  setSetting('reminder_enabled', enabled ? 'true' : 'false');
  if (enabled) {
    if (reminderCallback) {
      startScheduler(reminderCallback);
    }
  } else {
    stopScheduler();
  }
}

/**
 * 测试提醒功能（立即触发）
 */
function testReminder() {
  if (reminderCallback) {
    console.log('Testing reminder...');
    reminderCallback();
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  updateReminderTime,
  toggleReminder,
  testReminder
};
