function openStageCastEditor() {
  const s=scene(), current=block(), state=KotobaCore.stageAt(project,s,Math.max(0,s.blocks.findIndex(b=>b.id===selected)));
  dialog('多人同屏', `<p>本章启用后，切换说话人会保留其他角色。单独控制每个角色，从当前剧情起生效。</p>
    <label class="cast-enabled"><input name="enabled" type="checkbox" ${s.multiPortrait?'checked':''}> 本章启用多人同屏</label>
    <div class="cast-workspace"><section class="cast-selection"><div class="cast-filters">
      <label>角色文件夹<select data-cast-folder><option value="__all__">全部角色分类</option>${folderOptions('characters').replace('<option value="">未分类</option>','<option value="__root__">未分类</option>')}</select></label>
      <label>搜索角色<input type="search" data-cast-search placeholder="输入角色名称"></label>
      <label class="cast-enabled"><input type="checkbox" data-cast-selected> 只看已勾选角色</label>
      <small data-cast-count role="status"></small></div>
    <div class="cast-editor-list">${[...project.characters].sort((a,b)=>Number(b.pinned===true)-Number(a.pinned===true)).map(c=>{
      const item=state.portraits.find(item=>item.character.id===c.id),placement=KotobaCore.portraitPlacement(item?.portrait,c);
      return `<section class="cast-editor-row" data-cast-character="${esc(c.id)}"><h3>${esc(c.name)}</h3>
        <small>${esc(KotobaLibrary.folderPath(project,'characters',c.folderId)||'未分类')}${c.pinned?' · 已置顶':''}</small>
        <label class="cast-enabled"><input type="checkbox" name="visible:${esc(c.id)}" ${item?'checked':''}> 在画面中显示</label>
        <div class="field"><label>立绘差分</label><select name="variant:${esc(c.id)}">${variantOptions(c,item?.portrait.variant||'')}</select></div>
        <div class="field-row">${[['x','水平位置',0,100],['y','脚底位置',0,150],['scale','大小',20,200]].map(([key,label,min,max])=>`<div class="field"><label>${label}（%）</label><div class="cast-number-stepper"><button type="button" data-cast-nudge="${key}" data-delta="-1" aria-label="减小${label}">−</button><input type="number" data-cast-number="${key}" name="${key}:${esc(c.id)}" value="${placement[key]}" min="${min}" max="${max}" step="any" required><button type="button" data-cast-nudge="${key}" data-delta="1" aria-label="增大${label}">＋</button></div><input type="range" data-cast-range="${key}" aria-label="${esc(c.name)}${label}" value="${placement[key]}" min="${min}" max="${max}" step="0.1"></div>`).join('')}</div>
        <div class="field-row"><div class="field"><label>位移动画时长（毫秒）</label><input type="number" name="moveDuration:${esc(c.id)}" min="0" max="5000" step="1" value="${KotobaCore.portraitMotion(item?.portrait).duration}"></div><div class="field"><label>移动方式</label><select name="moveEasing:${esc(c.id)}">${optionList({'ease-in-out':'平滑起止',linear:'匀速','ease-in':'逐渐加速','ease-out':'逐渐减速'},KotobaCore.portraitMotion(item?.portrait).easing)}</select></div></div>
        ${KotobaCore.portraitAsset(project,c)?'':'<p class="field-note">此角色尚未绑定默认立绘；可在角色管理中添加立绘或选择有效差分。</p>'}</section>`;
    }).join('')||'<p>请先在角色管理添加角色和立绘。</p>'}<p data-cast-empty hidden>此分类或搜索条件下没有角色。</p></div></section>
    <aside class="cast-preview-panel"><h3>位置预览</h3><div class="stage cast-preview-stage" aria-label="多人立绘位置预览"></div>
      <p class="field-note">直接拖动要调整的立绘；数值、滑杆和预览同步。当前更改在点击应用后保存。</p>
      <label>微调步长<select data-cast-step><option value="0.1">0.1% · 精细</option><option value="1" selected>1% · 常用</option><option value="5">5% · 快速</option></select></label>
      <button type="button" class="btn" data-cast-arrange>将勾选角色均匀排列</button>
      <button type="button" class="btn" data-cast-preview-motion>播放位移预览</button>
      <p class="field-note">时长 0 为直接切换；例如 600 毫秒为平滑移动 0.6 秒。位移从该角色上一处位置开始，首次出场直接显示。</p>
      <p class="field-note">切换角色文件夹会保留其他分类的勾选和位置。分类在角色管理中维护。</p>
    </aside></div>`, '应用到当前剧情', form=>{
      const enabled=form.has('enabled');
      change(()=>{
        s.multiPortrait=enabled;
        if(!enabled)return;
        const anchorIndex=s.blocks.indexOf(current), index=anchorIndex<0?s.blocks.length:anchorIndex;
        const controls=[];
        for(const c of project.characters){
          const visible=form.has('visible:'+c.id),variant=form.get('variant:'+c.id)||'';
          if(!visible&&!state.portraits.some(item=>item.character.id===c.id)&&current?.speaker!==c.id)continue;
          const layout=KotobaCore.portraitPlacement({position:'custom',portraitLayout:Object.fromEntries(['x','y','scale'].map(key=>[key,Number(form.get(key+':'+c.id))]))});
          const motion=KotobaCore.portraitMotion({moveDuration:Number(form.get('moveDuration:'+c.id)),moveEasing:form.get('moveEasing:'+c.id)});
          const values={speaker:c.id,variant,position:'custom',portraitLayout:layout,moveDuration:motion.duration,moveEasing:motion.easing,visible,text:(visible?'显示 ':'隐藏 ')+c.name,placementFor:current?.id||''};
          if(current?.type==='portrait'&&current.speaker===c.id){Object.assign(current,values);continue}
          const previous=s.blocks.slice(0,index).findLast(b=>b.type==='portrait'&&b.speaker===c.id&&b.placementFor===current?.id);
          if(previous)Object.assign(previous,values);else controls.push({id:uid(),type:'portrait',...values});
          if(current?.type==='dialogue'&&current.speaker===c.id){delete current.variant;delete current.position;delete current.portraitLayout;delete current.moveDuration;delete current.moveEasing}
        }
        s.blocks.splice(index,0,...controls);
        if(!current)selected=controls.at(-1)?.id;
      });
      notify(enabled?'多人同屏设置已应用，可在舞台中分别拖动角色':'本章已恢复单立绘模式');
    });
  enhanceStageCastEditor(state,current);
}

