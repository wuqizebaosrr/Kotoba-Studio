module.exports = async function measureEditor(webContents, project) {
  const benchmark = async function (input) {
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    await window.desktopReset();
    input.id = 'performance-only';
    project = KotobaCore.normalize(input);
    sceneId = project.scenes[0].id;
    selected = scene().blocks.find(b => b.type === 'dialogue')?.id;
    view = 'script'; mode = 'visual'; playing = false; history = [];
    draw();
    await pause(200);
    const measurements = {portraitInsert: [], effectDialog: [], effectApply: [], effectImport: []};
    const phases = [];
    let operation = '';
    const originals = {snapshot, save, draw, drawStage, drawInspector, dialog};
    const wrap = (name, original) => function (...args) {
      const start = performance.now();
      try { return original(...args); }
      finally { if (operation) phases.push({operation, phase:name, ms:performance.now()-start}); }
    };
    snapshot=wrap('snapshot',snapshot); save=wrap('save',save); draw=wrap('draw',draw);
    drawStage=wrap('drawStage',drawStage); drawInspector=wrap('drawInspector',drawInspector); dialog=wrap('dialog',dialog);
    const originalPickFile = pickFile;
    const sourceImage = project.assets.find(asset => asset.type === 'image' && asset.data.startsWith('data:image/png;'));
    const imageBlob = sourceImage ? await (await fetch(sourceImage.data)).blob() : null;
    const importFile = imageBlob ? new File([imageBlob, 'performance-copy'], 'performance-effect.png', {type:'image/png'}) : null;
    let longestGap = 0;
    let previousTick = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      longestGap = Math.max(longestGap, now - previousTick);
      previousTick = now;
    }, 16);
    try {
      for (let i = 0; i < 3; i++) {
        operation = 'portrait-'+i;
        let start = performance.now();
        addBlock('portrait');
        measurements.portraitInsert.push(performance.now() - start);
        await pause(600);
        operation='dialog-'+i;
        start = performance.now();
        insertVisualEffect();
        measurements.effectDialog.push(performance.now() - start);
        const form = $('#dialogForm');
        operation='apply-'+i;
        start = performance.now();
        form.requestSubmit();
        measurements.effectApply.push(performance.now() - start);
        await save();
        await pause(200);
        if (importFile) {
          let completion;
          pickFile = (_accept, callback) => { completion = callback(importFile); };
          operation = 'import-'+i;
          start = performance.now();
          importExternalEffect();
          await completion;
          measurements.effectImport.push(performance.now()-start);
          pickFile = originalPickFile;
          await save();
        }
      }
      return {measurements, phases, longestGap, assets: project.assets.length};
    } finally { clearInterval(timer); pickFile=originalPickFile; ({snapshot,save,draw,drawStage,drawInspector,dialog}=originals); }
  };
  return webContents.executeJavaScript(`(${benchmark.toString()})(${JSON.stringify(project)})`);
};
