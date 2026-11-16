const {app,BrowserWindow,ipcMain,dialog,Menu,clipboard,shell}=require('electron');
const {MAX_PROJECT_BYTES,MAX_EXPORT_BYTES}=require('./limits.cjs');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const selfTest=process.argv.includes('--self-test');
const verificationDir=path.join(root,'artifacts','verification');
const dataDir=selfTest?path.join(verificationDir,'test-data'):path.resolve(process.env.KOTOBA_DATA_DIR||path.join(app.getPath('appData'),'KotobaStudio'));
fs.mkdirSync(dataDir,{recursive:true});app.setPath('userData',dataDir);app.setName('Kotoba Studio');
const primaryInstance=selfTest||app.requestSingleInstanceLock();if(!primaryInstance)app.quit();
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus()}});
app.on('activate',()=>{if(win&&!win.isDestroyed()){win.show();win.focus()}});
let win,currentPath=null,pendingOpenPath=null,packageRunning=false,lastPackage=null,lastHtmlPreview=null;const recovery=path.join(dataDir,'recovery.kotoba.json');
function atomicWrite(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,data,'utf8');fs.renameSync(tmp,file)}
const store=require('./project-store.cjs').createProjectStore(dataDir,atomicWrite);
const activeFile=path.join(dataDir,'active-project.json');try{const active=JSON.parse(fs.readFileSync(activeFile,'utf8'));if(active.path&&fs.existsSync(active.path))currentPath=active.path}catch{}
function setActive(file){currentPath=file;atomicWrite(activeFile,JSON.stringify({path:file}));if(win)win.setTitle('Kotoba Studio — '+(file?path.basename(file):'新工程'))}
function validateText(text){if(typeof text!=='string'||Buffer.byteLength(text)>MAX_PROJECT_BYTES)throw Error('工程过大或格式无效');const p=JSON.parse(text);if(!p.scenes?.length||!Array.isArray(p.assets)||!Array.isArray(p.characters))throw Error('工程格式不完整');return text}
const recoveryQueue = require('./recovery-queue.cjs').createRecoveryQueue(recovery);
async function persistRecovery(event, body) {
  allowed(event);
  const target = currentPath;
  const result = await recoveryQueue.save(body, target);
  if (result.ok && target) store.registerSummary(target, {title: result.title});
  return result;
}
app.on('before-quit', event => {
  if (!recoveryQueue.busy()) return;
  event.preventDefault();
  recoveryQueue.flush().then(() => app.quit());
});
function allowed(event){if(event.sender!==win?.webContents)throw Error('无效窗口')}
let assistant;function aiService(){return assistant??=require('./ai-assistant.cjs').createAiService({directory:dataDir,secure:require('electron').safeStorage,...(selfTest?{fetchImpl:async()=>new Response(JSON.stringify({choices:[{message:{content:'# 建议章节\n未确认角色：测试建议稿。'},finish_reason:'stop'}]}),{status:200})}:{})})}
ipcMain.handle('ai-settings',event=>{allowed(event);return aiService().settings()});
ipcMain.handle('ai-save',(event,value)=>{allowed(event);return aiService().save(value)});
ipcMain.handle('ai-run',(event,value)=>{allowed(event);return aiService().run(value)});
ipcMain.handle('ai-cancel',event=>{allowed(event);return aiService().cancel()});

