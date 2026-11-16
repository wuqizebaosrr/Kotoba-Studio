function openGameMenuEditor() {
  const settings = KotobaCore.menuSettings(project);
  dialog('游戏进入菜单', `<p>设置玩家启动 HTML 或 EXE 时看到的标题画面。</p>
    <div class="field"><label>游戏标题</label><input name="title" maxlength="100" value="${esc(settings.title)}" required></div>
    <div class="field"><label>副标题 / 作者</label><input name="subtitle" maxlength="200" value="${esc(settings.subtitle)}"></div>
    <div class="field"><label>菜单背景图片（留空使用纯色）</label><select name="background" data-menu-background>${assetOptions(settings.background)}</select></div>
    <div class="field-row">${colorPalette('菜单底色',settings.color,'name="color"')}${colorPalette('标题文字颜色',settings.textColor,'name="textColor"')}</div>
    <p class="field-note">菜单提供开始游戏、继续游戏、读取存档、音量设置及退出。继续游戏使用最近一条有效存档。</p>
    <button type="button" class="btn" data-action="preview-game-menu">预览当前菜单</button>`, '保存菜单', form => {
      change(() => project.menu = Object.fromEntries(form));
      notify('游戏菜单已保存');
    });
}

async function previewGameMenu() {
  const previewProject = structuredClone(await portableProject());
  const form = $('#dialogForm');
  if (form?.querySelector('[data-menu-background]')) previewProject.menu = Object.fromEntries(new FormData(form));
  const html = await buildOfflineGame(previewProject);
  const preview = document.createElement('dialog');
  preview.className = 'game-menu-preview-dialog';
  preview.innerHTML = '<h2>游戏菜单预览</h2><iframe title="游戏标题菜单预览" allow="autoplay"></iframe><div class="actions"><button type="button" class="btn">关闭预览</button></div>';
  preview.querySelector('iframe').srcdoc = html;
  preview.querySelector('button').onclick = () => preview.close();
  preview.addEventListener('close', () => preview.remove(), {once:true});
  document.body.append(preview);
  preview.showModal();
}

const menuEditorDraw = draw;
draw = function () {
  menuEditorDraw();
  if (view === 'script') $('.tool-strip')?.insertAdjacentHTML('beforeend', '<button class="btn small" data-action="game-menu">游戏进入菜单</button>');
  if (view === 'settings') $('.settings-card')?.insertAdjacentHTML('afterbegin', '<button class="btn" data-action="game-menu">设置游戏进入菜单</button>');
};
const menuValidate = validateProject;
validateProject = function (p) {
  menuValidate(p);
  if (p.menu?.background && !p.assets.some(a => a.id === p.menu.background && a.type === 'image')) throw Error('游戏菜单背景图片不存在');
  return p;
};
document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'game-menu') openGameMenuEditor();
  if (action === 'preview-game-menu') previewGameMenu().catch(error => notify(error.message));
});
draw();
