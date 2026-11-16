async function runEditorInteractionChecks(){
  const original={project,sceneId,selected,view,mode,history,editorSplitPercent},oldSplit=localStorage.getItem('kotoba-editor-split-v1');let frame;
  const assert=(ok,message)=>{if(!ok)throw Error(message)},tick=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    project=KotobaCore.normalize({id:uid(),title:'编辑交互检查',characters:[],assets:[],subtitle:{x:50,y:82,width:90,fontSize:24,align:'left'},scenes:[{id:'s',name:'长章节',blocks:[...Array.from({length:70},(_,i)=>({id:'n'+i,type:'narration',text:'旁白 '+i})),{id:'choice',type:'choice',text:'分支',options:[{text:'后篇',target:'t'},{text:'结束',target:''}]}]},{id:'t',name:'后篇',blocks:[{id:'other',type:'narration',text:'另一章的旁白'}]}]});
    sceneId='s';selected='n0';view='script';mode='visual';playing=false;history=[];stageRenderer.reset();draw();
    const order=()=>scene().blocks.map(b=>b.id).join(','),initial=order(),branch=JSON.stringify(scene().blocks.at(-1));
    let list=$('.script-panel .blocks'),handle=list.querySelector('[data-block-drag="n0"]'),target=list.querySelector('[data-action="select"][data-id="n2"]'),rect=target.getBoundingClientRect(),transfer=new DataTransfer();
    handle.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:rect.top}));
    target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:rect.bottom-2}));assert(target.classList.contains('block-drop-after')||list.querySelector('.block-drop-before'),'拖动显示插入位置');
    target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:rect.bottom-2}));
    assert(scene().blocks[2].id==='n0'&&selected==='n0'&&history.length===1,'拖动排序一次写入并保持选中块');assert(JSON.stringify(scene().blocks.at(-1))===branch,'排序保留分支及跳转目标');undoContentChange();assert(order()===initial,'一次撤销恢复顺序');
    list=$('.script-panel .blocks');handle=list.querySelector('[data-block-drag="n1"]');transfer=new DataTransfer();const unchanged=order(),historyCount=history.length;
    handle.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:list.getBoundingClientRect().bottom-3}));list.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:list.getBoundingClientRect().bottom-3}));await tick(130);assert(list.scrollTop>0,'靠近列表边缘自动滚动');handle.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:transfer}));assert(order()===unchanged&&history.length===historyCount,'取消拖动不改变剧情或撤销历史');list.scrollTop=0;

    let grid=$('.editor-grid'),splitter=grid.querySelector('.editor-splitter'),geometry=editorSplitGeometry(grid),widthBefore=grid.querySelector('.script-panel').getBoundingClientRect().width;const historyBefore=history.length;
    splitter.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:71,clientX:geometry.start+geometry.available*.44}));document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:71,clientX:geometry.start+geometry.available*.6}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:71}));
    const widthAfter=grid.querySelector('.script-panel').getBoundingClientRect().width;assert(widthAfter>widthBefore+20&&history.length===historyBefore,'拖动分隔条改变两栏宽度，不写工程历史');draw();grid=$('.editor-grid');assert(Math.abs(grid.querySelector('.script-panel').getBoundingClientRect().width-widthAfter)<1,'重新绘制保留两栏宽度');
    grid.querySelector('.editor-splitter').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'ArrowLeft'}));assert(Math.abs(editorSplitPercent-59)<.1&&Number(localStorage.getItem('kotoba-editor-split-v1'))===editorSplitPercent,'键盘调整与本机记忆');grid.querySelector('.editor-splitter').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));assert(editorSplitPercent===44,'双击恢复默认两栏比例');

    selected='n0';draw();let text=$('[data-edit="text"]');const globalLayout=JSON.stringify(project.subtitle),neighbor=scene().blocks.find(b=>b.id==='n1').text,other=project.scenes[1].blocks[0].text;
    const beforeTextHistory=history.length;text.value='只修改这一段旁白';text.dispatchEvent(new Event('input',{bubbles:true}));text.dispatchEvent(new Event('change',{bubbles:true}));assert(history.length===beforeTextHistory+1,'旁白编辑失焦不重复记录撤销');
    assert(block().text==='只修改这一段旁白'&&scene().blocks.find(b=>b.id==='n1').text===neighbor&&project.scenes[1].blocks[0].text===other,'修改旁白正文不影响同章和其他章旁白');
    const x=$('[data-subtitle="x"]');assert(x.dataset.scope==='block','属性面板默认修改当前句');x.value=35;x.dispatchEvent(new Event('change',{bubbles:true}));assert(block().subtitle.x===35&&!scene().blocks.find(b=>b.id==='n1').subtitle&&JSON.stringify(project.subtitle)===globalLayout,'本句布局不影响其他旁白和全局');
    $('[data-action="subtitle-preset"][data-id="middle"]').click();assert(block().subtitle.y===50&&project.subtitle.y===82,'字幕预设也只作用当前句');
    $('[data-action="duplicate"]').click();const copiedId=selected;text=$('[data-edit="text"]');text.value='复制后的独立旁白';text.dispatchEvent(new Event('input',{bubbles:true}));assert(copiedId!=='n0'&&scene().blocks.find(b=>b.id==='n0').text==='只修改这一段旁白','复制旁白后也可独立修改');
    validateProject(JSON.parse(JSON.stringify(project)));

    const html=await buildOfflineGame();frame=document.createElement('iframe');frame.style.cssText='position:fixed;left:-10000px;width:900px;height:430px';const ready=new Promise(resolve=>frame.onload=resolve);frame.srcdoc=html;document.body.append(frame);await ready;const doc=frame.contentDocument;
    const saveKey='kotoba-progress-v2-'+project.id,priorSave=frame.contentWindow.localStorage.getItem(saveKey);
    doc.querySelector('[data-title-action="load"]').click();await tick(30);
    const panel=doc.querySelector('#gameSavePanel'),inside=button=>{const r=button.getBoundingClientRect(),p=panel.getBoundingClientRect();return r.width>0&&r.top>=p.top&&r.bottom<=p.bottom&&doc.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===button};
    assert(inside(doc.querySelector('#cancelSaves'))&&inside(doc.querySelector('#closeSaves')),'低窗口下顶部取消与底部返回均可见');const slots=doc.querySelector('.game-save-slots');slots.scrollTop=slots.scrollHeight;assert(inside(doc.querySelector('#cancelSaves'))&&inside(doc.querySelector('#closeSaves')),'滚动存档列表不遮挡取消');
    doc.querySelector('#cancelSaves').click();assert(panel.hidden&&!doc.querySelector('#gameTitleScreen').hidden,'从标题读取后取消返回标题');assert(frame.contentWindow.localStorage.getItem(saveKey)===priorSave,'取消不写存档');
    doc.querySelector('[data-title-action="start"]').click();const line=doc.querySelector('.dialogue p').textContent;doc.querySelector('#saves').click();doc.querySelector('#closeSaves').click();assert(panel.hidden&&doc.querySelector('.dialogue p').textContent===line&&!doc.querySelector('#stage').hidden,'游戏中取消回到原剧情');
    doc.querySelector('#saves').click();doc.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));assert(panel.hidden,'Esc 取消返回');
    doc.querySelector('#gameTitleButton').click();doc.querySelector('[data-title-action="settings"]').click();doc.querySelector('#saves').click();doc.querySelector('#cancelSaves').click();assert(!doc.querySelector('#gameSettingsPanel').hidden,'从设置打开存读档后取消回到设置');
    return ['剧情块拖动排序、插入提示、边缘滚动与一次撤销','两栏宽度拖动、键盘调整与本机记忆','旁白正文、复制与单句字幕布局互不影响','成品存读档固定取消与返回，标题、游戏、设置及 Esc 返回'];
  }finally{clearBlockOrderDrag();frame?.remove();if($('#modal').open)$('#modal').close();stopContentPlayback();({project,sceneId,selected,view,mode,history,editorSplitPercent}=original);if(oldSplit===null)localStorage.removeItem('kotoba-editor-split-v1');else localStorage.setItem('kotoba-editor-split-v1',oldSplit);stageRenderer.reset();save();draw()}
}
