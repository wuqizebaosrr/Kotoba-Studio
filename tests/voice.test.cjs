const {test} = require('node:test');
const assert = require('node:assert/strict');
const core = require('../dist/story-core.js');
const {createStageRenderer} = require('../dist/stage-player.js');
const library = require('../dist/library-core.js');

test('配音独立播放、等待、结束释放、切句停止以及重播', async () => {
  const OriginalAudio = global.Audio;
  const created = [];
  class FakeAudio {
    constructor(src) { this.src = src; this.paused = true; this.ended = false; created.push(this); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { this.src = ''; }
    load() {}
  }
  global.Audio = FakeAudio;
  try {
    const renderer = createStageRenderer(core);
    const project = {assets:[{id:'voice',type:'audio',data:'recording'}]};
    const line = {type:'dialogue', voice:{asset:'voice',volume:.4,wait:true}};
    renderer.playVoice(project, line, 'line-1');
    await Promise.resolve();
    assert.equal(created[0].volume, .4);
    assert.equal(created[0].loop, false);
    assert.equal(renderer.voiceWaiting(), true);
    renderer.playVoice(project, line, 'line-1');
    assert.equal(created.length, 1);
    renderer.pauseVoice();
    assert.equal(created[0].paused, true);
    renderer.resumeVoice();
    assert.equal(created[0].paused, false);
    const oldEnded = created[0].onended;
    renderer.playVoice(project, {...line,type:'narration'}, 'line-2');
    assert.equal(created[0].paused, true);
    assert.equal(created.length, 2);
    oldEnded();
    assert.equal(renderer.voiceWaiting(), true);
    created[1].ended = true;
    created[1].onended();
    assert.equal(renderer.voiceWaiting(), false);
    renderer.reset();
    assert.equal(created[1].paused, true);
  } finally { global.Audio = OriginalAudio; }
});

test('浏览器配音拦截可重试，损坏音频解除等待', async () => {
  const OriginalAudio = global.Audio;
  let current;
  class FakeAudio {
    constructor() { this.paused=true; this.blocked=true; current=this; }
    play() { if(this.blocked)return Promise.reject({name:'NotAllowedError'});this.paused=false;return Promise.resolve(); }
    pause() { this.paused=true; }
    removeAttribute() {}
  }
  global.Audio = FakeAudio;
  try {
    const renderer=createStageRenderer(core);
    renderer.playVoice({assets:[{id:'v',type:'audio',data:'recording'}]}, {type:'dialogue',voice:{asset:'v',wait:true}}, 'line');
    await Promise.resolve();
    assert.equal(renderer.voiceWaiting(), false);
    current.blocked=false;
    assert.equal(renderer.resumeVoice(), true);
    await Promise.resolve();
    assert.equal(renderer.voiceWaiting(), true);
    current.onerror();
    assert.equal(renderer.voiceWaiting(), false);
    renderer.stopVoice();
    renderer.playVoice({assets:[{id:'v',type:'audio',data:'recording'}]}, {type:'dialogue',voice:{asset:'v',wait:true}}, 'blocked-line');
    await Promise.resolve();
    renderer.resumeVoice();
    await Promise.resolve();
    assert.equal(renderer.voiceWaiting(), false);
    assert.equal(renderer.resumeVoice(), false);
    renderer.stopVoice();
  } finally { global.Audio=OriginalAudio; }
});

test('删除音频素材清理配音绑定，旧工程具有无配音默认值', () => {
  assert.deepEqual(core.voiceSettings(), {asset:'',volume:1,wait:false});
  const p={assets:[{id:'v',type:'audio'}],characters:[],scenes:[{blocks:[{id:'line',type:'narration',text:'正文',voice:{asset:'v'}}]}]};
  library.removeAssets(p,['v']);
  assert.equal(p.scenes[0].blocks[0].voice, undefined);
  assert.equal(p.scenes[0].blocks[0].text, '正文');
});
