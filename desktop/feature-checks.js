async function runFeatureChecks(){
  const assert=(ok,message)=>{if(!ok)throw Error(message)},checks=[];
  const original=JSON.stringify(project);const oldView=view;
  const p=KotobaCore.normalize({id:uid(),title:'功能测试工程',author:'测试',characters:[{id:'test-c',name:'小夏',color:'#788765',asset:'',variants:[{id:'smile',name:'微笑',asset:'img-a'},{id:'sad',name:'难过',asset:'img-b'}],defaultVariant:'smile'}],assets:[{id:'img-a',name:'教室',type:'image',data:'data:image/png;base64,iVBORw0KGgo='},{id:'img-b',name:'走廊',type:'image',data:'data:image/png;base64,iVBORw0KGgo='}],scenes:[{id:'test-s',name:'初见',transition:'black',duration:100,blocks:[{id:'bg1',type:'background',asset:'img-a',transition:'fade',duration:100,text:'教室'},{id:'p1',type:'portrait',speaker:'test-c',variant:'sad',position:'left',visible:true},{id:'d1',type:'dialogue',speaker:'test-c',text:'你好。'},{id:'p2',type:'portrait',speaker:'test-c',visible:false},{id:'n1',type:'narration',text:'安静下来。'}]}]});
  let state=KotobaCore.stageAt(p,p.scenes[0],2);assert(state.portraitAsset.id==='img-b'&&state.portrait.position==='left','差分及位置');state=KotobaCore.stageAt(p,p.scenes[0],4);assert(!state.portraitAsset,'隐藏立绘');checks.push('差分切换、位置与隐藏');
  project=p;sceneId='test-s';selected='d1';playing=false;view='script';stageRenderer.reset();draw();assert($('.stage-character')?.classList.contains('sprite-left'),'立绘预览');assert($('#inspector select[data-edit="variant"]'),'差分编辑控件');
  selected='bg1';draw();project.scenes[0].blocks[0].transition='black';drawStage(true);assert($('.effect-black'),'切换动画样式');checks.push('场景切换动画与时长');
  const parsed=KotobaCore.parseText('# 第一幕\n[背景：教室 | 交叉淡化 | 800]\n[立绘：小夏 | 微笑 | 右侧]\n小夏[难过]：不要忘记。\n[隐藏：小夏]\n普通旁白\n陌生人：你好。\n[跳转：第二幕]\n# 第二幕\n结束。',p);assert(parsed.groups.length===2&&parsed.newCharacters.length===0&&parsed.unresolvedRoles.length===1,'多场景及未匹配角色识别');assert(parsed.groups[0].blocks[2].variant==='sad','文本差分识别');assert(parsed.groups[0].blocks[0].duration===800,'文本动画识别');assert(KotobaCore.parseText('[奇怪指令]',p).warnings.length===1,'未知命令提示');checks.push('文本转换：多场景、差分、动画与异常提示');
  validateProject(p);const created=await window.desktop.library('create',{project:p});let rows=await window.desktop.library('list');const row=rows.find(r=>r.path===created.path);assert(row,'新建工程库文件');let opened=await window.desktop.library('open',{id:row.id});assert(JSON.parse(opened.text).title===p.title,'打开工程');await window.desktop.accept(created.path);const removed=await window.desktop.library('delete',{id:row.id});assert(removed.active,'删除当前工程');rows=await window.desktop.library('list');assert(rows.find(r=>r.id===row.id).trashed,'工程回收站');await window.desktop.library('restore',{id:row.id});opened=await window.desktop.library('open',{id:row.id});assert(JSON.parse(opened.text).title===p.title,'恢复工程');checks.push('工程新建、删除、回收站恢复');history.push('should-clear');activateProject(p);assert(history.length===0&&!playing,'切换工程重置撤销与试演');checks.push('切换工程隔离撤销历史');
  await window.desktop.gameSlots('save',p.id,{slot:0,progress:{projectId:p.id,sceneId:'test-s',blockId:'d1',index:2,label:'初见',updatedAt:new Date().toISOString()}});const slots=await window.desktop.gameSlots('list',p.id);assert(slots[0].blockId==='d1','存档持久化');assert((await window.desktop.gameSlots('list','another-project')).length===0,'工程存档隔离');view='script';playing=false;await readGameSlot(0);assert(playing&&playScene==='test-s'&&playIndex===2,'读取存档到剧情位置');checks.push('游戏进度保存、读取与工程隔离');
  const html=await buildOfflineGame();const code=html.match(/<script>([\s\S]*)<\/script>/)?.[1];assert(code&&html.includes('gameSavePanel'),'离线试玩包含存读档');new Function(code);checks.push('包含差分动画与存读档的离线试玩导出');
  checks.push(...await runSubtitleChecks());checks.push(...await runStrictTextChecks());checks.push(...await runChapterChecks());checks.push(...await runCgChecks());checks.push(...await runNovelChecks());checks.push(...await runMediaLimitChecks());checks.push(...await runEffectsChecks());checks.push(...await runDialogueBackgroundChecks());checks.push(...await runSceneBackgroundChecks());checks.push(...await runPackagingChecks());checks.push(...await runCollectionChecks());checks.push(...await runPortraitPlacementChecks());checks.push(...await runBranchesEffectsChecks());checks.push(...await runApiAssistantChecks());checks.push(...await runWorkflowChecks());checks.push(...await runVoiceChecks());checks.push(...await runMenuPickerChecks());checks.push(...await runMultiPortraitChecks());checks.push(...await runCastRefinementChecks());checks.push(...await runChapterFolderChecks());checks.push(...await runEditorInteractionChecks());
  project=JSON.parse(original);sceneId=project.scenes[0].id;selected=project.scenes[0].blocks[0]?.id;view=oldView;playing=false;stageRenderer.reset();await window.desktopReset();save();draw();return checks;
}

