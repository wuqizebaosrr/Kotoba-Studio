function createStageRenderer(core,mediaSource=asset=>asset?.data){
  let last=null,busyUntil=0,observer=null,observed=null;
  let motionAnimations=[],motionUntil=0;
  let motionEnabled=true;
  function clearPortraitMotion(){for(const animation of motionAnimations)animation.cancel();motionAnimations=[];motionUntil=0}
  function animatePortraits(el,p,sceneId,sprites,enabled){
    const previous=last?.scene===sceneId?last.portraits:null;
    const positions=new Map(),images=new Map([...el.querySelectorAll('.stage-character')].map(image=>[image.dataset.characterId,image]));
    const sceneTransition=el.querySelector('.scene-layers').className.includes('effect-');
    for(const item of sprites){
      const id=item.character.id,placement=core.portraitPlacement(item.portrait,item.character),motion=core.portraitMotion(item.portrait),prior=previous?.get(id);
      positions.set(id,placement);
      const image=images.get(id);
      if(image&&(!enabled||!motionEnabled||prior&&!sceneTransition))image.style.animation='none';
      if(!enabled||!motionEnabled||!prior||!motion.duration||['x','y','scale'].every(key=>prior[key]===placement[key]))continue;
      if(!image)continue;
      image.style.transition='none';
      const frame=value=>({left:value.x+'%',bottom:(100-value.y)+'%',height:(94*value.scale/100)+'%'});
      const animation=image.animate([frame(prior),frame(placement)],{duration:motion.duration,easing:motion.easing});
      motionAnimations.push(animation);animation.finished.catch(()=>{});motionUntil=Math.max(motionUntil,Date.now()+motion.duration);
    }
    return positions;
  }
  let effectTimer=null,effectAnimations=[],effectOverlay=null;
  let voice = null;
  let voiceKey = null;
  let voiceWait = false;
  let voiceBlocked = false;
  let voicePaused = false;
  let voiceError = '';
  let voiceAttempt = 0;
  let voiceRetryUsed = false;
  let voiceGain = 1;
  let voiceLineVolume = 1;

  function updateVoiceHint() {
    if (!observed?.isConnected) return;
    observed.querySelector('.voice-status')?.remove();
    const text = voiceError || (voiceBlocked ? '点击画面播放配音'
      : voice && !voice.paused && !voice.ended ? (voiceWait ? '配音播放中 · 结束后可继续' : '配音播放中') : '');
    if (!text) return;
    const hint = document.createElement('span');
    hint.className = 'voice-status';
    hint.textContent = text;
    observed.append(hint);
  }

  function stopVoice() {
    voiceAttempt++;
    if (voice) {
      voice.onended = null;
      voice.onerror = null;
      voice.pause();
      voice.removeAttribute('src');
      voice.load?.();
    }
    voice = null;
    voiceKey = null;
    voiceWait = voiceBlocked = voicePaused = false;
    voiceError = '';
    voiceRetryUsed = false;
    updateVoiceHint();
  }

  function tryVoice() {
    const current = voice;
    if (!current) return;
    const attempt = ++voiceAttempt;
    current.play()?.then(() => {
      if (voice === current && attempt === voiceAttempt) { voiceBlocked = false; updateVoiceHint(); }
    }, error => {
      if (voice !== current || attempt !== voiceAttempt) return;
      voiceBlocked = error?.name === 'NotAllowedError' && !voiceRetryUsed;
      if (!voiceBlocked) { voiceWait = false; voiceError = '配音无法播放，点击继续'; }
      updateVoiceHint();
    });
  }

  function playVoice(p, b, key) {
    const settings = core.voiceSettings(b);
    const sound = p.assets.find(a => a.id === settings.asset && a.type === 'audio');
    if (!sound || !['dialogue', 'narration'].includes(b?.type)) { stopVoice(); return; }
    if (voiceKey === key) { updateVoiceHint(); return; }
    stopVoice();
    voiceKey = key;
    voice = new Audio(sound.data);
    const current = voice;
    voiceLineVolume = settings.volume;
    current.volume = voiceLineVolume * voiceGain;
    current.loop = false;
    voiceWait = settings.wait;
    current.onended = () => {
      if (voice === current) { voiceWait = voiceBlocked = false; updateVoiceHint(); }
    };
    current.onerror = () => {
      if (voice === current) {
        voiceWait = voiceBlocked = false;
        voiceError = '配音无法播放，点击继续';
        updateVoiceHint();
      }
    };
    tryVoice();
  }

  function resumeVoice() {
    if (!voice || (!voiceBlocked && !voicePaused)) return false;
    if (voiceBlocked) voiceRetryUsed = true;
    voicePaused = false;
    tryVoice();
    return true;
  }

  function pauseVoice() {
    if (voice && !voice.paused && !voice.ended) {
      voiceAttempt++;
      voicePaused = true;
      voice.pause();
      updateVoiceHint();
    }
  }
  function clearVisualEffect(){if(effectTimer!==null){clearTimeout(effectTimer);effectTimer=null}for(const a of effectAnimations)a.cancel();effectAnimations=[];effectOverlay?.remove();effectOverlay=null}
  function playVisualEffect(el,b,p,complete,transitionTime=0){const fx=core.effectSettings(b),ms=fx.duration;const distance=fx.intensity*.4*el.clientWidth/1280;let target=null,frames;
    if(fx.effect==='shake'||fx.effect==='portraitShake'){target=el.querySelector(fx.effect==='shake'?'.scene-layers':'.stage-character');frames=[[0,0],[1,-.4],[-1,.5],[.8,.4],[-.7,-.4],[.4,.2],[-.3,.1],[0,0]].map(([x,y])=>({translate:`${x*distance}px ${y*distance}px`}))}
    else if(['rain','snow','petals'].includes(fx.effect)){const layer=document.createElement('div');layer.className='vfx-overlay vfx-particles';layer.style.cssText='position:absolute;inset:0;z-index:8;pointer-events:none;overflow:hidden';el.append(layer);effectOverlay=layer;const count=Math.round(12+fx.intensity*.65);for(let i=0;i<count;i++){const particle=document.createElement('span'),rain=fx.effect==='rain',size=rain?1:fx.effect==='petals'?8:4;particle.style.cssText=`position:absolute;top:-10%;left:${(i*61.803)%100}%;width:${size}px;height:${rain?25:size}px;background:${fx.effect==='petals'?'#ffb7d0':fx.color};border-radius:${rain?'1px':fx.effect==='petals'?'80% 0 80% 20%':'50%'};opacity:${.3+fx.intensity/150}`;layer.append(particle);const a=particle.animate([{transform:'translate(0,-10px) rotate(0deg)',opacity:0},{opacity:1,offset:.15},{transform:`translate(${rain?-30:Math.sin(i)*100}px,${el.clientHeight*1.2}px) rotate(${rain?-12:260}deg)`,opacity:0}],{duration:rain?650:1600,delay:-(i*97)%1600,iterations:Infinity,easing:'linear'});effectAnimations.push(a)}}
    else if(['zoom','blur'].includes(fx.effect)){target=el.querySelector('.scene-layers');frames=fx.effect==='zoom'?[{scale:1},{scale:1+fx.intensity/250,offset:.5},{scale:1}]:[{filter:'blur(0px)'},{filter:`blur(${fx.intensity/8}px)`,offset:.5},{filter:'blur(0px)'}]}
    else if(fx.effect==='overlay'){const media=p.assets.find(a=>a.id===fx.asset&&a.type==='image');if(media){target=document.createElement('img');target.className='vfx-overlay vfx-imported';target.src=mediaSource(media);target.alt=media.name;target.style.cssText=`position:absolute;inset:0;width:100%;height:100%;z-index:8;pointer-events:none;object-fit:${fx.fit};mix-blend-mode:${fx.blend==='add'?'plus-lighter':fx.blend}`;el.append(target);effectOverlay=target;frames=[{opacity:0},{opacity:fx.intensity/100,offset:.1},{opacity:fx.intensity/100,offset:.85},{opacity:0}]}}
    else{target=document.createElement('div');target.className='vfx-overlay';target.style.cssText=`position:absolute;inset:0;z-index:8;pointer-events:none;opacity:0;background:${fx.effect==='blackout'?'#000000':fx.color}`;el.appendChild(target);effectOverlay=target;const opacity=fx.intensity/100;frames=fx.effect==='blackout'?[{opacity:0,offset:0},{opacity,offset:.25},{opacity,offset:.7},{opacity:0,offset:1}]:[{opacity:0,offset:0},{opacity,offset:.15},{opacity:0,offset:1}]}
    if(target&&frames){for(const effectTarget of fx.effect==='portraitShake'?[...el.querySelectorAll('.stage-character')]:[target]){const animation=effectTarget.animate(frames,{duration:ms,easing:fx.effect.includes('Shake')||fx.effect==='shake'?'linear':'ease-in-out',iterations:1});effectAnimations.push(animation);animation.finished.catch(()=>{})}}
    el.dataset.visualEffect=fx.effect;busyUntil=Date.now()+Math.max(ms,transitionTime);effectTimer=setTimeout(()=>{effectTimer=null;busyUntil=0;for(const a of effectAnimations)a.cancel();effectAnimations=[];effectOverlay?.remove();effectOverlay=null;delete el.dataset.visualEffect;if(fx.advance==='auto'&&complete)complete()},Math.max(ms,transitionTime));
  }
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(el,p,s,index,ended=false,force=false,onEffectComplete=null,allowMotion=true){clearPortraitMotion();clearVisualEffect();delete el.dataset.visualEffect;const state=core.stageAt(p,s,index),b=s.blocks[index];const bg=state.cg||state.background,fit=state.cg?(state.cgBlock?.fit==='cover'?'cover':'contain'):core.backgroundSettings(state.backgroundBlock).fit,color=state.cg?'#142019':core.backgroundSettings(state.backgroundBlock).color;const key=s.id+':'+(state.cg?'cg:'+state.cgBlock.id:(state.backgroundBlock?.id||'')+':'+(state.cgControlBlock?.id||''));const different=last&&last.key!==key;const activeVisual=state.cg?state.cgBlock:state.visualBlock;const config=last?.scene!==s.id?s:activeVisual;const effect=config?.transition||activeVisual?.transition||'none';const ms=core.duration(config?.duration??activeVisual?.duration);const animate=!!last&&(different||force)&&effect!=='none'&&ms>0;const c=b?.type==='dialogue'?p.characters.find(c=>c.id===b.speaker):null;const sprites=state.cg?[]:state.portraits;el.style.setProperty('--scene-duration',ms+'ms');
    el.innerHTML=`<div class="scene-layers ${animate?'effect-'+effect:''}">${animate&&last?.background?`<img decoding="async" class="scene-previous" style="object-fit:${last.fit||'cover'}" src="${esc(last.background)}" alt="">`:animate&&last?`<div class="scene-previous" style="background:${last.color||'#24372e'}"></div>`:''}${bg?`<img decoding="async" class="stage-bg scene-current ${state.cg?'cg-stage-image':''}" style="object-fit:${fit}" src="${esc(mediaSource(bg))}" alt="${esc(bg.name)}">`:'<div class="stage-bg scene-current"></div>'}${sprites.map(({portrait,character,portraitAsset})=>{const placement=core.portraitPlacement(portrait,character);return `<img decoding="async" class="stage-character sprite-${portrait.position||'center'}" data-character-id="${esc(character.id)}" style="left:${placement.x}%;bottom:${100-placement.y}%;height:${94*placement.scale/100}%;max-width:none;transform:translateX(-50%)" src="${esc(mediaSource(portraitAsset))}" alt="${esc(character.name)}">`}).join('')}<div class="scene-curtain"></div></div><span class="scene-label">${esc(s.name)}</span>${b?.type==='choice'&&!ended?`<div class="choices">${b.options.map((o,i)=>`<button data-action="choose" data-id="${i}">${esc(o.text)}</button>`).join('')}</div>`:''}<div class="dialogue">${c?`<span class="speaker" style="background:${esc(c.color)}">${esc(c.name)}</span>`:''}<p>${ended?'故事暂告一段落。谢谢你，陪我们走到这里。':esc(b?.text||'在左侧添加剧情，让故事从这里开始。')}</p><span class="next">${ended?'END':'▼'}</span></div>`;
    el.querySelector('.scene-layers').style.backgroundColor=color;el.querySelector('.scene-current').style.backgroundColor=color;const previous=el.querySelector('.scene-previous');if(previous)previous.style.backgroundColor=last?.color||'#24372e';
    const layout=core.subtitleLayout(p,b),box=el.querySelector('.dialogue');box.hidden=['cg','effect'].includes(b?.type)&&!ended;if(b?.type==='cg'&&b.visible!==false&&!ended&&state.cg)el.insertAdjacentHTML('beforeend','<span class="cg-hint">CG · 点击继续</span>');
    const style=core.dialogueStyle(p,b),background=document.createElement('div');background.className='dialogue-background';Object.assign(box.style,{background:'none',backdropFilter:'none',isolation:'isolate',borderRadius:style.radius+'px',color:style.textColor});Object.assign(background.style,{position:'absolute',inset:'0',zIndex:'-1',pointerEvents:'none',borderRadius:'inherit',overflow:'hidden',backgroundColor:style.color,opacity:String(style.opacity),backgroundSize:'cover',backgroundPosition:'center'});const image=p.assets.find(a=>a.id===style.image&&a.type==='image');if(image)background.style.backgroundImage='url('+JSON.stringify(mediaSource(image))+')';box.prepend(background);box.querySelector('.next').style.color='inherit';
    function positionSubtitles(){if(!box.isConnected)return;const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;const scale=w/1280,pad=Math.max(12,Math.min(32,28*scale));Object.assign(box.style,{width:layout.width+'%',right:'auto',bottom:'auto',transform:'translate(-50%,-50%)',padding:pad+'px',minHeight:Math.min(h*.2,150)+'px'});const text=box.querySelector('p');Object.assign(text.style,{fontSize:Math.max(12,layout.fontSize*scale)+'px',textAlign:layout.align,maxHeight:Math.max(40,h*.55)+'px',overflowY:'auto',overflowWrap:'anywhere',whiteSpace:'pre-wrap',margin:'0'});const name=box.querySelector('.speaker');if(name)Object.assign(name.style,{fontSize:Math.max(11,layout.fontSize*.75*scale)+'px',top:'auto',bottom:'calc(100% + 6px)',left:'0',maxWidth:'100%',overflowWrap:'anywhere'});const bw=box.offsetWidth,bh=box.offsetHeight,nh=name?.offsetHeight||0,margin=6;const x=Math.max(bw/2+margin,Math.min(w-bw/2-margin,w*layout.x/100));const y=Math.max(bh/2+nh+(name?6:0)+margin,Math.min(h-bh/2-margin,h*layout.y/100));box.style.left=x+'px';box.style.top=y+'px';}
    positionSubtitles();observer?.disconnect();observer=new ResizeObserver(positionSubtitles);observer.observe(el);observed=el;
    if(animate){busyUntil=Date.now()+ms;const layer=el.querySelector('.scene-layers');layer.addEventListener('animationend',()=>{if(Date.now()>=busyUntil-30){layer.className='scene-layers';layer.querySelector('.scene-previous')?.remove()}},{once:false})}else busyUntil=0;const portraitPositions=animatePortraits(el,p,s.id,sprites,allowMotion&&!ended);if(b?.type==='effect'&&!ended)playVisualEffect(el,b,p,onEffectComplete,Math.max(animate?ms:0,motionUntil-Date.now()));last={key,scene:s.id,background:bg?mediaSource(bg):'',fit,color,portraits:portraitPositions};return state;
  }
  function setVoiceVolume(value) {
    voiceGain = Math.min(1, Math.max(0, value));
    if (voice) voice.volume = voiceLineVolume * voiceGain;
  }
  return {render,setMotionEnabled:value=>{motionEnabled=value!==false},setVoiceVolume,playVoice,stopVoice,resumeVoice,pauseVoice,voiceWaiting:()=>voiceWait&&!voiceBlocked,busy:()=>Date.now()<Math.max(busyUntil,motionUntil),reset:()=>{stopVoice();clearPortraitMotion();clearVisualEffect();last=null;busyUntil=0;observer?.disconnect();observer=null;observed=null}};
}
function startOfflineGame(p,options={}){
  document.body.classList?.add('game-viewport');
  const core=KotobaCore,renderer=createStageRenderer(core);let sid=p.scenes[0].id,index=0,ended=false,music=null,needsMusicGesture=false,pendingEffectContinue=null;
  let menuOpen = true;
  let started = false;
  const stage=document.querySelector('#stage');const scene=()=>p.scenes.find(s=>s.id===sid);
  function tryMusic() {
    const current = music;
    if (!current) return;
    const attempt = current.play();
    attempt?.then(() => {
      if (music === current) needsMusicGesture = false;
    }, error => {
      if (music === current) needsMusicGesture = error.name === 'NotAllowedError';
    });
  }
  function selectMusic(assetId) {
    music?.pause();
    music = null;
    needsMusicGesture = false;
    const sound = p.assets.find(a => a.id === assetId && a.type === 'audio');
    if (!sound) return;
    music = new Audio(sound.data);
    music.loop = true;
    music.volume = preferences.music;
    // The initial play may be blocked until the player clicks or presses a key.
    needsMusicGesture = true;
    tryMusic();
  }
  function resumeMusicFromGesture() {
    if (needsMusicGesture && music?.paused) tryMusic();
  }
  function resolve(){let guard=0;while(guard++<100){const b=scene()?.blocks[index];if(menuOpen||!b){ended=true;return}if(b.type==='jump'){if(!b.target){ended=true;return}sid=b.target;index=0;continue}if(b.type==='music'){selectMusic(b.asset);index++;continue}if(['background','portrait'].includes(b.type)||(b.type==='cg'&&(b.visible===false||b.wait===false))){index++;continue}return}ended=true}
  function paint(){const capturedScene=sid,capturedIndex=index;const done=()=>{if(menuOpen||ended||sid!==capturedScene||index!==capturedIndex)return;if(!panel.hidden||!settingsPanel.hidden){pendingEffectContinue=done;return}next()};renderer.render(stage,p,scene()||p.scenes[0],index,ended,false,done);if(ended)renderer.stopVoice();else renderer.playVoice(p,scene()?.blocks[index],sid+':'+index);document.querySelector('#restart').hidden=!ended}
  function next(){if(menuOpen||!panel.hidden||!settingsPanel.hidden)return;if(renderer.resumeVoice()||renderer.voiceWaiting())return;if(ended||renderer.busy()||scene()?.blocks[index]?.type==='choice')return;renderer.stopVoice();index++;resolve();paint()}
  stage.onclick=e=>{if(menuOpen||!panel.hidden||!settingsPanel.hidden)return;resumeMusicFromGesture();const choice=e.target.closest('[data-action="choose"]');if(choice){if(renderer.busy())return;const o=scene()?.blocks[index]?.options[Number(choice.dataset.id)];if(!o)return;if(!o.target)ended=true;else{sid=o.target;index=0;resolve()}paint()}else next()};
  document.querySelector('#restart').onclick=()=>startNewGame();
  const panel=document.querySelector('#gameSavePanel'),saveKey='kotoba-progress-v2-'+p.id;let savesReturn='game';
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function readSlots(){try{const values=globalThis.gameNative?globalThis.gameNative.readSlots():JSON.parse(localStorage.getItem(saveKey));return Array.isArray(values)?values:[]}catch{return []}}
  function persistSlots(slots){if(globalThis.gameNative){const result=globalThis.gameNative.writeSlots(JSON.stringify(slots));if(!result?.ok)throw Error('存档写入失败')}else localStorage.setItem(saveKey,JSON.stringify(slots))}
  function saves(message=''){
    if(panel.hidden)savesReturn=!settingsPanel.hidden?'settings':menuOpen?'title':'game';
    settingsPanel.hidden=true;renderer.pauseVoice();const slots=readSlots();panel.hidden=false;
    panel.innerHTML=`<div class="game-save-shell"><header class="game-save-header"><h2>游戏存档 / 读取</h2><button type="button" class="btn" id="cancelSaves">取消</button></header>
      <p class="field-note" role="status">${escape(message||'进度保存在当前设备。取消可返回上一个画面，不改变当前剧情。')}</p><div class="game-save-slots"><div class="variant-list">${Array.from({length:6},(_,i)=>`<div class="variant-row"><div class="details"><strong>存档 ${i+1} · ${escape(slots[i]?.label||'空存档')}</strong><small>${slots[i]?new Date(slots[i].updatedAt).toLocaleString():'尚未保存'}</small></div><button class="btn small" data-save="${i}" ${ended||menuOpen?'disabled':''}>${slots[i]?'覆盖保存':'保存'}</button><button class="btn small" data-load="${i}" ${slots[i]?'':'disabled'}>读取</button></div>`).join('')}</div></div>
      <footer class="game-save-footer"><button type="button" class="btn" id="closeSaves">取消 · 返回${savesReturn==='settings'?'设置':menuOpen?'标题':'游戏'}</button><small>Esc 返回</small></footer></div>`;
    panel.querySelector('#cancelSaves').focus({preventScroll:true});
  }
  document.querySelector('#saves').onclick=()=>{resumeMusicFromGesture();saves()};globalThis.gameNative?.onMenu(command=>{if(command==='saves')saves();if(command==='title')showTitle();if(command==='settings')openSettings()});
  panel.onclick=e=>{if(e.target.closest('#closeSaves, #cancelSaves')){cancelSavePanel();return}if(e.target.dataset.save!==undefined){const b=scene()?.blocks[index];if(menuOpen||!b){saves('当前位置无法保存');return}try{const slots=readSlots();slots[Number(e.target.dataset.save)]={sceneId:sid,blockId:b.id,label:scene().name+' · '+(b.text||'').slice(0,24),updatedAt:new Date().toISOString()};persistSlots(slots);saves('进度已保存。')}catch{saves('无法写入存档，请检查当前浏览器的本地存储权限。')}}if(e.target.dataset.load!==undefined){const data=readSlots()[Number(e.target.dataset.load)],s=p.scenes.find(s=>s.id===data?.sceneId),pos=s?.blocks.findIndex(b=>b.id===data.blockId);if(!s||pos<0){saves('这个存档对应的剧情已不存在。');return}enterGame();pendingEffectContinue=null;selectMusic(s.blocks.slice(0,pos).findLast(b=>b.type==='music')?.asset);sid=s.id;index=pos;ended=false;renderer.reset();resolve();panel.hidden=true;paint()}};
  const menu = core.menuSettings(p);
  const titleScreen = document.createElement('section');
  titleScreen.id = 'gameTitleScreen';
  titleScreen.className = 'title-screen';
  titleScreen.setAttribute('aria-label', '游戏标题菜单');
  const background = p.assets.find(a => a.id === menu.background && a.type === 'image');
  titleScreen.style.backgroundColor = menu.color;
  titleScreen.style.color = menu.textColor;
  if (background) titleScreen.style.backgroundImage = 'linear-gradient(90deg,#081c17dc,#081c1740),url('+JSON.stringify(background.data)+')';
  document.body.append(titleScreen);
  const settingsPanel = document.createElement('section');
  settingsPanel.id = 'gameSettingsPanel';
  settingsPanel.className = 'game-settings-panel';
  settingsPanel.hidden = true;
  document.body.append(settingsPanel);
  const settingsKey = 'kotoba-settings-v1-' + p.id;
  let preferences = {music:1,voice:1};
  try {
    const saved = globalThis.gameNative?.readSettings ? globalThis.gameNative.readSettings() : JSON.parse(localStorage.getItem(settingsKey));
    for (const key of ['music','voice']) if (Number.isFinite(saved?.[key])) preferences[key]=Math.min(1,Math.max(0,saved[key]));
  } catch {}
  renderer.setVoiceVolume(preferences.voice);
  const toolbar = document.querySelector('.game-toolbar');
  const homeButton = document.createElement('button');
  homeButton.className = 'btn';
  homeButton.id = 'gameTitleButton';
  homeButton.textContent = '标题菜单';
  homeButton.onclick = () => showTitle();
  toolbar?.append(homeButton);

  function validSlots() {
    return readSlots().map((slot,i)=>({slot,i})).filter(({slot})=>p.scenes.some(s=>s.id===slot?.sceneId&&s.blocks.some(b=>b.id===slot.blockId)))
      .sort((a,b)=>(Date.parse(b.slot.updatedAt)||0)-(Date.parse(a.slot.updatedAt)||0));
  }
  function showTitle(message='') {
    menuOpen=true;
    panel.hidden=true;
    settingsPanel.hidden=true;
    pendingEffectContinue=null;
    renderer.reset();
    music?.pause();
    stage.hidden=true;
    if (toolbar) toolbar.hidden=true;
    titleScreen.hidden=false;
    titleScreen.innerHTML=`<div class="title-menu-content"><p class="title-menu-subtitle">${escape(menu.subtitle)}</p>
      <h1>${escape(menu.title)}</h1><nav aria-label="进入游戏选项">
      <button data-title-action="start">开始游戏</button>
      <button data-title-action="continue" ${validSlots().length?'':'disabled'}>继续游戏</button>
      <button data-title-action="load">读取存档</button>
      <button data-title-action="settings">设置</button>
      ${started&&!ended?'<button data-title-action="resume">返回游戏</button>':''}
      <button data-title-action="exit">退出游戏</button></nav><p class="title-menu-message" role="status">${escape(message)}</p></div>`;
    titleScreen.querySelector('nav button:not([disabled])')?.focus({preventScroll:true});
  }
  function enterGame() {
    menuOpen=false; started=true;
    titleScreen.hidden=true; settingsPanel.hidden=true; panel.hidden=true; stage.hidden=false;
    if (toolbar) toolbar.hidden=false;
  }
  function startNewGame() {
    enterGame();
    pendingEffectContinue=null; selectMusic(); renderer.reset();
    sid=p.scenes[0].id;index=0;ended=false;resolve();paint();
  }
  function closePanel() {
    panel.hidden=true; settingsPanel.hidden=true;
    if (!menuOpen) {
      renderer.resumeVoice();
      const resume=pendingEffectContinue;pendingEffectContinue=null;resume?.();
    }
  }
  function openSettings() {
    panel.hidden=true;
    renderer.pauseVoice();
    settingsPanel.hidden=false;
    settingsPanel.innerHTML=`<h2>游戏设置</h2>${[['music','背景音乐'],['voice','配音']].map(([key,label])=>
      `<label>${label} <output data-volume-output="${key}">${Math.round(preferences[key]*100)}%</output>
      <input type="range" min="0" max="100" value="${Math.round(preferences[key]*100)}" data-game-volume="${key}"></label>`).join('')}
      <p id="gameSettingsStatus" role="status">设置保存在当前设备。</p><button class="btn" id="closeSettings">返回</button>`;
  }
  function cancelSavePanel(){
    if(savesReturn==='settings'){panel.hidden=true;openSettings()}
    else closePanel();
  }
  settingsPanel.oninput=event=>{
    const key=event.target.dataset.gameVolume;
    if (!['music','voice'].includes(key)) return;
    preferences[key]=Number(event.target.value)/100;
    settingsPanel.querySelector(`[data-volume-output="${key}"]`).textContent=event.target.value+'%';
    if(music)music.volume=preferences.music;
    renderer.setVoiceVolume(preferences.voice);
  };
  settingsPanel.onchange=()=>{
    try {
      if (globalThis.gameNative?.writeSettings) {
        const result=globalThis.gameNative.writeSettings(JSON.stringify(preferences));
        if(!result.ok)throw Error(result.error);
      } else localStorage.setItem(settingsKey,JSON.stringify(preferences));
      document.querySelector('#gameSettingsStatus').textContent='设置已保存。';
    } catch {document.querySelector('#gameSettingsStatus').textContent='暂时无法保存设置，本次运行仍然生效。'}
  };
  settingsPanel.onclick=event=>{if(event.target.id==='closeSettings')closePanel()};
  titleScreen.onclick=event=>{
    const action=event.target.closest('[data-title-action]')?.dataset.titleAction;
    if(action==='start')startNewGame();
    if(action==='load')saves();
    if(action==='settings')openSettings();
    if(action==='continue'){
      const latest=validSlots()[0];
      if(latest){saves();panel.querySelector(`[data-load="${latest.i}"]`)?.click()}
    }
    if(action==='resume'){enterGame();tryMusic();paint()}
    if(action==='exit'){
      if(globalThis.gameNative?.quit)globalThis.gameNative.quit();
      else showTitle('可关闭当前浏览器标签页退出游戏。');
    }
  };
  document.onkeydown=event=>{
    if(event.key==='Escape'){
      if(!panel.hidden)cancelSavePanel();else if(!settingsPanel.hidden)closePanel();
      else if(!menuOpen)showTitle();
      return;
    }
    if(menuOpen||!panel.hidden||!settingsPanel.hidden||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(event.target.tagName))return;
    if([' ','Enter','ArrowRight'].includes(event.key)){event.preventDefault();resumeMusicFromGesture();next()}
  };
  if(options.skipTitle)startNewGame();else showTitle();

}

if(typeof module!=='undefined')module.exports={createStageRenderer,startOfflineGame};
