# 📋 每日计划 - 自动提醒系统

一个基于 **Node.js + SQLite + Web 界面** 的每日计划管理工具，每天 21:30 自动弹窗提醒你更新计划。

## 快速启动

```bash
cd /d D:\Vscode\everyday_sum\daily-planner
npm start
```

启动后会自动打开浏览器访问 `http://localhost:18930`，界面会显示日历视图和今日任务列表。

## 功能

| 功能 | 说明 |
|------|------|
| 📅 **日历视图** | 月视图展示任务完成情况，颜色区分完成度（绿/黄/红） |
| ✅ **任务管理** | 添加/删除任务，标记完成，分类（工作/生活/学习/其他） |
| ⏰ **自动提醒** | 每天 21:30 弹出提醒窗口，支持系统通知 |
| ⚙️ **自定义设置** | 侧边栏可调整提醒时间和开关 |

## 提醒方式

到达设定时间时：
1. **系统通知** - Windows 右下角弹窗
2. **网页弹窗** - 浏览器内弹出紫色提醒界面
3. 点击 "去更新计划" 直接进入日历

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (sql.js WebAssembly)
- **前端**: 原生 HTML/CSS/JS (无框架)
- **定时器**: node-cron

## 目录结构

```
daily-planner/
├── server.js       # Express 服务器 (启动入口)
├── database.js     # SQLite 数据库操作
├── scheduler.js    # node-cron 定时任务
├── package.json
├── data/           # 数据库文件 (自动创建)
└── public/
    ├── index.html  # 日历视图页面
    └── styles.css  # 样式文件
```
