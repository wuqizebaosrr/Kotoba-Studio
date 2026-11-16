const unpinnedCollectionItems = collectionItems;
collectionItems = function (kind) {
  const items = unpinnedCollectionItems(kind);
  return kind === 'characters' ? [...items].sort((a,b) => Number(b.pinned === true) - Number(a.pinned === true)) : items;
};

const characterPinsDraw = draw;
draw = function () {
  characterPinsDraw();
  if (view !== 'people') return;
  for (const card of document.querySelectorAll('.character-card[data-id]')) {
    const c = character(card.dataset.id);
    if (!c) continue;
    if (c.pinned === true) card.querySelector('h3')?.insertAdjacentHTML('beforeend', ' <span class="pill">已置顶</span>');
    card.querySelector('.card-actions')?.insertAdjacentHTML('afterbegin', `<button type="button" class="btn small" data-action="pin-character" data-id="${esc(c.id)}" aria-pressed="${c.pinned === true}">${c.pinned === true ? '取消置顶' : '置顶角色'}</button>`);
  }
};

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action="pin-character"]');
  if (!button) return;
  const c = character(button.dataset.id);
  if (c) change(() => c.pinned = c.pinned !== true);
});

draw();
