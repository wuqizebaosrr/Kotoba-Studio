const editorScrollPositions = new Map();

function storyListKey(id = scene().id) {
  return JSON.stringify([project.id, 'story', id]);
}

function editorScrollSurfaces() {
  return [
    {element: $('.script-panel .blocks'), items: '.block'},
    {element: $('.collection-layout'), items: '.collection-cards > [data-id]'},
    {element: $('.folder-sidebar'), items: '.folder-row'}
  ];
}

function editorViewportTop(element) {
  const top = element.getBoundingClientRect().top;
  if (!element.matches('.collection-layout')) return top;
  const toolbar = element.querySelector('.collection-controls');
  return Math.max(top, toolbar?.getBoundingClientRect().bottom ?? top);
}

function rememberEditorScroll(surfaces) {
  let focused = null;
  for (const {element, items} of surfaces) {
    const key = element?.dataset.scrollKey;
    if (!key) continue;
    const rows = Array.from(element.querySelectorAll(items));
    if (!rows.length) continue;
    const top = editorViewportTop(element);
    const first = element.scrollTop > 0 ? rows.findIndex(row => row.getBoundingClientRect().bottom > top) : -1;
    const anchors = first < 0 ? [] : rows.slice(first, first + 2).map(row => ({
      id: row.dataset.id,
      offset: row.getBoundingClientRect().top - top
    }));
    editorScrollPositions.set(key, {
      scrollTop: element.scrollTop,
      anchors,
      selected: element.querySelector('.block.selected')?.dataset.id
    });
    const active = document.activeElement;
    if (active?.matches('.block') && element.contains(active)) {
      focused = {key, id: active.dataset.id};
    }
    if (active?.matches('[data-asset-select]') && element.contains(active)) {
      focused = {key, assetId: active.dataset.assetSelect};
    }
  }
  return focused;
}

function restoreEditorScroll(surface, key, focused) {
  const {element, items} = surface;
  if (!element) return;
  element.dataset.scrollKey = key;
  const position = editorScrollPositions.get(key);
  if (!position) return;
  const rows = Array.from(element.querySelectorAll(items));
  element.scrollTop = position.scrollTop;
  for (const anchor of position.anchors) {
    const row = rows.find(item => item.dataset.id === anchor.id);
    if (!row) continue;
    element.scrollTop += row.getBoundingClientRect().top - editorViewportTop(element) - anchor.offset;
    break;
  }
  if (!playing && focused?.key === key) {
    const target = focused.assetId
      ? [...element.querySelectorAll('[data-asset-select]')].find(input => input.dataset.assetSelect === focused.assetId)
      : rows.find(row => row.dataset.id === focused.id);
    target?.focus({preventScroll: true});
  }
}

function revealStoryBlock(id) {
  const list = $('.script-panel .blocks');
  const row = list && Array.from(list.children).find(item => item.dataset.id === id);
  if (!row) return;
  const viewport = list.getBoundingClientRect();
  const bounds = row.getBoundingClientRect();
  if (bounds.top < viewport.top) list.scrollTop += bounds.top - viewport.top;
  else if (bounds.bottom > viewport.bottom) {
    list.scrollTop += Math.min(bounds.top - viewport.top, bounds.bottom - viewport.bottom);
  }
}

const drawBeforeScrollRestore = draw;
draw = function () {
  const focused = rememberEditorScroll(editorScrollSurfaces());
  drawBeforeScrollRestore();
  releaseUnusedEditorMedia();
  const [story, collection, folders] = editorScrollSurfaces();
  if (story.element) restoreEditorScroll(story, storyListKey(), focused);
  if (collection.element) {
    const kind = view === 'assets' ? 'assets' : 'characters';
    const filter = kind === 'assets' ? assetFilter : '';
    restoreEditorScroll(collection, JSON.stringify([project.id, kind, collectionFolder[kind], filter]), focused);
    restoreEditorScroll(folders, JSON.stringify([project.id, kind, 'folders']), focused);
  }
};

draw();
