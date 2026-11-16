const {parentPort} = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {MAX_PROJECT_BYTES} = require('./limits.cjs');

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temporary = file + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, text, 'utf8');
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

parentPort.on('message', ({body, recovery, projectPath}) => {
  try {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    if (Buffer.byteLength(text) > MAX_PROJECT_BYTES) throw Error('工程超过 256 MB');
    const project = typeof body === 'string' ? JSON.parse(body) : body;
    if (!project?.scenes?.length || !Array.isArray(project.assets) || !Array.isArray(project.characters)) {
      throw Error('工程格式不完整');
    }
    writeAtomic(recovery, text);
    if (projectPath) writeAtomic(projectPath, text);
    parentPort.postMessage({ok: true, title: project.title});
  } catch (error) {
    parentPort.postMessage({ok: false, error: error.message});
  }
});
