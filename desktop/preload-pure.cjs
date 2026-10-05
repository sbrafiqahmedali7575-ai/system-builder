const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('systemBuilderDesktop',{
  read:()=>ipcRenderer.invoke('database:read'),
  commit:(operations,revision)=>ipcRenderer.invoke('database:commit',operations,revision),
  onChange:(callback)=>{const listener=()=>callback();ipcRenderer.on('database:changed',listener);return()=>ipcRenderer.removeListener('database:changed',listener);}
});

