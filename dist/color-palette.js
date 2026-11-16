const paletteSwatches = [
  ['象牙白', '#fffdf0'], ['暖沙', '#d8b895'], ['珊瑚红', '#c66364'],
  ['淡紫', '#9a81ad'], ['雾蓝', '#6d8fab'], ['青绿', '#477b74'],
  ['苔绿', '#607550'], ['松林', '#24372e'], ['暮紫', '#423651'],
  ['深海', '#263951'], ['炭黑', '#252727'], ['纯黑', '#000000']
];

function colorPalette(label, color, pickerAttributes) {
  const swatches = paletteSwatches.map(([name, value]) => `
    <button type="button" class="palette-swatch" data-palette-swatch="${value}"
      style="--swatch:${value}" title="${name} ${value}" aria-label="${name} ${value}"
      aria-pressed="${value === color.toLowerCase()}"></button>`).join('');
  return `<div class="field color-palette" role="group" aria-label="${label}">
    <label>${label}</label>
    <div class="palette-fields">
      <input type="color" data-palette-picker ${pickerAttributes} value="${color}" aria-label="自由选取${label}">
      <input type="text" data-palette-hex value="${color.toUpperCase()}" maxlength="7"
        pattern="#?[0-9A-Fa-f]{6}" required spellcheck="false" aria-label="${label}十六进制色号">
    </div>
    <div class="palette-swatches">${swatches}</div>
  </div>`;
}

function syncColorPalette(picker) {
  const palette = picker.closest('.color-palette');
  palette.querySelector('[data-palette-hex]').value = picker.value.toUpperCase();
  for (const swatch of palette.querySelectorAll('[data-palette-swatch]')) {
    swatch.setAttribute('aria-pressed', String(swatch.dataset.paletteSwatch === picker.value));
  }
}

function choosePaletteColor(palette, color) {
  const picker = palette.querySelector('[data-palette-picker]');
  if (picker.value === color.toLowerCase()) {
    syncColorPalette(picker);
    return;
  }
  picker.value = color;
  picker.dispatchEvent(new Event('input', {bubbles: true}));
  picker.dispatchEvent(new Event('change', {bubbles: true}));
}

document.addEventListener('input', event => {
  if (event.target.matches('[data-palette-picker]')) syncColorPalette(event.target);
});

document.addEventListener('change', event => {
  const field = event.target;
  if (field.matches('[data-palette-picker]')) syncColorPalette(field);
  if (!field.matches('[data-palette-hex]')) return;
  const palette = field.closest('.color-palette');
  const color = '#' + field.value.trim().replace(/^#/, '');
  if (!/^#[a-f\d]{6}$/i.test(color)) {
    syncColorPalette(palette.querySelector('[data-palette-picker]'));
    notify('请输入六位色号，例如 #477B74');
    return;
  }
  choosePaletteColor(palette, color);
});

document.addEventListener('click', event => {
  const swatch = event.target.closest('[data-palette-swatch]');
  if (swatch) choosePaletteColor(swatch.closest('.color-palette'), swatch.dataset.paletteSwatch);
});
