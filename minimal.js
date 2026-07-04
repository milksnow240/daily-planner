const { app, BrowserWindow } = require('electron');
console.log('=== SUCCESS ===');
console.log('app.whenReady type:', typeof app.whenReady);

app.whenReady(() => {
  console.log('App ready! Creating window...');
  const win = new BrowserWindow({ width: 400, height: 300 });
  win.loadURL('data:text/html,<h1>Works!</h1>');
  console.log('Window created');
  
  setTimeout(() => {
    console.log('Quitting...');
    app.quit();
  }, 3000);
});
