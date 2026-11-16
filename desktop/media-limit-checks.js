async function runMediaLimitChecks(){
  const assert=(ok,m)=>{if(!ok)throw Error(m)},original=JSON.stringify(project),originalPick=pickFile,OriginalReader=window.FileReader;
  const smallImage='data:image/png;base64,iVBORw0KGgo=';let pendingFile,reads=0;
  try{
    project=KotobaCore.normalize({id:uid(),title:'素材大小检查',characters:[],assets:[],scenes:[{id:'media-scene',name:'素材测试',blocks:[]}]});sceneId='media-scene';selected=null;view='assets';playing=false;history=[];draw();
    pickFile=(_accept,callback)=>callback(pendingFile);
    window.FileReader=class{readAsDataURL(file){reads++;this.result=file.type.startsWith('audio/')?'data:audio/wav;base64,AAAA':smallImage;this.onload()}};
    const file=(size,type='image/png')=>new File([new Uint8Array(size)],type.startsWith('audio/')?'test.wav':'test.png',{type});
    function normal(size,type='image/png'){pendingFile=file(size,type);const count=project.assets.length,previousReads=reads;document.querySelector('[data-action="upload"]').click();return {added:project.assets.length-count,read:reads-previousReads}}
    assert(normal(3*1024*1024+1).added===1,'允许超过旧 3 MB 上限');assert(normal(20*1024*1024).added===1,'图片恰好 20 MB 可导入');let result=normal(20*1024*1024+1);assert(result.added===0&&result.read===0,'图片超过 20 MB 在读取前拒绝');assert(normal(20*1024*1024,'audio/wav').added===1,'音频恰好 20 MB 可导入');result=normal(20*1024*1024+1,'audio/wav');assert(result.added===0&&result.read===0,'音频超过 20 MB 拒绝');
    pendingFile=file(20*1024*1024);let count=project.assets.length;importCgImage();assert(project.assets.length===count+1,'CG 恰好 20 MB 可导入');pendingFile=file(20*1024*1024+1);count=project.assets.length;const prior=reads;importCgImage();assert(project.assets.length===count&&reads===prior,'CG 超过 20 MB 在读取前拒绝');
    pendingFile=file(20*1024*1024);count=project.assets.length;importSceneBackground();assert(project.assets.length===count+1,'场景背景恰好 20 MB 可导入');pendingFile=file(20*1024*1024+1);count=project.assets.length;const backgroundReads=reads;importSceneBackground();assert(project.assets.length===count&&reads===backgroundReads,'场景背景超过 20 MB 拒绝');return ['图片、音频、CG 及场景背景的 20 MB 边界检查'];
  }finally{pickFile=originalPick;window.FileReader=OriginalReader;project=JSON.parse(original);sceneId=project.scenes[0].id;selected=scene().blocks[0]?.id;view='script';history=[];save();draw()}
}
