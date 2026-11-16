function dialogueStyleFields(){const style=KotobaCore.dialogueStyle(project);return `<div class="field-row">${colorPalette('背景底色',style.color,'data-dialogue-style="color"')}${colorPalette('文字颜色',style.textColor,'data-dialogue-style="textColor"')}</div><div class="field-row"><div class="field"><label>背景不透明度（0–100%）</label><input type="number" min="0" max="100" data-dialogue-style="opacity" value="${Math.round(style.opacity*100)}"></div><div class="field"><label>圆角</label><input type="number" min="0" max="40" data-dialogue-style="radius" value="${style.radius}"></div></div><div class="field"><label>背景图片（可选）</label><select data-dialogue-style="image">${assetOptions(style.image)}</select></div><div class="subtitle-color-preview" aria-label="字幕样式预览"><div class="subtitle-color-sample"><div class="subtitle-color-fill"></div><span>字幕样式预览</span></div></div><p class="field-note">背景透明度只影响底色和图片，文字与角色名保持清晰。图片从素材库选择，留空使用纯色。适用于整部作品的对白、旁白与选择提示。</p><button class="btn small" type="button" data-action="reset-dialogue-style">恢复默认背景</button>`}
function dialogueFieldValue(key, value) {
  if (key === 'opacity') return Number(value) / 100;
  if (key === 'radius') return Number(value);
  return value;
}

function previewDialogueColors() {
  const form = $('#dialogForm');
  const sample = form?.querySelector('.subtitle-color-sample');
  if (!sample) return;
  const fields = form.querySelectorAll('[data-dialogue-style]');
  const values = Object.fromEntries(Array.from(fields, field => {
    const key = field.dataset.dialogueStyle;
    return [key, dialogueFieldValue(key, field.value)];
  }));
  const style = KotobaCore.dialogueStyle({dialogueStyle: values});
  const fill = sample.querySelector('.subtitle-color-fill');
  const image = asset(style.image);
  sample.style.color = style.textColor;
  sample.style.borderRadius = `${style.radius}px`;
  fill.style.backgroundColor = style.color;
  fill.style.opacity = style.opacity;
  fill.style.backgroundImage = image ? `url(${JSON.stringify(image.data)})` : 'none';
}

function openDialogueStyle(){dialog('字幕框背景',dialogueStyleFields(),'完成',()=>{});previewDialogueColors()}
const backgroundDefaultsDialog=subtitleDefaultsDialog,backgroundDraw=draw;
subtitleDefaultsDialog=function(){backgroundDefaultsDialog();$('#dialogForm .actions').insertAdjacentHTML('beforebegin','<h3 style="font-size:13px;margin:20px 0 15px">字幕框背景</h3>'+dialogueStyleFields());previewDialogueColors()};
draw=function(){backgroundDraw();if(view==='script')$('.tool-strip')?.insertAdjacentHTML('beforeend','<button class="btn small" data-action="dialogue-style">字幕框背景</button>')};
document.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(!['dialogue-style','reset-dialogue-style'].includes(action))return;e.preventDefault();e.stopImmediatePropagation();if(action==='dialogue-style')openDialogueStyle();else{change(()=>delete project.dialogueStyle);$('#modal').close();openDialogueStyle()}},true);
document.addEventListener('change',e=>{const key=e.target.dataset.dialogueStyle;if(!key)return;change(()=>{const value=dialogueFieldValue(key,e.target.value);project.dialogueStyle=KotobaCore.dialogueStyle({dialogueStyle:{...KotobaCore.dialogueStyle(project),[key]:value}})});previewDialogueColors()});
document.addEventListener('input', event => {
  if (event.target.matches('[data-dialogue-style]')) previewDialogueColors();
});
draw();
