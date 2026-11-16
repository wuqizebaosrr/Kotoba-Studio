let blockOrderDrag=null,blockOrderFrame=null,editorSplitDrag=null,editorSplitObserver=null;
let editorSplitPercent=44;
try{const saved=localStorage.getItem('kotoba-editor-split-v1');if(saved!==null&&Number.isFinite(Number(saved)))editorSplitPercent=Math.max(30,Math.min(70,Number(saved)))}catch{}

function reorderStoryBlock(id,beforeId=null){
  if(playing||mode!=='visual')return false;
  const blocks=scene().blocks,source=blocks.find(b=>b.id===id);
  if(!source||id===beforeId||beforeId&&!blocks.some(b=>b.id===beforeId))return false;
  const next=blocks.filter(b=>b.id!==id),position=beforeId?next.findIndex(b=>b.id===beforeId):next.length;
  next.splice(position,0,source);if(next.every((b,i)=>b===blocks[i]))return false;
  const top=$('.script-panel .blocks')?.scrollTop||0;
  change(()=>{scene().blocks=next;selected=id});
  const list=$('.script-panel .blocks');if(list)list.scrollTop=top;
  return true;
}
function clearBlockOrderDrag(){
  if(blockOrderFrame!==null)cancelAnimationFrame(blockOrderFrame);blockOrderFrame=null;blockOrderDrag=null;
  document.querySelectorAll('.block-order-source,.block-drop-before,.block-drop-after').forEach(row=>row.classList.remove('block-order-source','block-drop-before','block-drop-after'));
}
function blockOrderTarget(list,y){
  const rows=[...list.querySelectorAll('.block')].filter(row=>row.dataset.id!==blockOrderDrag.id);
  const before=rows.find(row=>y<row.getBoundingClientRect().top+row.getBoundingClientRect().height/2);
  list.querySelectorAll('.block-drop-before,.block-drop-after').forEach(row=>row.classList.remove('block-drop-before','block-drop-after'));
  (before||rows.at(-1))?.classList.add(before?'block-drop-before':'block-drop-after');
  blockOrderDrag.beforeId=before?.dataset.id||null;
}
function scrollBlockOrder(){
  const d=blockOrderDrag;if(!d||!d.list.isConnected)return;
  const rect=d.list.getBoundingClientRect(),edge=45;
  const delta=d.inside===false?0:d.y<rect.top+edge?-Math.min(18,(rect.top+edge-d.y)/3):d.y>rect.bottom-edge?Math.min(18,(d.y-rect.bottom+edge)/3):0;
  if(delta){d.list.scrollTop+=delta;blockOrderTarget(d.list,d.y)}
  blockOrderFrame=requestAnimationFrame(scrollBlockOrder);
}
function editorSplitGeometry(grid){const style=getComputedStyle(grid),padding=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight);return {start:grid.getBoundingClientRect().left+parseFloat(style.paddingLeft),available:Math.max(1,grid.clientWidth-padding-14)}}
function applyEditorSplit(grid){
  const splitter=grid.querySelector('.editor-splitter');if(!splitter)return;
  const enabled=matchMedia('(min-width:851px)').matches;
  splitter.hidden=!enabled;
  if(!enabled){grid.style.gridTemplateColumns='';return}
  const {available}=editorSplitGeometry(grid),minimum=Math.min(240,available*.45),maximum=available-Math.min(290,available*.45),left=Math.max(minimum,Math.min(maximum,available*editorSplitPercent/100));
  grid.style.gridTemplateColumns=`${left}px 14px minmax(0,1fr)`;
  splitter.setAttribute('aria-valuenow',Math.round(left/available*100));
}
function saveEditorSplit(){try{localStorage.setItem('kotoba-editor-split-v1',String(editorSplitPercent))}catch{}}
function finishEditorSplit(event,cancel=false){
  const d=editorSplitDrag;if(!d||event.pointerId!==d.pointerId)return;
  editorSplitDrag=null;document.body.classList.remove('editor-split-resizing');
  if(d.handle.hasPointerCapture(event.pointerId))d.handle.releasePointerCapture(event.pointerId);
  if(cancel)editorSplitPercent=d.start;else saveEditorSplit();
  if(d.grid.isConnected)applyEditorSplit(d.grid);
}
function enhanceEditorInteractions(){
  if(view!=='script')return;
  const grid=$('.editor-grid');if(!grid)return;
  grid.classList.add('resizable-editor');
  const splitter=document.createElement('div');splitter.className='editor-splitter';splitter.tabIndex=0;
  splitter.setAttribute('role','separator');splitter.setAttribute('aria-label','调整剧本与预览两栏宽度');splitter.setAttribute('aria-orientation','vertical');splitter.setAttribute('aria-valuemin','30');splitter.setAttribute('aria-valuemax','70');splitter.title='拖动调节两栏宽度；方向键微调，双击恢复默认';
  grid.querySelector('.script-panel').insertAdjacentElement('afterend',splitter);
  applyEditorSplit(grid);editorSplitObserver=new ResizeObserver(()=>applyEditorSplit(grid));editorSplitObserver.observe(grid);
  splitter.onpointerdown=event=>{if(event.button!==0||playing)return;event.preventDefault();editorSplitDrag={pointerId:event.pointerId,handle:splitter,grid,start:editorSplitPercent};document.body.classList.add('editor-split-resizing');if(event.isTrusted)splitter.setPointerCapture(event.pointerId)};
  splitter.ondblclick=()=>{editorSplitPercent=44;saveEditorSplit();applyEditorSplit(grid)};
  splitter.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();editorSplitPercent=event.key==='Home'?30:event.key==='End'?70:Math.max(30,Math.min(70,editorSplitPercent+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?5:1)));saveEditorSplit();applyEditorSplit(grid)};
  if(mode==='visual'&&!playing)for(const row of grid.querySelectorAll('.block'))row.querySelector('.block-top')?.insertAdjacentHTML('afterbegin',`<button type="button" class="block-drag-handle" draggable="true" data-block-drag="${esc(row.dataset.id)}" aria-label="拖动剧情块调整顺序" title="拖动排序">⠿</button>`);
}
const interactionsDraw=draw;
draw=function(){if(blockOrderDrag)clearBlockOrderDrag();if(editorSplitDrag)finishEditorSplit({pointerId:editorSplitDrag.pointerId},true);editorSplitObserver?.disconnect();interactionsDraw();enhanceEditorInteractions()};

