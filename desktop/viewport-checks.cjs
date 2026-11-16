const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');

module.exports=async function verifyViewport(win,directory){
  const bounds=win.getBounds(),zoom=win.webContents.getZoomFactor(),measurements=[];
  const js=source=>win.webContents.executeJavaScript(source);
  await js(`globalThis.viewportOriginal={project,sceneId,selected,view,mode,history,playing,playScene,playIndex,ended};
    project=KotobaCore.normalize({id:uid(),title:'预览比例验证',characters:[{id:'a',name:'小夏',color:'#456781',asset:'demo-sprite-0'},{id:'b',name:'阿岚',color:'#456781',asset:'demo-sprite-1'}],assets:createDemoAssets(),scenes:[{id:'fit',name:'场景比例',multiPortrait:true,blocks:[{id:'a',type:'portrait',speaker:'a',position:'left'},{id:'b',type:'portrait',speaker:'b',position:'right'},{id:'line',type:'narration',text:'窗口放大、缩小后，画面保持十六比九。'}]}]});
    sceneId='fit';selected='line';view='script';mode='visual';history=[];playing=false;portraitDragMode=false;stageRenderer.reset();draw();`);
  const measure=async()=>js(`(async()=>{
    await Promise.all([...document.querySelectorAll('#stage img')].map(image=>image.decode().catch(()=>{})));
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await new Promise(r=>setTimeout(r,80));
    const stage=document.querySelector('#stage'),rect=stage.getBoundingClientRect(),image=stage.querySelector('.stage-character'),portrait=image.getBoundingClientRect(),subtitle=stage.querySelector('.dialogue').getBoundingClientRect();
    return {viewport:{width:innerWidth,height:innerHeight},stage:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},portrait:{ratio:portrait.width/portrait.height,natural:image.naturalWidth/image.naturalHeight},subtitle:{x:subtitle.x,y:subtitle.y,right:subtitle.right,bottom:subtitle.bottom},playing};
  })()`);
  try{
    for(const [width,height,factor] of [[1920,1080,1],[2560,1080,1],[1100,1000,1],[1600,900,1.25]]){
      win.setContentSize(width,height);win.webContents.setZoomFactor(factor);
      await js(`playing=false;stageRenderer.reset();draw()`);
      const embedded=await measure();assert.ok(Math.abs(embedded.stage.width/embedded.stage.height-16/9)<.005,'编辑器预览保持 16:9');
      await js(`startStoryPreview(0)`);
      const full=await measure(),r=full.stage,v=full.viewport;
      assert.ok(Math.abs(r.width/r.height-16/9)<.005,'放大后的全屏试演保持 16:9');
      assert.ok(r.width<=v.width+1&&r.height<=v.height+1&&r.x>=-1&&r.y>=-1,'舞台完整装入窗口');
      assert.ok(Math.abs(r.x+r.width/2-v.width/2)<1&&Math.abs(r.y+r.height/2-v.height/2)<1,'舞台居中');
      assert.ok(Math.abs(full.portrait.ratio-full.portrait.natural)<.01,'立绘比例不被压缩');
      assert.ok(full.subtitle.x>=r.x-1&&full.subtitle.right<=r.x+r.width+1&&full.subtitle.y>=r.y-1&&full.subtitle.bottom<=r.y+r.height+1,'字幕位于适配后的画面内');
      measurements.push({requested:{width,height,zoom:factor},embedded,full});
      if(width===2560)await new Promise(resolve=>setTimeout(resolve,250));
      if(width===2560)fs.writeFileSync(path.join(directory,'verification-wide-preview.png'),(await win.webContents.capturePage()).toPNG());
    }
    await js(`stopContentPlayback();playing=false;draw();globalThis.viewportFrame=document.createElement('iframe');viewportFrame.style.cssText='position:fixed;left:-10000px;width:1800px;height:900px';document.body.append(viewportFrame);
      globalThis.viewportReady=new Promise(resolve=>viewportFrame.onload=resolve);buildOfflineGame().then(html=>viewportFrame.srcdoc=html);`);
    await js(`viewportReady.then(()=>viewportFrame.contentDocument.querySelector('[data-title-action="start"]').click())`);
    for(const [width,height] of [[1800,900],[1000,900],[1800,450]]){
      const result=await js(`(async()=>{viewportFrame.style.width='${width}px';viewportFrame.style.height='${height}px';await new Promise(r=>setTimeout(r,100));const r=viewportFrame.contentDocument.querySelector('#stage').getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y}})()`);
      assert.ok(Math.abs(result.width/result.height-16/9)<.005&&result.width<=width+1&&result.height<=height+1,'导出游戏按窗口保持 16:9');
      measurements.push({exportViewport:{width,height},stage:result});
    }
    fs.writeFileSync(path.join(directory,'viewport-verification.json'),JSON.stringify({ok:true,measurements},null,2));
    return ['大窗口、超宽窗口、纵向窗口与缩放后的舞台比例','放大试演居中适配，立绘和字幕比例保持','HTML 游戏窗口变化后保持 16:9 画面'];
  }finally{
    await js(`globalThis.viewportFrame?.remove();delete globalThis.viewportFrame;stopContentPlayback();({project,sceneId,selected,view,mode,history,playing,playScene,playIndex,ended}=globalThis.viewportOriginal);delete globalThis.viewportOriginal;stageRenderer.reset();draw()`);
    win.setBounds(bounds);win.webContents.setZoomFactor(zoom);
  }
};
