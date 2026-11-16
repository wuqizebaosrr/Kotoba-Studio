const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../dist/story-core.js');
function fixture(){return core.normalize({title:'多人',characters:[{id:'a',name:'小夏',color:'#123456',asset:'a'},{id:'b',name:'阿岚',color:'#123456',asset:'b'}],assets:[{id:'a',name:'夏',type:'image'},{id:'b',name:'岚',type:'image'}],scenes:[{id:'s',name:'会面',multiPortrait:true,blocks:[{id:'a1',type:'dialogue',speaker:'a',text:'你好'},{id:'b1',type:'dialogue',speaker:'b',text:'你好'},{id:'a2',type:'dialogue',speaker:'a',text:'再见'}]}]})}
test('多人同屏独立保留角色，轮流说话不会重复，未指定位置自动分布',()=>{
  const p=fixture(),s=p.scenes[0];let state=core.stageAt(p,s,0);assert.equal(state.portraits.length,1);assert.equal(core.portraitPlacement(state.portrait,state.character).x,50);
  state=core.stageAt(p,s,2);assert.equal(state.portraits.length,2);assert.deepEqual(state.portraits.map(item=>core.portraitPlacement(item.portrait,item.character).x),[20,80]);
  s.multiPortrait=false;assert.equal(core.stageAt(p,s,2).portraits.length,1);
});
test('隐藏、差分与位置仅影响指定角色；CG 后可恢复多人；章节与文本设置保留',()=>{
  const p=fixture(),s=p.scenes[0];s.blocks.splice(2,0,{id:'move',type:'portrait',speaker:'b',position:'custom',portraitLayout:{x:65,y:100,scale:85}},{id:'hide',type:'portrait',speaker:'a',visible:false});
  let state=core.stageAt(p,s,4);assert.deepEqual(state.portraits.map(item=>item.character.id),['b']);assert.equal(core.portraitPlacement(state.portrait,state.character).x,65);
  s.blocks.push({id:'cg',type:'cg',asset:'a'},{id:'end-cg',type:'cg',visible:false});assert.equal(core.stageAt(p,s,5).cg.id,'a');assert.equal(core.stageAt(p,s,6).portraits[0].character.id,'b');
  const parsed=core.parseText(core.serializeText(p,s),p);assert.equal(parsed.groups[0].multiPortrait,true);assert.equal(parsed.unresolvedRoles.length,0);
  const copy=JSON.parse(JSON.stringify(p));assert.equal(core.stageAt(copy,copy.scenes[0],6).portraits.length,1);
});
test('位移动画限制参数，并保留单人、多人对白继承与文本往返',()=>{
  const p=fixture(),s=p.scenes[0];
  s.blocks=[{id:'initial',type:'portrait',speaker:'a',position:'left'},{id:'before',type:'narration',text:'移动前'},{id:'move',type:'portrait',speaker:'a',position:'custom',portraitLayout:{x:75.5,y:105.2,scale:90},moveDuration:650,moveEasing:'ease-out'},{id:'after',type:'dialogue',speaker:'a',text:'到了'}];
  assert.deepEqual(core.portraitMotion(core.stageAt(p,s,3).portrait),{duration:650,easing:'ease-out'});
  const parsed=core.parseText(core.serializeText(p,s),p);const moved=parsed.groups[0].blocks.find(b=>b.moveDuration===650);assert.equal(moved.moveEasing,'ease-out');assert.equal(moved.portraitLayout.x,75.5);
  s.multiPortrait=false;s.blocks[3].moveDuration=200;assert.equal(core.portraitMotion(core.stageAt(p,s,3).portrait).duration,200);
  assert.deepEqual(core.portraitMotion({moveDuration:9000,moveEasing:'invalid'}),{duration:5000,easing:'ease-in-out'});assert.equal(core.portraitMotion({moveDuration:'oops'}).duration,0);
});
