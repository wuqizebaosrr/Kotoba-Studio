const {Worker} = require('node:worker_threads');
const path = require('node:path');

function createRecoveryQueue(recovery) {
  let worker = null;
  let current = null;
  const waiting = [];
  const idleWaiters = [];

  function advance() {
    if (current) return;
    current = waiting.shift();
    if (!current) {
      worker?.unref();
      idleWaiters.splice(0).forEach(resolve => resolve());
      return;
    }
    if (!worker) {
      worker = new Worker(path.join(__dirname, 'recovery-worker.cjs'));
      const instance = worker;
      worker.on('message', result => {
        const finished = current;
        current = null;
        finished.callbacks.forEach(resolve => resolve(result));
        advance();
      });
      const fail = error => {
        if (worker !== instance) return;
        worker = null;
        const failed = current;
        current = null;
        failed?.callbacks.forEach(resolve => resolve({ok: false, error: error.message}));
        advance();
      };
      worker.on('error', fail);
      worker.on('exit', code => fail(Error('保存进程已退出，代码 ' + code)));
    }
    worker.ref();
    try {
      worker.postMessage({body: current.body, recovery, projectPath: current.projectPath});
    } catch (error) {
      const failed = current;
      current = null;
      failed.callbacks.forEach(resolve => resolve({ok: false, error: error.message}));
      advance();
    }
  }

  function save(body, projectPath) {
    return new Promise(resolve => {
      const last = waiting.at(-1);
      // Only combine consecutive snapshots of the same document and target.
      if (last && body?.id && last.body?.id === body.id && last.projectPath === projectPath) {
        last.body = body;
        last.callbacks.push(resolve);
      } else waiting.push({body, projectPath, callbacks: [resolve]});
      advance();
    });
  }

  function busy() { return !!current || waiting.length > 0; }
  function flush() {
    return busy() ? new Promise(resolve => idleWaiters.push(resolve)) : Promise.resolve();
  }
  return {save, busy, flush};
}

module.exports = {createRecoveryQueue};
