/**
 * 从 Plans/*.md 解析计划并导入每日任务
 */
const fs = require('fs');
const path = require('path');

const PLANS_DIR = path.join(__dirname, 'Plans');
const API = 'http://localhost:18930/api/tasks';

const PREFIX_MAP = {
  deeplearning: '深度学习',
  ielst: '雅思',
  ielts: '雅思'
};

function getPrefix(filename, content) {
  const base = path.basename(filename, '.md').toLowerCase();
  if (PREFIX_MAP[base]) return PREFIX_MAP[base];

  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    if (titleMatch[1].includes('深度学习')) return '深度学习';
    if (titleMatch[1].includes('雅思')) return '雅思';
  }
  return path.basename(filename, '.md');
}

function normalize(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseDailyTable(content) {
  const tasks = [];
  const lines = normalize(content).split('\n');
  let inTable = false;

  for (const line of lines) {
    if (/^\|\s*模块\s*\|\s*时间\s*\|/.test(line)) {
      inTable = true;
      continue;
    }
    if (inTable) {
      if (!line.startsWith('|')) {
        inTable = false;
        continue;
      }
      if (line.includes('---')) continue;
      const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
      if (m) {
        tasks.push({ mod: m[1].trim(), time: m[2].trim(), task: m[3].trim() });
      }
    }
  }
  return tasks;
}

function parseChecklist(content) {
  const tasks = [];
  const section = normalize(content).match(
    /每天最低(?:要求|完成标准)：\s*\n([\s\S]*?)(?=\n---|\n#|\n##\s*Day|\n##\s*二、|$)/
  );
  if (!section) return tasks;

  for (const line of section[1].split('\n')) {
    const m = line.match(/^-\s*\[[ x]\]\s*(.+)$/);
    if (m) tasks.push(m[1].trim());
  }
  return tasks;
}

function getTodayDayPattern() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return `${month}\\s*月\\s*${day}\\s*日`;
}

function parseTodaySection(content) {
  const datePattern = getTodayDayPattern();
  const re = new RegExp(
    `##\\s*(Day\\s*\\d+[^\\n]*${datePattern}[^\\n]*)\\s*\\n([\\s\\S]*?)(?=\\n##\\s*Day|\\n#\\s|$)`,
    'i'
  );
  const match = normalize(content).match(re);
  if (!match) return null;
  return { title: match[1].trim(), body: match[2] };
}

function extractTasksFromPlans() {
  const files = fs.readdirSync(PLANS_DIR).filter(f => f.endsWith('.md'));
  const allTasks = [];

  for (const file of files) {
    const content = normalize(fs.readFileSync(path.join(PLANS_DIR, file), 'utf8'));
    const prefix = getPrefix(file, content);

    for (const row of parseDailyTable(content)) {
      allTasks.push({
        title: `[${prefix}] ${row.mod}（${row.time}）`,
        category: 'study'
      });
    }

    for (const item of parseChecklist(content)) {
      allTasks.push({
        title: `[${prefix}] ${item}`,
        category: 'study'
      });
    }

    const today = parseTodaySection(content);
    if (today) {
      allTasks.push({
        title: `[${prefix}·今日] ${today.title}`,
        category: 'study'
      });
    }
  }

  return allTasks;
}

async function api(method, url, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status}`);
  if (method === 'DELETE') return true;
  return res.json();
}

async function clearAllTasks() {
  const existing = await api('GET', '');
  for (const task of existing) {
    await api('DELETE', `/${task.id}`);
  }
  return existing.length;
}

async function main() {
  const tasks = extractTasksFromPlans();
  if (tasks.length === 0) {
    console.error('未从 Plans 文件夹解析到任何任务');
    process.exit(1);
  }

  const removed = await clearAllTasks();
  console.log(`已清除 ${removed} 条旧任务`);

  for (const task of tasks) {
    await api('POST', '', task);
    console.log(`已添加: ${task.title}`);
  }

  console.log(`\n完成：共导入 ${tasks.length} 条任务`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
