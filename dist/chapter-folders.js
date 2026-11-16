const chapterFolderViews=new Map(),chapterScrollViews=new Map();
let chapterDirectoryObserver=null;
function chapterFolderView(){
  KotobaLibrary.normalize(project);
  let id=chapterFolderViews.get(project.id)||'__all__';
  if(!['__all__','__root__'].includes(id)&&!project.sceneFolders.some(f=>f.id===id))id='__all__';
  chapterFolderViews.set(project.id,id);return id;
}
function chapterFolderScenes(id=chapterFolderView()){
  if(id==='__all__')return project.scenes;
  if(id==='__root__')return project.scenes.filter(s=>!s.folderId);
  const descendants=KotobaLibrary.descendants(project,'scenes',id);return project.scenes.filter(s=>descendants.has(s.folderId));
}
function rememberChapterDirectory(){
  for(const element of document.querySelectorAll('[data-chapter-scroll-key]'))chapterScrollViews.set(element.dataset.chapterScrollKey,element.scrollTop);
  chapterDirectoryObserver?.disconnect();
}
function enhanceChapterDirectory(){
  const sidebar=$('.sidebar'),caption=sidebar?.querySelector('.section-caption');if(!caption)return;
  const folder=chapterFolderView(),chosen=project.sceneFolders.find(f=>f.id===folder),visible=new Set(chapterFolderScenes(folder).map(s=>s.id)),originalRows=[...sidebar.querySelectorAll('.chapter-row')];
  const directory=document.createElement('div');directory.className='chapter-directory';directory.dataset.scene=sceneId;
  const folders=project.sceneFolders;
  const folderRow=(id,name,count,depth=0)=>`<button type="button" class="chapter-folder-row ${id===folder?'active':''}" style="padding-left:${12+depth*10}px" data-action="chapter-folder" data-id="${esc(id)}"><span>${esc(name)}</span><small>${count}</small></button>`;
  const children=(id='',depth=0)=>folders.filter(f=>(f.parentId||'')===id).map(f=>folderRow(f.id,'▸ '+f.name,chapterFolderScenes(f.id).length,depth)+children(f.id,depth+1)).join('');
  directory.innerHTML=`<div class="chapter-folder-tools"><button type="button" data-action="chapter-new-folder">＋ 文件夹</button>${chosen?'<button type="button" data-action="chapter-rename-folder">改名</button><button type="button" data-action="chapter-delete-folder">删除</button>':''}</div>
    <div class="chapter-folder-tree" aria-label="章节分类文件夹">${folderRow('__all__','全部章节',project.scenes.length)}${folderRow('__root__','未分类',project.scenes.filter(s=>!s.folderId).length)}${children()}</div>
    <div class="chapter-list-caption">${esc(chosen?.name||(folder==='__all__'?'全部章节':'未分类'))} · ${visible.size} 章</div>
    <div class="chapter-list-scroll" aria-label="场景目录"></div>
    <div class="chapter-scroll-status"><span data-chapter-scroll-label></span><div class="chapter-scroll-track" role="progressbar" aria-label="章节目录滚动进度" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>`;
  caption.insertAdjacentElement('afterend',directory);
  const list=directory.querySelector('.chapter-list-scroll');
  for(const row of originalRows){
    if(!visible.has(row.querySelector('[data-action="scene"]')?.dataset.id)){row.remove();continue}
    const id=row.querySelector('[data-action="scene"]').dataset.id;
    row.querySelector('.chapter-quick-actions')?.insertAdjacentHTML('afterbegin',`<button type="button" data-action="chapter-move-folder" data-id="${esc(id)}" title="移动章节到文件夹" aria-label="移动章节到文件夹">移</button>`);
    list.append(row);
  }
  if(!visible.size)list.innerHTML='<p class="chapter-directory-empty">此文件夹还没有章节。点击“新建场景”在这里创建。</p>';
  for(const [element,key]of [[list,JSON.stringify([project.id,folder,'chapters'])],[directory.querySelector('.chapter-folder-tree'),JSON.stringify([project.id,'chapter-folders'])]]){
    element.dataset.chapterScrollKey=key;element.scrollTop=chapterScrollViews.get(key)||0;
  }
  function updateProgress(){const max=list.scrollHeight-list.clientHeight,percentage=max>1?Math.round(list.scrollTop/max*100):100;directory.querySelector('[data-chapter-scroll-label]').textContent=max>1?`${visible.size} 章 · 已浏览 ${percentage}%`:`${visible.size} 章 · 已全部显示`;const track=directory.querySelector('.chapter-scroll-track');track.setAttribute('aria-valuenow',percentage);track.querySelector('i').style.width=percentage+'%'}
  list.addEventListener('scroll',updateProgress,{passive:true});chapterDirectoryObserver=new ResizeObserver(updateProgress);chapterDirectoryObserver.observe(list);updateProgress();
  const newScene=sidebar.querySelector('[data-action="new-scene"].micro');if(newScene)newScene.textContent=chosen?'＋ 在此文件夹新建场景':'＋ 新建场景';
}
function editChapterFolder(rename=false){
  const folder=chapterFolderView(),current=project.sceneFolders.find(f=>f.id===folder);
  if(rename&&!current)return;
  dialog(rename?'重命名章节文件夹':'新建章节文件夹',`<div class="field"><label>名称</label><input name="name" required maxlength="80" value="${esc(rename?current.name:'新文件夹')}"></div>${rename?'':`<div class="field"><label>上级文件夹</label><select name="parentId">${folderOptions('scenes',current?.id||'').replace('未分类','顶层')}</select></div>`}`,'保存',form=>{
    const name=form.get('name').trim(),parentId=rename?current.parentId||'':form.get('parentId');
    if(!name||project.sceneFolders.some(f=>(!rename||f.id!==current.id)&&f.name===name&&(f.parentId||'')===parentId)){notify('名称为空，或同一位置已有同名文件夹');return}
    change(()=>{if(rename)current.name=name;else chapterFolderViews.set(project.id,KotobaLibrary.createFolder(project,'scenes',name,parentId).id)});
  });
}
const chapterFoldersDraw=draw;
draw=function(){
  const previous=$('.chapter-directory');
  if(previous&&previous.dataset.scene!==sceneId&&chapterFolderViews.get(project.id)&&!chapterFolderScenes().some(s=>s.id===sceneId))chapterFolderViews.set(project.id,scene()?.folderId||'__root__');
  rememberChapterDirectory();chapterFoldersDraw();enhanceChapterDirectory();
};
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]'),action=button?.dataset.action;
  if(!['chapter-folder','chapter-new-folder','chapter-rename-folder','chapter-delete-folder','chapter-move-folder','new-scene'].includes(action))return;
  const folder=chapterFolderView(),current=project.sceneFolders.find(f=>f.id===folder);
  if(action==='new-scene'&&!current)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(action==='chapter-folder'){chapterFolderViews.set(project.id,button.dataset.id);draw()}
  if(action==='chapter-new-folder'||action==='chapter-rename-folder')editChapterFolder(action==='chapter-rename-folder');
  if(action==='chapter-delete-folder'&&current)dialog('删除章节文件夹',`<p>删除「${esc(current.name)}」文件夹。章节和子文件夹移到上一级，剧情与跳转保持，可撤销恢复。</p>`,'删除文件夹',()=>change(()=>{KotobaLibrary.removeFolder(project,'scenes',current.id);chapterFolderViews.set(project.id,current.parentId||'__root__')}));
  if(action==='chapter-move-folder'){
    const target=project.scenes.find(s=>s.id===button.dataset.id);if(!target)return;
    dialog('移动章节到文件夹',`<p>${esc(target.name)}</p><div class="field"><label>目标文件夹</label><select name="folderId">${folderOptions('scenes',target.folderId)}</select></div>`,'移动',form=>change(()=>KotobaLibrary.moveItems(project,'scenes',[target.id],form.get('folderId'))));
  }
  if(action==='new-scene')textDialog('新建场景','新章节',name=>change(()=>{const s={id:uid(),name,folderId:current.id,blocks:[]};project.scenes.push(s);sceneId=s.id;selected=null;view='script';mode='visual'}));
},true);
draw();
