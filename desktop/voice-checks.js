async function runVoiceChecks() {
  const original = {project, sceneId, selected, view, mode, history};
  const NativeAudio = window.Audio;
  const created = [];
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  class FakeAudio {
    constructor(src) { this.src=src; this.paused=true; this.ended=false; created.push(this); }
    play() { this.paused=false; return Promise.resolve(); }
    pause() { this.paused=true; }
    removeAttribute() { this.src=''; }
    load() {}
  }
  try {
    window.Audio=FakeAudio;
    project=KotobaCore.normalize({id:uid(),title:'配音检查',characters:[{id:'c',name:'阿岚',color:'#477b74'}],assets:[
      {id:'bgm',name:'背景音乐.wav',type:'audio',data:'data:audio/wav;base64,QkFN'},
      {id:'voice',name:'录音.wav',type:'audio',data:'data:audio/wav;base64,Vk9JQ0U='}
    ],scenes:[{id:'voice-scene',name:'配音章',blocks:[
      {id:'music',type:'music',asset:'bgm'},
      {id:'line',type:'dialogue',speaker:'c',text:'带配音的对白'},
      {id:'narration',type:'narration',text:'旁白配音',voice:{asset:'voice',volume:1,wait:false}}
    ]}]});
    sceneId='voice-scene'; selected='line'; view='script'; mode='visual'; history=[]; playing=false; draw();
    const field=(key,value)=>{
      const input=$(`[data-voice="${key}"]`);
      if(input.type==='checkbox')input.checked=value;else input.value=value;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    };
    assert($('[data-action="import-voice"]'),'配音导入入口');
    field('asset','voice');field('volume',45);field('wait',true);
    assert(block().voice.asset==='voice'&&block().voice.volume===.45&&block().voice.wait,'本句配音设置');
    $('[data-action="preview-voice"]').click();await Promise.resolve();
    assert(created.at(-1).volume===.45&&!created.at(-1).paused,'配音试听与音量');
    $('[data-action="stop-voice"]').click();assert(created.at(-1).paused,'停止试听');
    startStoryPreview(1);await Promise.resolve();
    const background=created.findLast(a=>a.loop),recording=created.at(-1);
    assert(background&&!background.paused&&recording!==background&&!recording.loop,'背景音乐与配音独立');
    advance();assert(playIndex===1,'等待配音结束时不能跳句');
    recording.ended=true;recording.onended();advance();
    assert(playIndex===2&&recording.paused&&!background.paused,'配音结束后继续并切换录音');
    stopContentPlayback();assert(created.every(a=>a.paused),'退出试演停止全部音轨');
    selected='line';draw();
    validateProject(JSON.parse(JSON.stringify(project)));
    change(()=>KotobaLibrary.removeAssets(project,['voice']));
    assert(!block().voice,'删除音频解除配音绑定');undoContentChange();
    assert(block().voice.asset==='voice','撤销恢复配音绑定');

    const html=await buildOfflineGame();
    const source=`globalThis.testAudio=[];globalThis.Audio=function(src){this.src=src;this.paused=true;this.ended=false;testAudio.push(this);this.play=()=>{this.paused=false;return Promise.resolve()};this.pause=()=>this.paused=true;this.removeAttribute=()=>{};this.load=()=>{}};`;
    const frame=document.createElement('iframe');frame.style.cssText='position:fixed;left:-2000px;width:800px;height:450px';
    const loaded=new Promise((resolve,reject)=>{frame.onload=resolve;setTimeout(()=>reject(Error('配音试玩加载超时')),8000)});
    frame.srcdoc=html.replace('<script>const KotobaCore=','<script>'+source+'const KotobaCore=');document.body.append(frame);
    try {
      await loaded;frame.contentDocument.querySelector('[data-title-action="start"]')?.click();
      const doc=frame.contentDocument,voices=frame.contentWindow.testAudio;
      assert(voices.length===2&&voices[1].volume===.45&&!voices[1].paused,'导出试玩播放本句配音');
      doc.querySelector('#stage').click();assert(doc.querySelector('.dialogue p').textContent==='带配音的对白','导出试玩等待配音');
      voices[1].ended=true;voices[1].onended();doc.querySelector('#stage').click();
      assert(doc.querySelector('.dialogue p').textContent==='旁白配音'&&voices.length===3,'导出试玩推进到旁白配音');
      doc.querySelector('#saves').click();assert(voices[2].paused,'存读档面板暂停配音');
      doc.querySelector('#closeSaves').click();assert(!voices[2].paused,'返回游戏恢复配音');
    } finally {frame.remove()}
    return ['逐句配音绑定、试听、音量和背景音乐分轨','配音等待、切句停止、退出和素材删除撤销','离线试玩配音、旁白与存读档面板暂停恢复'];
  } finally {
    stopContentPlayback();window.Audio=NativeAudio;
    ({project,sceneId,selected,view,mode,history}=original);save();draw();
  }
}
