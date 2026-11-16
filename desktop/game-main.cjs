const {app,BrowserWindow,Menu,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'game-config.json'),'utf8'));const test=process.argv.includes('--self-test'),reportIndex=process.argv.indexOf('--self-test-report');
const report=reportIndex>=0?path.resolve(process.argv[reportIndex+1]):path.join(path.dirname(process.execPath),'game-verification.json');
const gameKey=crypto.createHash('sha256').update(config.projectId).digest('hex').slice(0,24);const data=test?path.join(path.dirname(report),'game-test-data'):path.join(app.getPath('appData'),'KotobaGames',gameKey);fs.mkdirSync(data,{recursive:true});app.setPath('userData',data);app.setName(config.title);
let win;const slotsFile=path.join(data,'progress.json');
function readSlots(){try{const value=JSON.parse(fs.readFileSync(slotsFile,'utf8'));return Array.isArray(value)?value:[]}catch{return []}}
ipcMain.on('game-read-slots',event=>{event.returnValue=event.sender===win?.webContents?readSlots():[]});
ipcMain.on('game-write-slots',(event,text)=>{try{if(event.sender!==win?.webContents||typeof text!=='string'||Buffer.byteLength(text)>1024*1024)throw Error('无效存档');const slots=JSON.parse(text);if(!Array.isArray(slots)||slots.length>6)throw Error('无效存档');const tmp=slotsFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(slots),'utf8');fs.renameSync(tmp,slotsFile);event.returnValue={ok:true}}catch(e){event.returnValue={ok:false,error:e.message}}});
const settingsFile=path.join(data,'settings.json');
ipcMain.on('game-read-settings',event=>{
  try {event.returnValue=event.sender===win?.webContents?JSON.parse(fs.readFileSync(settingsFile,'utf8')):{}}catch{event.returnValue={}}
});
ipcMain.on('game-write-settings',(event,text)=>{
  try {
    if(event.sender!==win?.webContents||typeof text!=='string'||text.length>4096)throw Error('无效设置');
    const value=JSON.parse(text);
    if(!['music','voice'].every(key=>Number.isFinite(value[key])&&value[key]>=0&&value[key]<=1))throw Error('无效音量');
    const temporary=settingsFile+'.tmp';fs.writeFileSync(temporary,JSON.stringify({music:value.music,voice:value.voice}));fs.renameSync(temporary,settingsFile);
    event.returnValue={ok:true};
  } catch(error){event.returnValue={ok:false,error:error.message}}
});
ipcMain.on('game-exit',event=>{if(event.sender===win?.webContents)app.quit()});
function send(command){win?.webContents.send('game-menu',command)}
if(!test&&!app.requestSingleInstanceLock())app.quit();else app.whenReady().then(async()=>{
  win=new BrowserWindow({title:config.title,width:1280,height:760,minWidth:800,minHeight:500,show:!test,backgroundColor:'#24372e',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('file://'))event.preventDefault()});win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'游戏',submenu:[{label:'返回标题菜单',click:()=>send('title')},{label:'游戏设置',click:()=>send('settings')},{label:'存档 / 读档',accelerator:'CmdOrCtrl+S',click:()=>send('saves')},{label:'读取进度',accelerator:'CmdOrCtrl+O',click:()=>send('saves')},{type:'separator'},{role:'quit',label:'退出游戏'}]},{label:'显示',submenu:[{role:'togglefullscreen',label:'全屏',accelerator:'F11'},{role:'resetZoom',label:'实际大小'}]}]));
  await win.loadFile(path.join(__dirname,'game.html'));win.setTitle(config.title);
  if(test){win.setContentSize(900,540);try{const result=await win.webContents.executeJavaScript(`(()=>{const a=(ok,m)=>{if(!ok)throw Error(m)};a(document.querySelector('#stage'),'游戏舞台');a(document.querySelector('[data-title-action="start"]'),'标题菜单');document.querySelector('[data-title-action="load"]').click();a(document.querySelector('#cancelSaves'),'存档窗口取消');document.querySelector('#cancelSaves').click();a(document.querySelector('#gameSavePanel').hidden&&!document.querySelector('#gameTitleScreen').hidden,'取消返回标题');document.querySelector('[data-title-action="start"]').click();a(!document.querySelector('.rail'),'游戏中不包含编辑器');document.querySelector('#saves').click();a(!document.querySelector('#gameSavePanel').hidden,'存读档面板');const cancel=document.querySelector('#cancelSaves').getBoundingClientRect(),back=document.querySelector('#closeSaves').getBoundingClientRect();a(cancel.top>=0&&back.bottom<=innerHeight,'取消返回按钮完整可见');document.querySelector('#cancelSaves').click();a(document.querySelector('#gameSavePanel').hidden,'取消返回游戏');document.querySelector('#saves').click();const first=document.querySelector('[data-save="0"]');a(first&&!first.disabled,'可保存当前进度');first.click();a(gameNative.readSlots()[0]?.blockId,'进度写入本机文件');document.querySelector('[data-load="0"]').click();a(document.querySelector('#gameSavePanel').hidden,'进度读取');return {ok:true,title:document.title,stage:!!document.querySelector('.scene-current'),saves:true,reader:true,cancel:true,editorAbsent:true}})()`);fs.writeFileSync(report,JSON.stringify(result,null,2));app.exit(0)}catch(e){fs.writeFileSync(report,JSON.stringify({ok:false,error:e.stack},null,2));app.exit(1)}}
}).catch(e=>{fs.writeFileSync(test?report:path.join(data,'startup-error.txt'),JSON.stringify({ok:false,error:e.stack}));app.exit(1)});
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});app.on('window-all-closed',()=>app.quit());