async function runWorkflowChecks() {
  const original = {project, sceneId, selected, view, mode, history, lastPackageResult};
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const click = selector => $(selector).click();
  try {
    project = KotobaCore.normalize({id: uid(), title: '审查修复回归', assets: [],
      characters: [{id:'hero',name:'阿岚',color:'#477b74'}], scenes: [
        {id:'start',name:'起点',blocks:[
          {id:'portrait',type:'portrait',speaker:'hero',position:'right'},
          {id:'line',type:'dialogue',speaker:'hero',text:'选中块试演'},
          {id:'choice',type:'choice',text:'路线',options:[{text:'灯塔',target:'end'}]}
        ]},
        {id:'end',name:'尾声',blocks:[{id:'end-line',type:'narration',text:'完成'}]}
      ]});
    sceneId='start'; selected='line'; view='script'; mode='visual'; history=[]; playing=false; draw();
    const position = $('#inspector [data-edit="position"]');
    assert(position.value === '' && position.selectedOptions[0].textContent.includes('右侧'), '对白属性显示继承的右侧');
    click('[data-action="play-selected"]');
    assert(playing && playIndex === 1 && $('#stage .dialogue').textContent.includes('选中块试演'), '从选中剧情块试演');
    stopContentPlayback(); view='flow'; draw();
    click('[data-action="locate-flow-block"][data-id="choice"]');
    assert(view==='script' && selected==='choice', '从流程定位源分支');
    click('[data-action="more-block"]');
    const search = $('#insertSearch');
    search.value='跳转'; search.dispatchEvent(new Event('input', {bubbles:true}));
    assert($('#insertType').options.length===1 && $('#insertType').value==='jump', '搜索跳转剧情块');
    $('#modal').close();

    mode='code'; draw();
    $('#codeEditor').value='{无效 JSON';
    click('[data-action="apply-code"]');
    assert($('#jsonEditError').textContent.includes('行') && $('#codeEditor').selectionStart > 0, 'JSON 语法错误定位行列');
    const draft = structuredClone(scene().blocks);
    draft[2].options[0].target='missing';
    $('#codeEditor').value=JSON.stringify(draft,null,2);
    click('[data-action="apply-code"]');
    assert($('#jsonEditError').textContent.includes('灯塔') && $('#jsonEditError').textContent.includes('第 3 个剧情块'), 'JSON 分支错误显示选项与块号');
    assert(scene().blocks[2].options[0].target==='end','校验失败保持工程内容');

    mode='visual'; project.assets=null; await save(); project.assets=[]; draw();
    assert($('.save-warning') && $('[data-action="retry-autosave"]') && $('[data-action="save-project-copy"]'), '保存失败持久提示及恢复入口');
    await save();
    assert($('.save-indicator').textContent.includes('已自动保存至本机') && !$('.save-warning'), '重新保存后确认写入');

    lastPackageResult={title:'审查测试',scenes:2,blocks:4,assets:0,bytes:12345678,sourceHash:'abc12300000000000000',executable:'test.exe',format:'single'};
    packageResultDialog();
    assert($('[data-action="open-export-output"][data-id="executable"]') && $('[data-action="open-export-output"][data-id="report"]'), '打包完成页可运行并查看检查');
    $('#modal').close();
    showHtmlExportResult('test.html');
    assert($('[data-action="open-export-output"][data-id="preview"]') && typeof window.desktop.openExportOutput==='function', 'HTML 导出完成页打开入口');
    return ['立绘继承显示、选中块试演、流程定位和插入搜索','JSON 错误定位、保存失败与重试','打包与 HTML 导出完成入口'];
  } finally {
    if ($('#modal').open) $('#modal').close();
    ({project, sceneId, selected, view, mode, history, lastPackageResult}=original);
    stopContentPlayback(); await save(); draw();
  }
}
