async function runChapterChecks(){
  const assert=(ok,m)=>{if(!ok)throw Error(m)},original=JSON.stringify(project),previousScene=sceneId,previousSelected=selected,checks=[];
  project=KotobaCore.normalize({id:uid(),title:'章节删除检查',characters:[],assets:[],scenes:[{id:'chapter-one',name:'第一章',transition:'black',duration:900,subtitle:{y:50},blocks:[{id:'line1',type:'dialogue',speaker:'',text:'对白'},{id:'line2',type:'narration',text:'旁白'},{id:'bg',type:'background',asset:'',text:'背景'},{id:'music',type:'music',asset:'',text:'音乐'},{id:'portrait',type:'portrait',speaker:'',text:'立绘'},{id:'choice',type:'choice',text:'选择',options:[{text:'继续',target:'chapter-two'}]}]},{id:'chapter-two',name:'第二章',blocks:[{id:'jump',type:'jump',target:'chapter-one'},{id:'choice2',type:'choice',text:'返回',options:[{text:'回到第一章',target:'chapter-one'}]},{id:'n2',type:'narration',text:'其他章节的内容'}]},{id:'chapter-three',name:'第三章',blocks:[]}]});sceneId='chapter-one';selected='line1';view='script';playing=false;history=[];draw();
  assert(document.querySelectorAll('.chapter-quick-actions [data-action="clear-chapter"]').length===3,'每章有快捷清空');assert(document.querySelectorAll('.chapter-quick-actions [data-action="quick-delete-chapter"]').length===3,'每章有快捷删除');assert(document.querySelectorAll('.block-delete').length===6,'每个剧情块有删除按钮');
  document.querySelector('[data-action="quick-delete-block"][data-id="line2"]').click();assert(!scene().blocks.some(b=>b.id==='line2')&&selected==='line1','删除未选中旁白不误删对白');document.querySelector('[data-action="undo-content"]').click();assert(scene().blocks.some(b=>b.id==='line2'),'撤销旁白删除');selected='line1';draw();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}));assert(!scene().blocks.some(b=>b.id==='line1'),'Delete 删除选中对白');undoContentChange();assert(scene().blocks[0].id==='line1','恢复对白');checks.push('对白、旁白等剧情块快速删除与撤销');
  document.querySelector('.chapter-quick-actions [data-action="clear-chapter"][data-id="chapter-one"]').click();assert($('#modal').open,'批量清空显示范围确认');assert(scene().blocks.length===6,'确认前不改变内容');$('#modal').close();assert(scene().blocks.length===6,'取消清空不改变内容');clearChapter('chapter-one');$('#dialogForm').requestSubmit();assert(scene().blocks.length===0&&scene().name==='第一章'&&scene().transition==='black'&&scene().duration===900,'清空保留章节名称和设置');assert(project.scenes[1].blocks.length===3,'清空不影响其他章节');assert(!$('#stage .dialogue').textContent.includes('对白'),'清空后预览不残留');undoContentChange();assert(scene().blocks.length===6&&sceneId==='chapter-one','撤销恢复整章内容');checks.push('本章清空、取消、设置保留及完整恢复');
  requestChapterDelete('chapter-one');$('#dialogForm').requestSubmit();assert(project.scenes.length===2&&sceneId==='chapter-two','删除当前章节后选择相邻章节');assert(scene().blocks[0].target===''&&scene().blocks[1].options[0].target==='','清理跳转和分支引用');undoContentChange();assert(project.scenes.length===3&&sceneId==='chapter-one','撤销恢复章节及焦点');assert(project.scenes[1].blocks[0].target==='chapter-one'&&project.scenes[1].blocks[1].options[0].target==='chapter-one','撤销恢复跳转引用');
  project.scenes=[project.scenes[0]];sceneId='chapter-one';draw();requestChapterDelete('chapter-one');assert(project.scenes.length===1&&!$('#modal').open,'最后一章保留且可清空');checks.push('章节快速删除、跳转清理与撤销恢复');
  project=JSON.parse(original);sceneId=previousScene;selected=previousSelected;history=[];contentUndoHint=null;save();draw();return [...checks,...runEditorScrollChecks()];
}

