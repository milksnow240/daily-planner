' 隐藏窗口启动每日计划服务
' WScript.Shell.Run 第二个参数 0 = 隐藏窗口
CreateObject("WScript.Shell").Run "cmd /c cd /d D:\Cursor\daily_planner\daily-planner && node server.js", 0, False
