const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  resize: (w, h) => ipcRenderer.send('resize', w, h),
  attention: () => ipcRenderer.send('attention'),
  minimize: () => ipcRenderer.send('minimize'),
  close: () => ipcRenderer.send('close')
});