function runEditorScrollChecks() {
  const original = {project, sceneId, selected, mode, view, history, assetFilter};
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const list = () => $('.script-panel .blocks');
  const gallery = () => $('.collection-layout');
  const click = selector => $(selector).click();
  const offset = (row, container) => row.getBoundingClientRect().top - container.getBoundingClientRect().top;
  const visible = (container, selector) => [...container.querySelectorAll(selector)]
    .find(row => offset(row, container) >= 0);
  try {
    const blocks = Array.from({length: 70}, (_, i) => ({id: `scroll-${i}`, type: 'narration', text: `第 ${i + 1} 段旁白`}));
    blocks[0] = {id: 'branch', type: 'choice', text: '选择', options: [{text: '下一章', target: 'scroll-b'}]};
    project = KotobaCore.normalize({id: uid(), title: '列表滚动回归检查', assets: [], characters: [], scenes: [
      {id: 'scroll-a', name: '长章节', blocks}, {id: 'scroll-b', name: '下一章', blocks: []}
    ]});
    sceneId = 'scroll-a'; selected = 'branch'; mode = 'visual'; view = 'script'; history = []; draw();
    list().scrollTop = 1800;
    const row = visible(list(), '.block');
    const rowId = row.dataset.id;
    const selector = `.block[data-id="${rowId}"]`;
    const originalOffset = offset(row, list());
    row.focus({preventScroll: true});
    const canFocus = document.activeElement === row;
    row.click();
    assert(selected === rowId, '点选深处剧情后保留选择');
    assert(!canFocus || document.activeElement === $(selector), '点选深处剧情后保留键盘焦点');
    assert(list().scrollTop > 1000 && Math.abs(offset($(selector), list()) - originalOffset) < 2, '点选保持原来的可见位置');
    deleteStoryBlock('scroll-1');
    assert(Math.abs(offset($(selector), list()) - originalOffset) < 2, '删除上方剧情保持当前视口');
    undoContentChange();
    assert(Math.abs(offset($(selector), list()) - originalOffset) < 2, '撤销删除保持当前视口');
    click('.scene[data-id="scroll-b"]');
    assert(list().scrollTop === 0, '新打开的章节从头开始');
    click('.scene[data-id="scroll-a"]');
    assert(selected === rowId && Math.abs(offset($(selector), list()) - originalOffset) < 2, '返回章节恢复之前的位置和选中项');
    click('[data-action="mode"][data-id="code"]');
    const draft = JSON.parse($('#codeEditor').value);
    draft[0].text = '更新跨章分支';
    $('#codeEditor').value = JSON.stringify(draft);
    click('[data-action="apply-code"]');
    assert(scene().blocks[0].text === '更新跨章分支' && scene().blocks[0].options[0].target === 'scroll-b', 'JSON 编辑接受存在的跨章分支');
    click('[data-action="mode"][data-id="visual"]');
    assert(selected === rowId && Math.abs(offset($(selector), list()) - originalOffset) < 2, 'JSON 编辑完成后保持剧情位置');
    click('[data-action="add-block"][data-id="narration"]');
    const inserted = $('.block.selected');
    assert(inserted.dataset.id !== rowId && offset(inserted, list()) >= 0 && offset(inserted, list()) < list().clientHeight, '插入后可见且不回到顶部');

    const folders = Array.from({length: 45}, (_, i) => ({id: `folder-${i}`, name: `分类 ${i}`, parentId: ''}));
    project.assetFolders = folders;
    project.assets = Array.from({length: 72}, (_, i) => ({id: `audio-${i}`, name: `音频 ${i}`, type: 'audio', data: 'data:audio/wav;base64,AAAA', folderId: folders[0].id}));
    view = 'assets'; assetFilter = 'all'; draw();
    gallery().scrollTop = 1250;
    $('.folder-sidebar').scrollTop = 330;
    const galleryOffset = row => row.getBoundingClientRect().top - editorViewportTop(gallery());
    const card = [...gallery().querySelectorAll('.asset-card')].find(row => galleryOffset(row) >= 0);
    assert($('.collection-controls').getBoundingClientRect().top >= gallery().getBoundingClientRect().top - 2, '深滚动时批量操作栏仍在视口');
    const cardSelector = `.asset-card[data-id="${card.dataset.id}"]`;
    const before = galleryOffset(card);
    const folderScroll = $('.folder-sidebar').scrollTop;
    card.querySelector('[data-asset-select]').click();
    assert(gallery().scrollTop > 1000 && Math.abs(galleryOffset($(cardSelector)) - before) < 2, '勾选素材保持当前卡片位置');
    assert(folderScroll > 0 && Math.abs($('.folder-sidebar').scrollTop - folderScroll) < 2, '素材操作保持文件夹栏位置');
    click('.folder-row[data-id="folder-0"]');
    assert(gallery().scrollTop === 0, '首次打开素材文件夹从顶部开始');
    click('.folder-row[data-id="__all__"]');
    assert(Math.abs(galleryOffset($(cardSelector)) - before) < 2, '返回素材目录恢复浏览位置');
    click('[data-action="filter"][data-id="audio"]');
    assert(gallery().scrollTop === 0, '新素材筛选从头开始');
    click('[data-action="filter"][data-id="all"]');
    assert(Math.abs(galleryOffset($(cardSelector)) - before) < 2, '返回素材筛选恢复浏览位置');
    return ['剧情列表点选、插入、删除、撤销及切章保持视口', 'JSON 编辑保留跨章分支和选中项', '素材勾选、文件夹切换与筛选保持各自滚动位置'];
  } finally {
    ({project, sceneId, selected, mode, view, history, assetFilter} = original);
    contentUndoHint = null;
    save();
    draw();
  }
}
