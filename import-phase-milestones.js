/**
 * 从 Plans/*.md 解析阶段目标并导入到阶段任务
 */
const fs = require('fs');
const path = require('path');
const { initDatabase, getAllPhases, bulkSetMilestones, closeDatabase } = require('./database');

const PLANS_DIR = path.join(__dirname, 'Plans');

const PHASE_PLAN_MAP = [
  { match: /雅思/i, file: 'IELST.md', parser: 'ielts' },
  { match: /深度学习|李沐/i, file: 'deeplearning.md', parser: 'deeplearning' }
];

function normalize(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseIeltsStages(content) {
  const section = normalize(content).match(/# 三、阶段目标\s*\n([\s\S]*?)(?=\n# 四、|$)/);
  if (!section) return [];

  const stages = [];
  const parts = section[1].split(/\n(?=## 第)/);

  parts.forEach((part, stageIndex) => {
    const trimmed = part.trim();
    if (!trimmed.startsWith('## 第')) return;

    const titleLine = trimmed.match(/^##\s*(.+)$/m);
    const stage_title = titleLine ? titleLine[1].trim() : `第 ${stageIndex + 1} 阶段`;
    const goals = [];

    const goalSection = trimmed.match(/阶段目标：\s*\n([\s\S]*?)(?=\n\||\n---|\n##|$)/);
    if (goalSection) {
      for (const line of goalSection[1].split('\n')) {
        const m = line.match(/^-\s*(.+)$/);
        if (m) goals.push(m[1].trim());
      }
    }

    for (const line of trimmed.split('\n')) {
      const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
      if (!m || m[1].includes('---') || m[1].trim() === '科目') continue;
      goals.push(`[${m[1].trim()}] ${m[2].trim()}`);
    }

    goals.forEach((title, sort_order) => {
      stages.push({ stage_index: stageIndex, stage_title, title, sort_order });
    });
  });

  return stages;
}

function parseDeeplearningStages(content) {
  const section = normalize(content).match(/# 三、阶段验收标准\s*\n([\s\S]*?)(?=\n# 四、|$)/);
  if (!section) return [];

  const stages = [];
  const parts = section[1].split(/\n(?=## 第)/);

  parts.forEach((part, stageIndex) => {
    const trimmed = part.trim();
    if (!trimmed.startsWith('## 第')) return;

    const titleLine = trimmed.match(/^##\s*(.+)$/m);
    const stage_title = titleLine ? titleLine[1].trim() : `第 ${stageIndex + 1} 阶段`;

    const acceptance = trimmed.match(/验收标准：\s*\n([\s\S]*?)(?=\n---|\n##|$)/);
    if (!acceptance) return;

    let sort_order = 0;
    for (const line of acceptance[1].split('\n')) {
      const m = line.match(/^-\s*\[[ x]\]\s*(.+)$/);
      if (m) {
        stages.push({
          stage_index: stageIndex,
          stage_title,
          title: m[1].trim(),
          sort_order: sort_order++
        });
      }
    }
  });

  return stages;
}

function loadMilestonesForPhase(phase) {
  const mapping = PHASE_PLAN_MAP.find(item => item.match.test(phase.title));
  if (!mapping) return [];

  const filePath = path.join(PLANS_DIR, mapping.file);
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf8');
  return mapping.parser === 'ielts'
    ? parseIeltsStages(content)
    : parseDeeplearningStages(content);
}

async function main() {
  await initDatabase();
  const phases = getAllPhases();
  let imported = 0;

  for (const phase of phases) {
    const milestones = loadMilestonesForPhase(phase);
    if (milestones.length === 0) {
      console.log(`跳过（无匹配计划）: ${phase.title}`);
      continue;
    }

    bulkSetMilestones(phase.id, milestones);
    console.log(`已导入 ${milestones.length} 个阶段目标 → ${phase.title}`);
    imported += milestones.length;
  }

  console.log(`\n完成：共导入 ${imported} 个阶段目标`);
  closeDatabase();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
