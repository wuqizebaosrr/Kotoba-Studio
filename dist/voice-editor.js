function voiceTarget() {
  const value = block();
  return ['dialogue', 'narration'].includes(value?.type) ? value : null;
}

const voiceInspector = drawInspector;
drawInspector = function () {
  voiceInspector();
  const target = voiceTarget();
  if (!target) return;
  const settings = KotobaCore.voiceSettings(target);
  const sound = asset(settings.asset);
  $('#inspector').insertAdjacentHTML('beforeend', `<section class="voice-settings">
    <h3>本句配音</h3>
    <div class="field"><label>配音音频</label><select data-voice="asset">${assetOptions(settings.asset, 'audio')}</select></div>
    <div class="card-actions"><button class="btn small" data-action="import-voice">导入配音</button>
      <button class="btn small" data-action="preview-voice" ${sound ? '' : 'disabled'}>试听 / 重播</button>
      <button class="btn small" data-action="stop-voice">停止试听</button>
      <button class="btn small" data-action="remove-voice" ${settings.asset ? '' : 'disabled'}>解除绑定</button></div>
    <div class="field"><label>配音音量 <output id="voiceVolumeLabel">${Math.round(settings.volume * 100)}%</output></label>
      <input type="range" min="0" max="100" step="1" value="${Math.round(settings.volume * 100)}" data-voice="volume"></div>
    <label class="subtitle-check"><input type="checkbox" data-voice="wait" ${settings.wait ? 'checked' : ''}>配音结束后才允许继续</label>
    <p class="field-note">支持对白和旁白，每句绑定一段录音。读档时从本句开头重播。音频从素材库选择或导入，单文件最多 20 MB。</p>
  </section>`);
};

async function importVoiceFile() {
  const target = voiceTarget();
  if (!target) return;
  const projectId = project.id;
  pickFile('audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus', async file => {
    try {
      if (file.size > MAX_ASSET_BYTES) throw Error('配音文件超过 20 MB');
      if (!file.type.startsWith('audio/')) throw Error('请选择受支持的音频文件');
      notify('正在导入配音…');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(Error('配音文件读取失败'));
        reader.readAsDataURL(file);
      });
      if (project.id !== projectId || !project.scenes.some(s => s.blocks.includes(target))) {
        notify('原剧情已切换或删除，请重新选择配音');
        return;
      }
      if (projectStorageEstimate() + data.length > 256 * 1024 * 1024 - 65536) throw Error('导入后工程将超过 256 MB');
      change(() => {
        const item = {id: uid(), name: file.name, type: 'audio', data, folderId: libraryDestinationFolder()};
        project.assets.push(item);
        target.voice = {...KotobaCore.voiceSettings(target), asset: item.id};
      });
      notify('配音已绑定到原剧情句');
    } catch (error) { notify(error.message); }
  });
}

const voiceDrawStage = drawStage;
drawStage = function (force = false) {
  voiceDrawStage(force);
  if (!playing || ended) { stageRenderer.stopVoice(); return; }
  const activeScene = project.scenes.find(s => s.id === playScene);
  stageRenderer.playVoice(project, activeScene?.blocks[playIndex], `${project.id}:${playScene}:${playIndex}`);
};

const voiceAdvance = advance;
advance = function () {
  if (playing && (stageRenderer.resumeVoice() || stageRenderer.voiceWaiting())) return;
  if (!playing) stageRenderer.stopVoice();
  voiceAdvance();
};

const voiceStopAudio = stopAudio;
stopAudio = function () { voiceStopAudio(); stageRenderer.stopVoice(); };

const voiceGameSaves = showGameSaves;
showGameSaves = async function () {
  stageRenderer.pauseVoice();
  await voiceGameSaves();
  if (!$('#modal').open && playing) stageRenderer.resumeVoice();
};
$('#modal').addEventListener('close', () => { if (playing && !ended) stageRenderer.resumeVoice(); });

const voiceValidate = validateProject;
validateProject = function (p) {
  voiceValidate(p);
  for (const s of p.scenes) for (const [index, b] of s.blocks.entries()) {
    if (!b.voice) continue;
    const valid = ['dialogue', 'narration'].includes(b.type) && typeof b.voice.asset === 'string'
      && (!b.voice.asset || p.assets.some(a => a.id === b.voice.asset && a.type === 'audio'))
      && (b.voice.volume === undefined || (Number.isFinite(b.voice.volume) && b.voice.volume >= 0 && b.voice.volume <= 1))
      && (b.voice.wait === undefined || typeof b.voice.wait === 'boolean');
    if (!valid) {
      const error = Error(`「${s.name}」第 ${index + 1} 个剧情块的配音设置无效`);
      error.sceneId = s.id; error.blockId = b.id;
      throw error;
    }
  }
  return p;
};

document.addEventListener('change', event => {
  const key = event.target.dataset.voice;
  const target = voiceTarget();
  if (!key || !target) return;
  change(() => {
    const settings = KotobaCore.voiceSettings(target);
    settings[key] = key === 'volume' ? Number(event.target.value) / 100
      : key === 'wait' ? event.target.checked : event.target.value;
    if (settings.asset) target.voice = settings;
    else if (key === 'asset') delete target.voice;
  });
});
document.addEventListener('input', event => {
  if (event.target.dataset.voice === 'volume') $('#voiceVolumeLabel').textContent = event.target.value + '%';
});
document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!['import-voice', 'preview-voice', 'stop-voice', 'remove-voice'].includes(action)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const target = voiceTarget();
  if (action === 'import-voice') importVoiceFile();
  if (action === 'stop-voice') stageRenderer.stopVoice();
  if (action === 'remove-voice' && target) change(() => delete target.voice);
  if (action === 'preview-voice' && target) {
    stageRenderer.stopVoice();
    stageRenderer.playVoice(project, target, 'audition:' + target.id);
  }
}, true);

draw();
