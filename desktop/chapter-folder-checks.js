async function runChapterFolderChecks(){
  const original={project,sceneId,selected,view,mode,history};const assert=(ok,message)=>{if(!ok)throw Error(message)};
  try{
    project=KotobaCore.normalize({id:uid(),title:'章节文件夹验证',characters:[],assets:[],sceneFolders:[{id:'main',name:'主线'},{id:'child',name:'后篇',parentId:'main'}],scenes:Array.from({length:70},(_,i)=>({id:'s'+i,name:'第 '+i+' 章',folderId:i<50?'main':i<65?'child':'',blocks:[{id:'b'+i,type:'jump',target:'s69',text:'跳转'}]}))});
    sceneId='s0';selected='b0';view='script';mode='visual';playing=false;history=[];draw();
    $('[data-action="chapter-folder"][data-id="main"]').click();assert($('.chapter-list-scroll').querySelectorAll('.chapter-row').length===65,'章节父文件夹包含子分类');
    $('[data-action="chapter-folder"][data-id="__all__"]').click();let list=$('.chapter-list-scroll');assert(list.scrollHeight>list.clientHeight,'长章节目录可以独立滚动');
    list.scrollTop=450;list.dispatchEvent(new Event('scroll'));const top=list.scrollTop;assert(Number($('.chapter-scroll-track').getAttribute('aria-valuenow'))>0,'滚动状态条更新');
    list.querySelectorAll('[data-action="scene"]')[10].click();assert(Math.abs($('.chapter-list-scroll').scrollTop-top)<1,'切换章节保持目录位置');
    $('[data-action="chapter-folder"][data-id="__root__"]').click();assert($('.chapter-list-scroll').querySelectorAll('.chapter-row').length===5,'未分类章节筛选');
    $('[data-action="chapter-folder"][data-id="__all__"]').click();assert(Math.abs($('.chapter-list-scroll').scrollTop-top)<1,'返回分类恢复独立滚动位置');
    $('[data-action="chapter-new-folder"]').click();$('#dialogForm').elements.name.value='支线';$('#dialogForm').elements.parentId.value='';$('#dialogForm').requestSubmit();
    const created=project.sceneFolders.find(f=>f.name==='支线');assert(created,'新建章节文件夹');
    $('[data-action="chapter-folder"][data-id="__all__"]').click();$('[data-action="chapter-move-folder"][data-id="s0"]').click();$('#dialogForm').elements.folderId.value=created.id;$('#dialogForm').requestSubmit();
    assert(project.scenes[0].folderId===created.id&&project.scenes[0].blocks[0].target==='s69','分类移动保留章节顺序、正文和跳转');
    $(`[data-action="chapter-folder"][data-id="${created.id}"]`).click();$('[data-action="chapter-rename-folder"]').click();$('#dialogForm').elements.name.value='神社支线';$('#dialogForm').requestSubmit();
    assert(created.name==='神社支线','文件夹重命名');$('.sidebar [data-action="new-scene"].micro').click();$('#dialogForm').elements.name.value='支线新章';$('#dialogForm').requestSubmit();assert(scene().folderId===created.id&&scene().name==='支线新章','在当前文件夹新建章节');
    $('[data-action="chapter-delete-folder"]').click();$('#dialogForm').requestSubmit();assert(!project.sceneFolders.some(f=>f.id===created.id)&&project.scenes.some(s=>s.name==='支线新章'),'删除文件夹保留章节');
    undoContentChange();assert(project.sceneFolders.some(f=>f.id===created.id)&&scene().folderId===created.id,'删除文件夹可以完整撤销');validateProject(JSON.parse(JSON.stringify(project)));
    return ['章节文件夹新建、重命名、子分类筛选与移动','文件夹内新建章节，删除分类保留剧情、跳转与撤销','章节独立滚动、状态条和跨分类滚动位置保持'];
  }finally{if($('#modal').open)$('#modal').close();stopContentPlayback();({project,sceneId,selected,view,mode,history}=original);stageRenderer.reset();save();draw()}
}
