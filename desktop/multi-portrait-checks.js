async function runMultiPortraitChecks(){
  const original={project,sceneId,selected,view,mode,history,portraitFocusId};let frame;
  const assert=(ok,message)=>{if(!ok)throw Error(message)};
  try{
    const data='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="450"><rect width="160" height="450" fill="#7a9978"/></svg>');
    project=KotobaCore.normalize({id:uid(),title:'多人同屏验证',characters:[{id:'a',name:'小夏',color:'#456781',asset:'pic'},{id:'b',name:'阿岚',color:'#456781',asset:'pic'}],assets:[{id:'pic',name:'立绘.svg',type:'image',data}],scenes:[{id:'s',name:'会面',blocks:[{id:'line-a',type:'dialogue',speaker:'a',text:'你好'},{id:'line-b',type:'dialogue',speaker:'b',text:'又见面了'},{id:'n',type:'narration',text:'两人相视而笑'}]}]});
    sceneId='s';selected='line-a';view='script';mode='visual';playing=false;history=[];portraitFocusId='';stageRenderer.reset();draw();
    $('[data-action="stage-cast"]').click();const form=$('#dialogForm');form.elements.enabled.checked=true;form.elements['visible:a'].checked=true;form.elements['visible:b'].checked=true;form.querySelector('[data-cast-arrange]').click();form.requestSubmit();
    assert(scene().multiPortrait&&$('#stage').querySelectorAll('.stage-character').length===2,'应用两人同屏');
    const images=()=>[...$('#stage').querySelectorAll('.stage-character')];assert(images().map(i=>i.style.left).join(',')==='20%,80%','均匀排列');
    selected='line-b';draw();assert(images().length===2,'说话人切换保持其他角色');
    const focus=$('[data-portrait-focus]');focus.value='a';focus.dispatchEvent(new Event('change',{bubbles:true}));setPortraitPosition({scale:85});
    let state=currentPortraitState();assert(state.character.id==='a'&&KotobaCore.portraitPlacement(state.portrait,state.character).scale===85,'指定非说话角色调整大小');
    portraitDragMode=true;draw();const stage=$('#stage'),image=images().find(i=>i.dataset.characterId==='b'),rect=stage.getBoundingClientRect();
    image.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:33,clientX:rect.left+30,clientY:rect.top+30}));
    document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:33,clientX:rect.left+30-rect.width*.1,clientY:rect.top+30}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:33}));
    state=KotobaCore.stageAt(project,scene(),scene().blocks.findIndex(b=>b.id===selected));const at=id=>state.portraits.find(item=>item.character.id===id);
    assert(Math.abs(KotobaCore.portraitPlacement(at('b').portrait,at('b').character).x-70)<.01&&KotobaCore.portraitPlacement(at('a').portrait,at('a').character).x===20,'拖动命中的角色，不移动其他人');
    portraitDragMode=false;openStageCastEditor();$('#dialogForm').elements['visible:a'].checked=false;$('#dialogForm').requestSubmit();
    assert(images().length===1&&images()[0].dataset.characterId==='b','仅隐藏指定角色');
    validateProject(JSON.parse(JSON.stringify(project)));const parsed=KotobaCore.parseText(KotobaCore.serializeText(project,scene()),project);assert(parsed.groups[0].multiPortrait,'文本往返保留多人模式');
    frame=document.createElement('iframe');frame.style.cssText='position:fixed;left:-2000px;width:900px;height:600px';const ready=new Promise(resolve=>frame.onload=resolve);frame.srcdoc=await buildOfflineGame();document.body.append(frame);await ready;
    const doc=frame.contentDocument;doc.querySelector('[data-title-action="start"]').click();assert(doc.querySelectorAll('.stage-character').length===2,'离线游戏开场两人同屏');
    doc.querySelector('#saves').click();doc.querySelector('[data-save="0"]').click();doc.querySelector('#closeSaves').click();doc.querySelector('#stage').click();assert(doc.querySelectorAll('.stage-character').length===1,'离线游戏单人离场');
    doc.querySelector('#saves').click();doc.querySelector('[data-load="0"]').click();assert(doc.querySelectorAll('.stage-character').length===2,'读取存档恢复同屏角色');
    return ['多人出场、均匀排列与对话保持','分别选择、缩放和直接拖动角色；单人离场','多人设置保存、文本往返与导出游戏读档恢复'];
  }finally{frame?.remove();if($('#modal').open)$('#modal').close();stopContentPlayback();portraitDragMode=false;portraitDrag=null;({project,sceneId,selected,view,mode,history,portraitFocusId}=original);stageRenderer.reset();save();draw()}
}