function enhanceStageCastEditor(state,current){
  const modal=$('#modal'),form=$('#dialogForm'),rows=[...form.querySelectorAll('[data-cast-character]')],stage=form.querySelector('.cast-preview-stage');
  const renderer=createStageRenderer(KotobaCore,editorMediaSource);
  const number=(row,key)=>row.querySelector(`[data-cast-number="${key}"]`);
  const visible=row=>row.querySelector('input[type="checkbox"]').checked;
  let dragging=null;
  modal.classList.add('cast-dialog');
  function setValue(row,key,value){
    const input=number(row,key),bounded=Math.max(Number(input.min),Math.min(Number(input.max),value));
    input.value=Math.round(bounded*1000)/1000;row.querySelector(`[data-cast-range="${key}"]`).value=input.value;
  }
  function filterRows(){
    const folder=form.querySelector('[data-cast-folder]').value,search=form.querySelector('[data-cast-search]').value.trim().toLocaleLowerCase(),onlySelected=form.querySelector('[data-cast-selected]').checked;
    const descendants=!['__all__','__root__'].includes(folder)?KotobaLibrary.descendants(project,'characters',folder):null;
    let shown=0;
    for(const row of rows){const c=character(row.dataset.castCharacter);row.hidden=!(c&&(folder==='__all__'||(folder==='__root__'?!c.folderId:descendants.has(c.folderId)))&&c.name.toLocaleLowerCase().includes(search)&&(!onlySelected||visible(row)));if(!row.hidden)shown++}
    form.querySelector('[data-cast-count]').textContent=`当前 ${shown} 个角色 · 共勾选 ${rows.filter(visible).length} 个`;
    form.querySelector('[data-cast-empty]').hidden=shown>0;
  }
  function renderPreview(playMotion=false){
    const blocks=[];
    if(state.backgroundBlock)blocks.push({...state.backgroundBlock});
    for(const row of rows.filter(visible))blocks.push({id:row.dataset.castCharacter,type:'portrait',speaker:row.dataset.castCharacter,visible:true,position:'custom',variant:form.elements['variant:'+row.dataset.castCharacter].value,moveDuration:Number(form.elements['moveDuration:'+row.dataset.castCharacter].value),moveEasing:form.elements['moveEasing:'+row.dataset.castCharacter].value,portraitLayout:Object.fromEntries(['x','y','scale'].map(key=>[key,Number(number(row,key).value)]))});
    blocks.push({id:'cast-preview-caption',type:'narration',text:current?.text||'拖动立绘，细调同屏角色的位置。'});
    if(playMotion){const before=blocks.map(b=>b.type==='portrait'?{...b,portraitLayout:KotobaCore.portraitPlacement(state.portraits.find(item=>item.character.id===b.speaker)?.portrait,character(b.speaker))}:b);renderer.reset();renderer.render(stage,project,{id:'cast-preview',name:'多人同屏预览',multiPortrait:true,blocks:before},before.length-1,false,false,null,false)}
    renderer.render(stage,project,{id:'cast-preview',name:'多人同屏预览',multiPortrait:true,blocks},blocks.length-1,false,false,null,playMotion);
    stage.querySelector('.dialogue').hidden=true;
  }
  form.querySelector('[data-cast-folder]').onchange=filterRows;
  form.querySelector('[data-cast-search]').oninput=filterRows;
  form.querySelector('[data-cast-selected]').onchange=filterRows;
  form.querySelector('[data-cast-arrange]').onclick=()=>{const selected=rows.filter(visible);selected.forEach((row,i)=>setValue(row,'x',selected.length===1?50:20+60*i/(selected.length-1)));renderPreview()};
  form.querySelector('[data-cast-preview-motion]').onclick=()=>renderPreview(true);
  form.addEventListener('input',event=>{
    const row=event.target.closest('[data-cast-character]');if(!row)return;
    if(event.target.dataset.castRange)setValue(row,event.target.dataset.castRange,Number(event.target.value));
    if(event.target.dataset.castNumber)row.querySelector(`[data-cast-range="${event.target.dataset.castNumber}"]`).value=event.target.value;
    renderPreview();
  });
  form.addEventListener('change',event=>{if(event.target.closest('[data-cast-character]')){filterRows();renderPreview()}});
  form.addEventListener('click',event=>{
    const button=event.target.closest('[data-cast-nudge]');if(!button)return;
    const row=button.closest('[data-cast-character]'),key=button.dataset.castNudge;
    setValue(row,key,Number(number(row,key).value)+Number(button.dataset.delta)*Number(form.querySelector('[data-cast-step]').value));renderPreview();
  });
  stage.addEventListener('pointerdown',event=>{
    const image=event.target.closest('.stage-character');if(event.button!==0||!image)return;
    event.preventDefault();event.stopPropagation();const row=rows.find(row=>row.dataset.castCharacter===image.dataset.characterId);
    image.getAnimations().forEach(animation=>animation.cancel());
    dragging={pointerId:event.pointerId,row,image,x:event.clientX,y:event.clientY,startX:Number(number(row,'x').value),startY:Number(number(row,'y').value),rect:stage.getBoundingClientRect()};
    if(event.isTrusted)stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove',event=>{
    const d=dragging;if(!d||d.pointerId!==event.pointerId)return;event.preventDefault();
    setValue(d.row,'x',d.startX+(event.clientX-d.x)/d.rect.width*100);setValue(d.row,'y',d.startY+(event.clientY-d.y)/d.rect.height*100);
    d.image.style.left=number(d.row,'x').value+'%';d.image.style.bottom=(100-Number(number(d.row,'y').value))+'%';
  });
  const finish=event=>{if(dragging?.pointerId!==event.pointerId)return;dragging=null;if(stage.hasPointerCapture(event.pointerId))stage.releasePointerCapture(event.pointerId);renderPreview()};
  stage.addEventListener('pointerup',finish);stage.addEventListener('pointercancel',finish);
  form.addEventListener('invalid',()=>{form.querySelector('[data-cast-folder]').value='__all__';form.querySelector('[data-cast-search]').value='';form.querySelector('[data-cast-selected]').checked=false;filterRows()},true);
  modal.addEventListener('close',()=>{dragging=null;renderer.reset();if(!modal.open)modal.classList.remove('cast-dialog')},{once:true});
  filterRows();renderPreview();
}

const stageCastDraw=draw;
draw=function(){stageCastDraw();if(view==='script')$('.tool-strip')?.insertAdjacentHTML('beforeend',`<button class="btn small ${scene().multiPortrait?'primary':''}" data-action="stage-cast">多人同屏</button>`)};
document.addEventListener('click',event=>{if(event.target.closest('[data-action="stage-cast"]'))openStageCastEditor()});
draw();
