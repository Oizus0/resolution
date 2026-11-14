import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenViews, visibleNotice, SMOKE, SPECTRE } from '../src/visibility.ts';
import type { MapItem } from '../src/visibility.ts';
import { initialState, reduce } from '../src/engine.ts';
import { leader } from '../src/protocol.ts';
const base=(id:string,type='IMAGE',x=0,y=0):MapItem=>({id,type,name:id,visible:true,position:{x,y},rotation:0,scale:{x:1,y:1},metadata:{},createdUserId:'gm'});
const viewer={id:'player1',role:'PLAYER' as const};
test('hidden images stay private and GM sees them',()=>{
  const i={...base('secret'),visible:false};
  assert.equal(tokenViews([i],[],{},false,viewer)[0].visible,false);
  assert.equal(tokenViews([i],[],{},false,{id:'gm',role:'GM'})[0].visible,true);
});
test('Spectre viewers map to original IDs rather than duplicated local tokens',()=>{
  const i={...base('secret'),visible:false,metadata:{[`${SPECTRE}/isSpectre`]:true,[`${SPECTRE}/spectreViewers`]:['player1']}};
  assert.equal(tokenViews([i],[],{},false,viewer)[0].visible,true);
  assert.equal(tokenViews([i],[],{},false,{...viewer,id:'player2'})[0].visible,false);
});
test('Smoke local primary lights reveal only in range and unobstructed tokens',()=>{
  const light={...base('eye','LIGHT'),lightType:'PRIMARY',attenuationRadius:100,innerAngle:360};
  const wall={...base('wall','WALL'),points:[{x:50,y:-30},{x:50,y:30}]};
  const result=tokenViews([base('near','IMAGE',20),base('behind','IMAGE',75),base('far','IMAGE',150)],[light,wall],{},true,viewer);
  assert.deepEqual(result.map(t=>t.visible),[true,false,false]);
});
test('no lights, blindness, closed cones and static fog fail closed',()=>{
  const target=base('target','IMAGE',30);
  assert.equal(tokenViews([target],[],{},true,viewer)[0].visible,false);
  const light={...base('light','LIGHT'),lightType:'PRIMARY',attenuationRadius:100,innerAngle:60,rotation:180};
  assert.equal(tokenViews([target],[light],{},true,viewer)[0].visible,false);
  light.rotation=0;
  assert.equal(tokenViews([target],[light],{[`${SMOKE}/disableVision`]:true},true,viewer)[0].visible,false);
  const fog={...base('fog','SHAPE',20,-10),layer:'FOG',width:30,height:20,shapeType:'RECTANGLE'};
  assert.equal(tokenViews([target,fog],[light],{},false,viewer)[0].visible,false);
});
test('notifications never enumerate hidden targets or reveal an invisible source',()=>{
  const s=reduce(initialState(),{type:'add',participants:[{id:'ana',name:'Segredo',initiative:22},{id:'bruno',name:'Bruno',initiative:16}]}).state;
  const n={id:'n',kind:'duration' as const,effectId:'e',name:'Buff',message:'',targetIds:['bruno','ana'],anchorId:'ana',remaining:2,round:1};
  assert.equal(visibleNotice(n,s,new Set(['bruno']),false),'Buff · Bruno: 2 rodadas restantes.');
  assert.equal(visibleNotice({...n,targetIds:['ana']},s,new Set(['bruno']),false),null);
});
test('coordinator election prefers GM and is stable regardless of arrival order',()=>{
  const p=[{connectionId:'z',role:'GM' as const},{connectionId:'a',role:'PLAYER' as const},{connectionId:'b',role:'GM' as const}];
  assert.equal(leader(p),'b'); assert.equal(leader([...p].reverse()),'b');
});
