require('@smartspectra/node-sdk/preload');
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('breathlines', {
  consent: value => ipcRenderer.invoke('breathlines:consent',value),
  key: () => ipcRenderer.invoke('breathlines:key'),
  export: (type,data) => ipcRenderer.invoke('breathlines:export',{type,data}),
});
