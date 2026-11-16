function imageChoiceEntries(options={}) {
  if(options.characterId){
    const c=character(options.characterId);if(!c)return [];
    const defaults=KotobaCore.portraitAsset(project,c);
    return [...(defaults?[{id:'',name:'默认立绘 · '+defaults.name,media:defaults}]:[]),...(c.variants||[]).map(v=>({id:v.id,name:v.name+' · '+(asset(v.asset)?.name||'未绑定图片'),media:asset(v.asset)}))].filter(item=>item.media?.type==='image');
  }
  return project.assets.filter(a=>a.type==='image').map(a=>({id:a.id,name:a.name,media:a}));
}

function imageFolderOptions(){return '<option value="__all__">全部文件夹</option>'+folderOptions('assets').replace('<option value="">未分类</option>','<option value="__root__">未分类</option>')}
function filterImageFolder(entries,folder){if(folder==='__all__')return entries;if(folder==='__root__')return entries.filter(item=>!item.media.folderId);const descendants=KotobaLibrary.descendants(project,'assets',folder);return entries.filter(item=>descendants.has(item.media.folderId))}

function enhanceImageSelectors(root = document) {
  if(!root)return;
  const imageIds=new Set(project.assets.filter(a=>a.type==='image').map(a=>a.id));
  for (const select of root.querySelectorAll('select')) {
    if (select.dataset.imageChooser) continue;
    const options=select.matches('[data-edit="variant"]')?{characterId:block()?.speaker}:{};
    const variants=select.matches('[data-edit="variant"]');
    const values = [...select.options].map(option => option.value).filter(Boolean);
    const known = values.length && values.every(id => imageIds.has(id));
    const explicit = select.matches('[data-image-selector], [data-scene-background-image], [data-cg-preview], [data-menu-background]')
      || (select.matches('[data-edit="asset"]') && block()?.type === 'background');
    if (!known && !explicit && !variants) continue;
    if(variants&&!options.characterId)continue;
    select.dataset.imageChooser = 'true';
    const label=document.createElement('label');label.className='image-folder-filter';
    label.innerHTML=`${variants?'立绘素材文件夹':'图片文件夹'}<select data-image-folder-filter aria-label="${variants?'筛选立绘素材文件夹':'筛选图片文件夹'}">${imageFolderOptions()}</select>`;
    select.insertAdjacentElement('beforebegin',label);
    const filter=label.querySelector('select');
    filter.onchange=()=>{
      const current=select.value,entries=imageChoiceEntries(options),chosen=entries.find(item=>item.id===current),visible=filterImageFolder(entries,filter.value);
      select.innerHTML=`<option value="">${variants?'默认立绘':'未选择素材'}</option>`+(current&&chosen&&!visible.includes(chosen)?`<optgroup label="当前使用 · 其他分类"><option value="${esc(current)}">${esc(chosen.name)}</option></optgroup>`:'')+visible.filter(item=>item.id).map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
      select.value=current;
    };
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn small image-chooser-button';
    button.textContent = variants?'按文件夹浏览立绘差分…':'按文件夹选择图片…';
    button.onclick = () => openImageChooser(select,options);
    select.insertAdjacentElement('afterend', button);
  }
}

function openImageChooser(target,options={}) {
  if (!target.isConnected) return;
  const projectId = project.id;
  const chooser = document.createElement('dialog');
  chooser.className = 'image-chooser-dialog';
  chooser.setAttribute('aria-label', '按文件夹选择图片');
  let folder = '__all__';
  let search = '';
  let page = 0;
  const pageSize = 36;
  chooser.innerHTML = `<h2>${options.characterId?'选择角色立绘差分':'选择图片素材'}</h2><div class="image-chooser-controls">
    <label>素材文件夹<select data-image-folder>${imageFolderOptions()}</select></label>
    <label>搜索<input data-image-search type="search" placeholder="输入图片名" autocomplete="off"></label></div>
    <div class="image-chooser-grid"></div><div class="image-chooser-pagination"></div>
    <div class="actions"><button type="button" class="btn" data-image-clear>${options.characterId?'使用默认立绘':'不使用图片'}</button>
      <button type="button" class="btn" data-image-close>取消</button></div>`;
  function apply(id) {
    const entry=imageChoiceEntries(options).find(item=>item.id===id);
    if (project.id !== projectId || !target.isConnected || (id && !entry)) {
      notify('原设置已改变，请重新选择');
    } else {
      if(id&&![...target.options].some(option=>option.value===id))target.add(new Option(entry.name,id));
      target.value = id;
      target.dispatchEvent(new Event('change', {bubbles: true}));
    }
    chooser.close();
  }
  function renderChoices() {
    const images = filterImageFolder(imageChoiceEntries(options),folder).filter(item=>item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    const pages = Math.max(1, Math.ceil(images.length / pageSize));
    page = Math.min(page, pages - 1);
    const visible = images.slice(page * pageSize, (page + 1) * pageSize);
    const grid = chooser.querySelector('.image-chooser-grid');
    grid.innerHTML = visible.map(a => `<button type="button" class="image-choice ${a.id === target.value ? 'selected' : ''}" data-image-id="${esc(a.id)}">
      <img alt="" decoding="async"><strong>${esc(a.name)}</strong><small>${esc(KotobaLibrary.folderPath(project,'assets',a.media.folderId) || '未分类')}</small></button>`).join('') || '<p class="empty">没有符合条件的图片或立绘差分。</p>';
    for (const button of grid.querySelectorAll('[data-image-id]')) {
      const item = images.find(item=>item.id===button.dataset.imageId)?.media;
      prepareEditorMedia(item).then(() => {
        if (button.isConnected && project.id === projectId) button.querySelector('img').src = editorMediaSource(item);
      });
    }
    chooser.querySelector('.image-chooser-pagination').innerHTML = `<span>${images.length} 张图片 · 第 ${page+1}/${pages} 页</span>
      <button type="button" class="btn small" data-image-page="-1" ${page ? '' : 'disabled'}>上一页</button>
      <button type="button" class="btn small" data-image-page="1" ${page+1 < pages ? '' : 'disabled'}>下一页</button>`;
    grid.scrollTop = 0;
  }
  chooser.querySelector('[data-image-folder]').onchange = event => {folder=event.target.value;page=0;renderChoices()};
  chooser.querySelector('[data-image-search]').oninput = event => {search=event.target.value;page=0;renderChoices()};
  chooser.onclick = event => {
    const image = event.target.closest('[data-image-id]');
    const pagination = event.target.closest('[data-image-page]');
    if (image) apply(image.dataset.imageId);
    if (pagination) {page += Number(pagination.dataset.imagePage);renderChoices()}
    if (event.target.closest('[data-image-clear]')) apply('');
    if (event.target.closest('[data-image-close]')) chooser.close();
  };
  chooser.addEventListener('close', () => chooser.remove(), {once:true});
  document.body.append(chooser);
  renderChoices();
  chooser.showModal();
  chooser.querySelector('[data-image-search]').focus();
}

const chooserDialog = dialog;
dialog = function (...args) {chooserDialog(...args);enhanceImageSelectors($('#dialogForm'))};
const chooserInspector=drawInspector;
drawInspector=function(){chooserInspector();enhanceImageSelectors($('#inspector'))};
const chooserDraw = draw;
draw = function () {chooserDraw();enhanceImageSelectors($('#app'))};
draw();
