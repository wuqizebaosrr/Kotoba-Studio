const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('../dist/story-core.js');
const p=()=>core.normalize({title:'小说识别',characters:[{id:'s',name:'林澪',color:'#778866',variants:[]},{id:'me',name:'我',color:'#778866',variants:[]},{id:'soldier',name:'值班员',color:'#778866',variants:[]}],assets:[],scenes:[],textRoleAliases:{小林:'s',旅人:'me'}});
test('小说原文识别出五章、10 句引号对白和 10 段旁白，不造动作角色',()=>{const source=fs.readFileSync(path.join(__dirname,'fixtures/novel-example.txt'),'utf8'),project=p();const r=core.parseText(source,project);assert.equal(r.groups.length,5);assert.equal(r.groups.flatMap(g=>g.blocks).filter(b=>b.type==='dialogue').length,10);assert.equal(r.groups.flatMap(g=>g.blocks).filter(b=>b.type==='narration').length,10);assert.equal(r.unresolvedRoles.length,0);assert.equal(project.characters.length,3);assert.ok(r.unresolvedQuotes.length>0);assert.equal(r.quoteAttributions.length,10);assert.deepEqual(r.groups.map(g=>g.name),["第一幕：清晨", "第二幕：图书室", "第三幕：雨停", "第四幕：约定", "尾声：归途"])});
test('明确说话提示可以绑定，连续对白不会自行轮流分配',()=>{const project=p();const r=core.parseText('小林笑道：\n「第一句」\n「第二句」\n「第三句」',project);assert.equal(r.groups[0].blocks[0].type,'narration');assert.equal(r.groups[0].blocks[1].speaker,'s');assert.equal(r.unresolvedQuotes.length,2);const map=Object.fromEntries(r.unresolvedQuotes.map(q=>[q.key,'me']));const checked=core.parseText('小林笑道：\n「第一句」\n「第二句」\n「第三句」',project,{quoteMap:map});assert.equal(checked.unresolvedQuotes.length,0);assert.equal(checked.quoteAttributions[1].speaker,'me')});
test('原文后置归属能识别，下一句引语前的提示不会抢认上一句',()=>{const r=core.parseText('「第一句」\n小林小声嘀咕。\n「第二句」\n我笑道：\n「第三句」',p());assert.equal(r.quoteAttributions[0].speaker,'s');assert.equal(r.quoteAttributions[1].speaker,'');assert.equal(r.quoteAttributions[2].speaker,'me')});
test('首人称主角说话时可保留已显示的女主立绘',()=>{const project=p();project.assets=[{id:'portrait',type:'image'}];project.characters[0].asset='portrait';project.characters[1].preserveStagePortrait=true;const s={blocks:[{type:'portrait',speaker:'s',visible:true},{type:'dialogue',speaker:'me',text:'我来拜访。'}]};assert.equal(core.stageAt(project,s,1).portraitAsset.id,'portrait')});
test('已核对的工程导入稿没有悬空说话人或章节误识别',()=>{const source=fs.readFileSync(path.join(__dirname,'fixtures/novel-confirmed.txt'),'utf8');const r=core.parseText(source,p());assert.equal(r.groups.length,5);assert.equal(r.count,20);assert.equal(r.unresolvedRoles.length,0);assert.equal(r.unresolvedQuotes.length,0);assert.equal(r.unresolvedTargets.length,0);assert.equal(r.newCharacters.length,0);assert.ok(!source.includes('旅人'));assert.ok(!source.includes('未确认人物'))});
test('旧版本误生成的动作名称不作为小说自动归属证据',()=>{const project=p();project.characters.push({id:'legacy-wrong',name:'旅人闻言，非但没有恼怒，反而笑道',description:'由文本转换创建',asset:'',variants:[]});const r=core.parseText('旅人闻言，非但没有恼怒，反而笑道：\n「你好。」',project);assert.equal(r.unresolvedRoles.length,0);assert.notEqual(r.quoteAttributions[0].speaker,'legacy-wrong');assert.equal(r.quoteAttributions[0].speaker,'me')});

test('行内引号保留为旁白时整行显示，并保留原引号和句末标点', () => {
  const project = p();
  for (const quotes of ['「图书室留言」', '“图书室留言”', '『图书室留言』']) {
    const line = `雨把山路洗得只剩一种颜色。木牌在桥边晃，写着${quotes}。`;
    const draft = core.parseText(line, project);
    assert.equal(draft.unresolvedQuotes.length, 1);
    const quoteMap = {[draft.unresolvedQuotes[0].key]: '__narration__'};
    const result = core.parseText(line, project, {quoteMap});
    assert.equal(result.groups[0].blocks.length, 1);
    assert.equal(result.groups[0].blocks[0].type, 'narration');
    assert.equal(result.groups[0].blocks[0].text, line);
  }
});