let mediaImportRunning=false;
ipcMain.handle('import-media',async(event,options={})=>{allowed(event);if(mediaImportRunning)throw Error('请等待当前素材导入完成');mediaImportRunning=true;try{const mode=options.mode==='directory'?'directory':'files';const chosen=await dialog.showOpenDialog(win,{title:mode==='directory'?'导入素材文件夹':'批量导入素材',properties:mode==='directory'?['openDirectory']:['openFile','multiSelections'],...(mode==='files'?{filters:[{name:'图片与音频',extensions:['png','jpg','jpeg','webp','gif','svg','mp3','wav','ogg','m4a','aac','flac','opus']}]}:{})});if(chosen.canceled)return {canceled:true};return await require('./media-importer.cjs').importMediaPaths({paths:chosen.filePaths,mode,budget:Math.min(MAX_PROJECT_BYTES,Math.max(0,Number(options.budget)||0)),onProgress:value=>{if(!win.isDestroyed())win.webContents.send('import-media-progress',value)}})}finally{mediaImportRunning=false}});
ipcMain.handle('project-reset',async event=>{allowed(event);setActive(null);await recoveryQueue.flush()});
ipcMain.on('recovery-read',(event)=>{try{allowed(event);if(selfTest){event.returnValue=null;return}event.returnValue=fs.existsSync(recovery)?fs.readFileSync(recovery,'utf8'):null}catch{event.returnValue=null}});
ipcMain.handle('recovery-write',persistRecovery);
ipcMain.handle('recovery-project-write',persistRecovery);
ipcMain.handle('builtin-image',(event)=>{allowed(event);return 'data:image/svg+xml;base64,'+fs.readFileSync(path.join(root,'dist','classroom.svg')).toString('base64')});
ipcMain.handle('project-open',async event=>{allowed(event);await recoveryQueue.flush();const result=await dialog.showOpenDialog(win,{title:'打开 Galgame 工程',filters:[{name:'Kotoba 工程',extensions:['json']}],properties:['openFile']});if(result.canceled)return null;const file=result.filePaths[0];if(fs.statSync(file).size>MAX_PROJECT_BYTES)throw Error('工程文件超过 256 MB');pendingOpenPath=file;return {text:fs.readFileSync(file,'utf8'),path:file}});
ipcMain.handle('project-accept',async(event,file)=>{allowed(event);await recoveryQueue.flush();if(typeof file==='string'&&file===pendingOpenPath&&file.endsWith('.json')){setActive(file);store.register(file,fs.readFileSync(file,'utf8'))}});
ipcMain.handle('file-save',async(event,{name,text,kind,saveAs})=>{allowed(event);await recoveryQueue.flush();if(typeof text!=='string'||Buffer.byteLength(text)>MAX_EXPORT_BYTES)throw Error('文件过大');let file=kind==='project'&&!saveAs?currentPath:null;if(!file){const result=await dialog.showSaveDialog(win,{title:kind==='game'?'导出离线试玩':kind==='json'?'保存特效预设':'保存工程',defaultPath:name.replace(/[<>:"/\\|?*]/g,'_'),filters:[{name:kind==='game'?'HTML 试玩':kind==='text'?'剧本文本':kind==='json'?'特效预设':'Kotoba 工程',extensions:[kind==='game'?'html':kind==='text'?'txt':'json']}]});if(result.canceled)return {canceled:true};file=result.filePath}if(kind==='project')validateText(text);atomicWrite(file,text);if(kind==='game')lastHtmlPreview=file;if(kind==='project'){setActive(file);store.register(file,fs.readFileSync(file,'utf8'))}return {ok:true,path:file}});
ipcMain.handle('feature-file',(event,name)=>{allowed(event);if(!['style.css','features.css'].includes(name))throw Error('未知资源');return fs.readFileSync(path.join(root,'dist',name),'utf8')});
ipcMain.handle('project-library',async(event,action,payload={})=>{allowed(event);await recoveryQueue.flush();if(action==='list')return store.list();if(action==='create'){const text=validateText(JSON.stringify(payload.project));const file=store.create(payload.project);setActive(file);atomicWrite(recovery,text);return {path:file}}const r=store.get(payload.id);if(action==='open'){if(r.trashed)throw Error('请先恢复工程');const text=validateText(fs.readFileSync(r.path,'utf8'));pendingOpenPath=r.path;return {path:r.path,text}}if(action==='delete'){const active=currentPath===r.path;store.trash(r.id);if(active)setActive(null);return {active}}if(action==='restore'){store.restore(r.id);return {ok:true}}throw Error('未知工程操作')});
ipcMain.handle('game-slots',(event,action,id,payload={})=>{allowed(event);return store.slots(id,action==='save'?payload.slot:undefined,payload.progress)});
ipcMain.handle('clipboard-text',event=>{allowed(event);return selfTest?'粘贴角色：来自剪贴板的台词。\n':clipboard.readText()});
ipcMain.handle('package-game',async(event,options)=>{allowed(event);if(packageRunning)throw Error('已有打包任务正在进行');validateText(JSON.stringify(options.project));const chosen=await dialog.showOpenDialog(win,{title:'选择游戏成品输出位置',properties:['openDirectory','createDirectory']});if(chosen.canceled)return {canceled:true};packageRunning=true;try{const result=await require('./package-game.cjs').packageGame({project:options.project,format:options.format,outputParent:chosen.filePaths[0],runtimeDirectory:path.dirname(process.execPath),runtimeExe:process.execPath,sourceRoot:root,onProgress:progress=>{if(!win.isDestroyed())win.webContents.send('package-game-progress',progress)}});lastPackage=result;return result}finally{packageRunning=false}});
ipcMain.handle('open-package-folder',async event=>{allowed(event);if(!lastPackage)throw Error('尚无打包成品');const error=await shell.openPath(lastPackage.directory);if(error)throw Error(error);return {ok:true}});
ipcMain.handle('open-export-output', async (event, kind) => {
  allowed(event);
  const output = {
    executable: lastPackage?.executable,
    preview: lastHtmlPreview,
    report: lastPackage && path.join(lastPackage.directory, '打包信息.json')
  }[kind];
  const extensions = {executable: '.exe', preview: '.html', report: '.json'};
  if (!Object.hasOwn(extensions, kind) || !output || path.extname(output).toLowerCase() !== extensions[kind] || !fs.existsSync(output)) {
    throw Error('未找到可打开的成品文件');
  }
  const error = await shell.openPath(output);
  if (error) throw Error(error);
  return {ok: true};
});
function send(command){win?.webContents.send('menu-command',command)}
if(primaryInstance)app.whenReady().then(async()=>{win=new BrowserWindow({width:1440,height:940,minWidth:960,minHeight:680,title:'Kotoba Studio · Galgame 制作工作台',backgroundColor:'#f5f5f0',show:!selfTest,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('file://'))e.preventDefault()});win.webContents.session.setPermissionRequestHandler((_wc,_permission,cb)=>cb(false));
Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'文件',submenu:[{label:'工程管理',click:()=>send('projects')},{label:'新建工程',accelerator:'CmdOrCtrl+N',click:()=>send('new-library')},{label:'打开工程…',accelerator:'CmdOrCtrl+O',click:()=>send('open')},{type:'separator'},{label:'保存工程',accelerator:'CmdOrCtrl+S',click:()=>send('save')},{label:'工程另存为…',accelerator:'CmdOrCtrl+Shift+S',click:()=>send('save-as')},{label:'导出离线试玩…',click:()=>send('export-game')},{label:'打包 Windows EXE…',click:()=>send('package-game')},{type:'separator'},{role:'quit',label:'退出'}]},{label:'编辑',submenu:[{label:'撤销工程更改',click:()=>send('undo')},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{role:'selectAll',label:'全选'}]},{label:'试演',submenu:[{label:'从当前场景试演',accelerator:'F5',click:()=>send('play')},{label:'游戏存档 / 读取',click:()=>send('game-saves')},{label:'退出试演',accelerator:'Escape',click:()=>send('stop')}]},{label:'视图',submenu:[{role:'resetZoom',label:'实际大小'},{role:'zoomIn',label:'放大'},{role:'zoomOut',label:'缩小'},{role:'togglefullscreen',label:'全屏'}]},{label:'帮助',submenu:[{label:'使用指南',click:()=>send('help')}]}]));
if(selfTest){const fixture=path.join(dataDir,'media-fixtures');fs.mkdirSync(path.join(fixture,'表情'),{recursive:true});fs.writeFileSync(path.join(fixture,'表情','表情.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');fs.writeFileSync(path.join(fixture,'音轨.wav'),'RIFF');fs.writeFileSync(path.join(fixture,'说明.txt'),'skip');dialog.showSaveDialog=async()=>({canceled:false,filePath:path.join(dataDir,'bridge-test.kotoba.json')});dialog.showOpenDialog=async(_window,options)=>({canceled:false,filePaths:options.properties.includes('openDirectory')?[fixture]:options.properties.includes('multiSelections')?[path.join(fixture,'表情','表情.svg'),path.join(fixture,'音轨.wav')]:[path.join(dataDir,'bridge-test.kotoba.json')]})}
await win.loadFile(path.join(root,'dist','index.html'));if(selfTest && process.argv.includes('--performance-check')) {
  const source = process.argv[process.argv.indexOf('--performance-check')+1];
  const project = JSON.parse(fs.readFileSync(source,'utf8'));
  const result = await require('./performance-checks.cjs')(win.webContents,project);
  const version = require('../package.json').version;
  const directory = path.join(root,'artifacts');
  fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'performance-'+version+'.json'),JSON.stringify(result,null,2));
  app.exit(0);
  return;
}
if(selfTest){await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'feature-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'subtitle-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'strict-text-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'chapter-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'cg-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'novel-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'media-limit-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'effects-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'dialogue-background-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'scene-background-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'packaging-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'collection-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'portrait-placement-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'branches-effects-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'api-assistant-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'voice-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'menu-picker-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'multi-portrait-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'chapter-folder-checks.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'editor-interaction-checks.js'),'utf8'))}
if(selfTest){try{const results=await win.webContents.executeJavaScript(`(async()=>{const assert=(v,m)=>{if(!v)throw Error(m)};const log=[];assert(document.querySelector('.stage'),'编辑器启动');log.push('编辑器启动');const original=JSON.stringify(project);const s=scene();const count=s.blocks.length;addBlock('dialogue');assert(scene().blocks.length===count+1,'新增对白');block().text='桌面版测试台词';save();draw();assert(document.querySelector('.stage').textContent.includes('桌面版测试台词'),'预览更新');log.push('新增对白与即时预览');history.pop();project=JSON.parse(original);sceneId=project.scenes[0].id;selected=project.scenes[0].blocks[2].id;playing=true;playScene=sceneId;playIndex=0;ended=false;resolvePlayable();assert(playIndex===1,'背景执行');playIndex=4;const choice=project.scenes[0].blocks[4];assert(choice.type==='choice','分支存在');playScene=choice.options[0].target;playIndex=0;resolvePlayable();assert(project.scenes.find(s=>s.id===playScene).blocks[playIndex].text.includes('一封信'),'分支跳转');log.push('背景执行与分支跳转');playing=false;const portable=await portableProject();validateProject(portable);assert(portable.assets[0].data.startsWith('data:image/svg+xml;base64,'),'内置图片打包');log.push('工程导出与重新导入校验');let captured;const old=download;download=(name,text,type)=>{captured={name,text,type}};await exportGame();download=old;assert(captured?.text.includes('</script>'),'试玩脚本结束标签');const match=captured.text.match(/<script>([\\s\\S]*)<\\/script>/);assert(match,'试玩脚本存在');new Function(match[1]);log.push('离线试玩 HTML 语法');const saved=await window.desktop.autosave(JSON.stringify(portable));assert(saved.ok,'本机恢复文件');log.push('本机工程恢复写入');const disk=await window.desktop.save({name:'test.json',text:JSON.stringify(portable),kind:'project',saveAs:true});assert(disk.ok,'工程文件保存');const opened=await window.desktop.open();assert(opened&&JSON.parse(opened.text).title===project.title,'工程文件重新打开');await window.desktop.accept(opened.path);await window.desktopReset();log.push('原生保存与打开工程');project=JSON.parse(original);save();draw();const featureChecks=await runFeatureChecks();log.push(...featureChecks);return log})()`);results.push(...await require('./viewport-checks.cjs')(win,verificationDir));await require('./verification-screenshots.cjs')(win,verificationDir);fs.writeFileSync(path.join(verificationDir,'verification.json'),JSON.stringify({ok:true,checks:results},null,2));app.exit(0)}catch(e){fs.writeFileSync(path.join(verificationDir,'verification.json'),JSON.stringify({ok:false,error:e.stack},null,2));app.exit(1)}}
}).catch(e=>{fs.writeFileSync(path.join(dataDir,'startup-error.txt'),e.stack);app.exit(1)});
app.on('window-all-closed',()=>app.quit());