document.addEventListener('click',event=>{if(event.target.closest('[data-block-drag]')){event.preventDefault();event.stopImmediatePropagation()}},true);
document.addEventListener('dragstart',event=>{
  const handle=event.target.closest('[data-block-drag]');if(!handle||playing||mode!=='visual')return;
  clearBlockOrderDrag();const list=handle.closest('.blocks');blockOrderDrag={id:handle.dataset.blockDrag,projectId:project.id,sceneId:sceneId,list,y:event.clientY,beforeId:null};
  event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',blockOrderDrag.id);handle.closest('.block').classList.add('block-order-source');blockOrderFrame=requestAnimationFrame(scrollBlockOrder);
});
document.addEventListener('dragover',event=>{const d=blockOrderDrag,list=event.target.closest('.script-panel .blocks');if(!d)return;if(list!==d.list||project.id!==d.projectId||sceneId!==d.sceneId){d.inside=false;return}d.inside=true;event.preventDefault();event.dataTransfer.dropEffect='move';d.y=event.clientY;blockOrderTarget(list,d.y);if(blockOrderFrame!==null)cancelAnimationFrame(blockOrderFrame);scrollBlockOrder()});
document.addEventListener('drop',event=>{
  const d=blockOrderDrag,list=event.target.closest('.script-panel .blocks');if(!d)return;
  if(list===d.list&&project.id===d.projectId&&sceneId===d.sceneId){event.preventDefault();blockOrderTarget(list,event.clientY);const {id,beforeId}=d;clearBlockOrderDrag();reorderStoryBlock(id,beforeId)}else clearBlockOrderDrag();
});
document.addEventListener('dragend',clearBlockOrderDrag);
document.addEventListener('pointermove',event=>{const d=editorSplitDrag;if(!d||d.pointerId!==event.pointerId)return;event.preventDefault();const geometry=editorSplitGeometry(d.grid);editorSplitPercent=Math.max(30,Math.min(70,(event.clientX-geometry.start)/geometry.available*100));applyEditorSplit(d.grid)},true);
document.addEventListener('pointerup',event=>finishEditorSplit(event),true);document.addEventListener('pointercancel',event=>finishEditorSplit(event,true),true);
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(blockOrderDrag)clearBlockOrderDrag();if(editorSplitDrag){event.preventDefault();event.stopImmediatePropagation();finishEditorSplit({pointerId:editorSplitDrag.pointerId},true)}},true);
draw();
