console.log('Test script starting...');
console.log('__dirname:', __dirname);
console.log('process.versions.node:', process.versions.node);

try {
  const electron = require('electron');
  console.log('require(electron) type:', typeof electron);
  console.log('require(electron) value:', electron);
  console.log('electron.app:', electron.app);
  console.log('electron.BrowserWindow:', electron.BrowserWindow);
} catch (err) {
  console.error('Error requiring electron:', err);
}
