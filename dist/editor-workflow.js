function playEditorMusic(assetId) {
  stopAudio();
  const sound = asset(assetId);
  if (sound?.type !== 'audio') return;
  audio = new Audio(sound.data);
  audio.loop = true;
  audio.play().catch(() => notify('音乐未能播放，请检查素材格式'));
}

function startStoryPreview(index) {
  view = 'script';
  playing = true;
  playScene = scene().id;
  playIndex = index;
  ended = false;
  stageRenderer.reset();
  const previousMusic = scene().blocks.slice(0, index).findLast(b => b.type === 'music');
  playEditorMusic(previousMusic?.asset);
  resolvePlayable();
  draw();
}

function openBlockInsertMenu() {
  const labels = {...types, background: '插入背景切换', choice: '快速添加分支'};
  dialog('添加剧情块', `<div class="field"><label for="insertSearch">搜索类型</label>
    <input id="insertSearch" placeholder="输入音乐、跳转、CG…" autofocus></div>
    <div class="field"><label for="insertType">剧情块类型</label>
    <select id="insertType" name="type" size="7" required>${optionList(labels, 'dialogue')}</select></div>`, '添加', form => {
    const type = form.get('type');
    if (type === 'cg') setTimeout(openCgInsert, 0);
    else if (type === 'effect') setTimeout(insertVisualEffect, 0);
    else if (Object.hasOwn(labels, type)) addBlock(type);
  });
  $('#insertSearch').addEventListener('input', event => {
    const search = event.target.value.trim().toLowerCase();
    const choices = Object.entries(labels).filter(([key, label]) => `${key} ${label}`.toLowerCase().includes(search));
    $('#insertType').innerHTML = optionList(Object.fromEntries(choices), choices[0]?.[0]);
  });
}

function sourceBlockButton(s, b) {
  return `<button class="btn small" data-action="locate-flow-block" data-scene="${esc(s.id)}" data-id="${esc(b.id)}">定位源剧情块</button>`;
}

function showJsonEditError(error) {
  const editor = $('#codeEditor');
  let panel = $('#jsonEditError');
  if (!panel) {
    editor.insertAdjacentHTML('afterend', '<div id="jsonEditError" class="json-edit-error" role="alert"></div>');
    panel = $('#jsonEditError');
  }
  const source = editor.value;
  const position = error.message.match(/\bposition (\d+)/i);
  const lineAndColumn = error.message.match(/line (\d+) column (\d+)/i);
  let caret = position ? Number(position[1]) : null;
  if (caret === null && lineAndColumn) {
    caret = source.split('\n').slice(0, Number(lineAndColumn[1]) - 1)
      .reduce((length, line) => length + line.length + 1, Number(lineAndColumn[2]) - 1);
  }
  if (caret === null && error instanceof SyntaxError && /unexpected end/i.test(error.message)) caret = source.length;

  let width = 1;
  if (error.blockId && error.sceneId === scene().id) {
    const id = JSON.stringify(error.blockId);
    const found = [...source.matchAll(/"id"\s*:\s*("(?:\\.|[^"\\])*")/g)].find(match => match[1] === id);
    if (found) {
      caret = found.index + found[0].lastIndexOf(id);
      width = id.length;
    }
  }
  const lines = caret === null ? null : source.slice(0, caret).split('\n');
  const location = lines ? `第 ${lines.length} 行，第 ${lines.at(-1).length + 1} 列` : '';
  const headline = error instanceof SyntaxError ? 'JSON 格式有误' : error.message;
  panel.innerHTML = `<strong>${esc(headline)}</strong>${location ? `<span>${location}</span>` : ''}
    <details><summary>错误详情</summary><pre>${esc(error.message)}</pre></details>`;
  if (caret !== null) {
    editor.focus({preventScroll: true});
    editor.setSelectionRange(caret, Math.min(source.length, caret + width));
    if (lines) {
      const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 18;
      editor.scrollTop = Math.max(0, (lines.length - 3) * lineHeight);
    }
  }
}

document.addEventListener('input', event => {
  if (event.target.id === 'codeEditor') $('#jsonEditError')?.remove();
});

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action="locate-flow-block"]');
  if (!button) return;
  const target = project.scenes.find(s => s.id === button.dataset.scene);
  if (!target?.blocks.some(b => b.id === button.dataset.id)) return;
  stopContentPlayback();
  sceneId = target.id;
  selected = button.dataset.id;
  mode = 'visual';
  view = 'script';
  draw();
  revealStoryBlock(selected);
});
