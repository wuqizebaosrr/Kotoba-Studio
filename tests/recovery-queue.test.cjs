const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {createRecoveryQueue} = require('../desktop/recovery-queue.cjs');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kotoba-recovery-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('kotoba-recovery-test-'));
    fs.rmSync(directory, {recursive: true, force: true});
  });
  return directory;
}

test('后台保存合并连续改动并保持不同工程各自的目标', async t => {
  const directory = fixture(t);
  const recovery = path.join(directory, 'recovery.json');
  const queue = createRecoveryQueue(recovery);
  const make = (id, number) => ({id, title: `${id}-${number}`, scenes: [{id:'chapter',blocks:[]}], assets:[], characters:[]});
  const firstFile = path.join(directory, 'first.json');
  const secondFile = path.join(directory, 'second.json');
  const results = [];
  for (let i = 0; i < 15; i++) results.push(queue.save(make('first', i), firstFile));
  results.push(queue.save(make('second', 1), secondFile));
  results.push(queue.save(make('first', 20), firstFile));
  assert.ok((await Promise.all(results)).every(result => result.ok));
  await queue.flush();
  assert.equal(JSON.parse(fs.readFileSync(firstFile)).title, 'first-20');
  assert.equal(JSON.parse(fs.readFileSync(secondFile)).title, 'second-1');
  assert.equal(JSON.parse(fs.readFileSync(recovery)).title, 'first-20');
  assert.equal(queue.busy(), false);
});

test('保存失败不覆盖已保存工程，后续重试仍然可用', async t => {
  const directory = fixture(t);
  const recovery = path.join(directory, 'recovery.json');
  const queue = createRecoveryQueue(recovery);
  const valid = {id:'project', title:'有效工程', scenes:[{id:'chapter',blocks:[]}], assets:[], characters:[]};
  assert.ok((await queue.save(valid, null)).ok);
  const saved = fs.readFileSync(recovery, 'utf8');
  assert.equal((await queue.save({...valid, assets:null}, null)).ok, false);
  assert.equal(fs.readFileSync(recovery, 'utf8'), saved);
  assert.ok((await queue.save({...valid, title:'重试成功'}, null)).ok);
  await queue.flush();
  assert.equal(JSON.parse(fs.readFileSync(recovery)).title, '重试成功');
});
