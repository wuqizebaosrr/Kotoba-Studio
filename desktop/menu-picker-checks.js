async function runMenuPickerChecks() {
  const original = {project,sceneId,selected,view,mode,history};
  const assert = (ok, message) => { if(!ok)throw Error(message); };
  const image = color => 'data:image/svg+xml;base64,'+btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="${color}"/></svg>`);
  let frame;
  try {
    project=KotobaCore.normalize({id:uid(),title:'菜单与图片分类',author:'测试作者',characters:[{id:'hero',name:'阿岚',color:'#477b74',asset:'portrait-a'},{id:'guest',name:'小夏',color:'#588366',asset:''}],
      assetFolders:[{id:'portraits',name:'立绘',parentId:''},{id:'scenes',name:'背景',parentId:''},{id:'night',name:'夜景',parentId:'scenes'}],
      assets:[
        {id:'portrait-a',name:'普通.png',folderId:'portraits',type:'image',data:image('#547d68')},
        {id:'portrait-b',name:'微笑.png',folderId:'portraits',type:'image',data:image('#d2ab84')},
        {id:'bg-a',name:'昼景.png',folderId:'scenes',type:'image',data:image('#cbd9c4')},
        {id:'bg-b',name:'山中夜景.png',folderId:'night',type:'image',data:image('#263951')}
      ],scenes:[{id:'s',name:'序章',blocks:[{id:'bg',type:'background',asset:'bg-a'},{id:'line',type:'dialogue',speaker:'hero',text:'第一句'},{id:'n',type:'narration',text:'第二句'}]}]});
    sceneId='s';selected='line';view='people';mode='visual';history=[];playing=false;draw();
    $('[data-action="edit-character"]').click();
    let inline=$('#dialogForm [data-image-folder-filter]');inline.value='scenes';inline.dispatchEvent(new Event('change'));
    assert($('#dialogForm').elements.asset.value==='portrait-a','更换图片分类保留原有绑定');
    assert(![...$('#dialogForm').elements.asset.options].some(option=>option.value==='portrait-b'),'下拉选图按文件夹过滤');
    $('#dialogForm .image-chooser-button').click();
    let chooser=$('.image-chooser-dialog[open]');
    let folder=chooser.querySelector('[data-image-folder]');folder.value='portraits';folder.dispatchEvent(new Event('change'));
    const search=chooser.querySelector('[data-image-search]');search.value='微笑';search.dispatchEvent(new Event('input'));
    assert(chooser.querySelectorAll('[data-image-id]').length===1,'立绘按分类和名称筛选');
    chooser.querySelector('[data-image-id="portrait-b"]').click();
    assert($('#dialogForm').elements.asset.value==='portrait-b'&&$('#modal').open,'选择立绘保留角色设置窗口');
    $('#dialogForm').requestSubmit();assert(character('hero').asset==='portrait-b','保存立绘选择');

    editVariant('hero','');$('#dialogForm .image-chooser-button').click();chooser=$('.image-chooser-dialog[open]');
    folder=chooser.querySelector('[data-image-folder]');folder.value='portraits';folder.dispatchEvent(new Event('change'));
    chooser.querySelector('[data-image-id="portrait-a"]').click();$('#dialogForm').requestSubmit();
    assert(character('hero').variants.some(v=>v.asset==='portrait-a'),'角色差分也能按文件夹选择图片');
    await new Promise(resolve=>setTimeout(resolve,20));if($('#modal').open)$('#modal').close();
    $('[data-action="pin-character"][data-id="guest"]').click();
    assert($('.character-card[data-id]').dataset.id==='guest'&&character('guest').pinned,'置顶角色排在最前');
    assert(JSON.parse(JSON.stringify(project)).characters.find(c=>c.id==='guest').pinned===true,'置顶状态随工程保存');
    $('[data-action="pin-character"][data-id="guest"]').click();
    assert($('.character-card[data-id]').dataset.id==='hero'&&!character('guest').pinned,'取消置顶恢复原顺序');
    undoContentChange();assert($('.character-card[data-id]').dataset.id==='guest','置顶操作可以撤销');

    view='script';draw();
    const variantSelect=$('[data-edit="variant"]');assert(variantSelect?.parentElement.querySelector('[data-image-folder-filter]'),'立绘属性也可直接按素材文件夹筛选');
    variantSelect.parentElement.querySelector('.image-chooser-button').click();chooser=$('.image-chooser-dialog[open]');
    const variant=character('hero').variants[0];chooser.querySelector(`[data-image-id="${variant.id}"]`).click();assert(block().variant===variant.id,'立绘缩略图选择绑定差分而非素材 ID');
    openSceneBackground();inline=$('#dialogForm [data-image-folder-filter]');inline.value='portraits';inline.dispatchEvent(new Event('change'));assert($('#dialogForm').elements.asset.value==='bg-a','背景筛选不清除当前图片');$('#dialogForm .image-chooser-button').click();chooser=$('.image-chooser-dialog[open]');
    folder=chooser.querySelector('[data-image-folder]');folder.value='scenes';folder.dispatchEvent(new Event('change'));
    assert(chooser.querySelectorAll('[data-image-id]').length===2,'背景分类包含子文件夹');
    chooser.querySelector('[data-image-id="bg-b"]').click();
    assert($('#dialogForm').elements.asset.value==='bg-b','背景选择正确');$('#dialogForm').requestSubmit();

    openGameMenuEditor();$('#dialogForm').elements.title.value='图书室约定';$('#dialogForm').elements.subtitle.value='标题菜单测试';
    $('#dialogForm').elements.background.value='bg-b';$('#dialogForm').requestSubmit();
    assert(project.menu.title==='图书室约定'&&project.menu.background==='bg-b','菜单设置随工程保存');
    validateProject(JSON.parse(JSON.stringify(project)));
    const html=await buildOfflineGame();frame=document.createElement('iframe');frame.style.cssText='position:fixed;left:-2000px;width:900px;height:600px';
    const ready=new Promise((resolve,reject)=>{frame.onload=resolve;setTimeout(()=>reject(Error('标题菜单加载超时')),8000)});
    frame.srcdoc=html;document.body.append(frame);await ready;
    const doc=frame.contentDocument;
    assert(doc.querySelector('#gameTitleScreen h1').textContent==='图书室约定'&&doc.querySelector('#stage').hidden,'启动显示标题而不自动推进');
    assert(doc.querySelector('[data-title-action="continue"]').disabled,'没有存档时禁用继续');
    doc.querySelector('[data-title-action="load"]').click();
    assert(doc.querySelector('[data-save="0"]').disabled,'标题页读取菜单不能保存未开始的进度');doc.querySelector('#closeSaves').click();
    doc.querySelector('[data-title-action="settings"]').click();
    const volume=doc.querySelector('[data-game-volume="voice"]');volume.value=25;volume.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));volume.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));
    assert(doc.querySelector('#gameSettingsStatus').textContent.includes('已保存'),'游戏音量设置保存');doc.querySelector('#closeSettings').click();
    doc.querySelector('[data-title-action="start"]').click();
    assert(!doc.querySelector('#stage').hidden&&doc.querySelector('.dialogue p').textContent==='第一句','开始游戏进入剧情');
    doc.querySelector('#saves').click();doc.querySelector('[data-save="0"]').click();doc.querySelector('#closeSaves').click();
    doc.querySelector('#stage').click();doc.querySelector('#gameTitleButton').click();
    assert(!doc.querySelector('[data-title-action="continue"]').disabled,'有有效存档时启用继续');
    doc.querySelector('[data-title-action="continue"]').click();
    assert(doc.querySelector('.dialogue p').textContent==='第一句'&&doc.querySelector('#gameTitleScreen').hidden,'继续恢复最近存档');
    return ['主立绘、差分与背景的文件夹、子目录、搜索和缩略图选择','场景与立绘下拉分类筛选保留原绑定，立绘属性支持差分缩略图','角色置顶、取消置顶、保存与撤销','标题菜单配置、开始游戏、读取与最近存档继续','标题菜单音量设置和游戏返回标题'];
  } finally {
    frame?.remove();document.querySelectorAll('.image-chooser-dialog').forEach(dialog=>dialog.remove());if($('#modal').open)$('#modal').close();
    stopContentPlayback();({project,sceneId,selected,view,mode,history}=original);save();draw();
  }
}