async function runCastRefinementChecks(){
  const original={project,sceneId,selected,view,mode,history,portraitFocusId};let frame;
  const assert=(ok,message)=>{if(!ok)throw Error(message)},tick=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    const data='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="450"><rect width="160" height="450" fill="#7a9978"/></svg>');
    project=KotobaCore.normalize({id:uid(),title:'分类、细调和位移验证',assetFolders:[],characterFolders:[{id:'main',name:'主要角色'},{id:'sub',name:'神社',parentId:'main'},{id:'guest',name:'访客'}],characters:[{id:'a',name:'小夏',folderId:'sub',color:'#456781',asset:'pic'},{id:'b',name:'阿岚',folderId:'guest',color:'#456781',asset:'pic'},{id:'c',name:'未分类角色',color:'#456781',asset:'pic'}],assets:[{id:'pic',name:'立绘.svg',type:'image',data}],scenes:[{id:'s',name:'会面',multiPortrait:true,blocks:[{id:'initial-a',type:'portrait',speaker:'a',position:'custom',portraitLayout:{x:20,y:100,scale:100}},{id:'initial-b',type:'portrait',speaker:'b',position:'custom',portraitLayout:{x:80,y:100,scale:100}},{id:'before',type:'narration',text:'移动之前'},{id:'after',type:'narration',text:'移动之后'}]}]});
    sceneId='s';selected='after';view='script';mode='visual';playing=false;history=[];portraitFocusId='';stageRenderer.reset();draw();
    const snapshot=JSON.stringify(project);openStageCastEditor();let form=$('#dialogForm');
    const rows=()=>[...form.querySelectorAll('[data-cast-character]')],shown=()=>rows().filter(row=>!row.hidden),row=id=>rows().find(row=>row.dataset.castCharacter===id),input=(id,key)=>form.elements[key+':'+id];
    const folder=form.querySelector('[data-cast-folder]');folder.value='main';folder.dispatchEvent(new Event('change'));
    assert(shown().length===1&&shown()[0].dataset.castCharacter==='a','角色分类包括子文件夹');
    form.querySelector('[data-cast-step]').value='0.1';row('a').querySelector('[data-cast-nudge="x"][data-delta="1"]').click();
    assert(Number(input('a','x').value)===20.1,'0.1% 精细微调');
    folder.value='guest';folder.dispatchEvent(new Event('change'));const range=row('b').querySelector('[data-cast-range="x"]');range.value=72.5;range.dispatchEvent(new Event('input',{bubbles:true}));
    assert(Number(input('a','x').value)===20.1&&Number(input('b','x').value)===72.5,'分类切换保留所有草稿且滑杆同步');
    const search=form.querySelector('[data-cast-search]');search.value='不存在';search.dispatchEvent(new Event('input'));assert(shown().length===0,'分类内搜索');search.value='';search.dispatchEvent(new Event('input'));
    folder.value='__root__';folder.dispatchEvent(new Event('change'));assert(shown()[0].dataset.castCharacter==='c','未分类筛选');
    folder.value='__all__';folder.dispatchEvent(new Event('change'));const only=form.querySelector('[data-cast-selected]');only.checked=true;only.dispatchEvent(new Event('change'));assert(shown().length===2,'只看已勾选角色');
    const stage=form.querySelector('.cast-preview-stage'),image=stage.querySelector('[data-character-id="b"]'),rect=stage.getBoundingClientRect();
    assert(getComputedStyle(image).pointerEvents==='auto'&&rect.width>0,'窗口预览可操作');
    image.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:44,clientX:rect.left+20,clientY:rect.top+20}));
    stage.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:44,clientX:rect.left+20-rect.width*.1,clientY:rect.top+20}));stage.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:44}));
    assert(Math.abs(Number(input('b','x').value)-62.5)<.01&&Number(input('a','x').value)===20.1,'预览拖动只更新命中角色');
    assert(JSON.stringify(project)===snapshot,'预览与筛选不修改正式工程');$('#modal').close();await tick(20);assert(JSON.stringify(project)===snapshot,'取消保留原工程');
    openStageCastEditor();form=$('#dialogForm');input('a','x').value=65.5;input('a','moveDuration').value=160;input('a','moveEasing').value='ease-out';form.querySelector('[data-cast-preview-motion]').click();
    const motionImage=form.querySelector('.cast-preview-stage [data-character-id="a"]');assert(motionImage.getAnimations().some(a=>a.effect.getKeyframes().some(k=>k.left==='20%')&&a.effect.getTiming().duration===160),'位移预览从原位置平滑移动');
    form.requestSubmit();await tick(20);
    const control=scene().blocks.find(b=>b.type==='portrait'&&b.placementFor==='after'&&b.speaker==='a');assert(control.moveDuration===160&&control.moveEasing==='ease-out','保存角色位移参数');
    selected='before';stageRenderer.reset();draw();selected='after';draw();
    assert($('#stage [data-character-id="a"]').getAnimations().some(a=>a.effect.getKeyframes().some(k=>k.left==='65.5%')),'编辑器播放位移');
    assert(!$('#stage [data-character-id="b"]').getAnimations().length,'未移动角色没有位移动画');
    await tick(210);assert(!stageRenderer.busy(),'位移结束解除继续锁定');portraitDragMode=true;portraitFocusId='a';setPortraitPosition({x:66.5});assert(!$('#stage [data-character-id="a"]').getAnimations().length,'拖动模式细调不回放剧情位移');setPortraitPosition({x:65.5});portraitDragMode=false;draw();
    const html=await buildOfflineGame();frame=document.createElement('iframe');frame.style.cssText='position:fixed;left:-2000px;width:900px;height:600px';const ready=new Promise(resolve=>frame.onload=resolve);frame.srcdoc=html;document.body.append(frame);await ready;
    const doc=frame.contentDocument;doc.querySelector('[data-title-action="start"]').click();doc.querySelector('#stage').click();
    assert(doc.querySelector('[data-character-id="a"]').getAnimations().some(a=>a.effect.getTiming().easing==='ease-out'),'导出游戏执行相同位移');
    doc.querySelector('#saves').click();doc.querySelector('[data-save="0"]').click();doc.querySelector('[data-load="0"]').click();
    assert(doc.querySelector('[data-character-id="a"]').style.left==='65.5%'&&!doc.querySelector('[data-character-id="a"]').getAnimations().some(a=>a.effect.getKeyframes().some(k=>k.left!==undefined)),'读档恢复最终位置，不重复播放位移');
    return ['多人窗口角色文件夹、子分类、搜索与跨分类草稿保留','多人预览拖动、滑杆与 0.1% 微调；取消不写入工程','逐角色位移动画、缓动、预览与导出游戏读档恢复'];
  }finally{frame?.remove();if($('#modal').open)$('#modal').close();await tick(20);stopContentPlayback();portraitDragMode=false;portraitDrag=null;({project,sceneId,selected,view,mode,history,portraitFocusId}=original);stageRenderer.reset();save();draw()}
}
